"use client";

import { useRef, useState, useTransition } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { confirmImport } from "./actions";
import { useCrmSettings } from "../CrmSettingsContext";
import { showCompanyOnlineFields } from "../business";
import {
  importFieldsFor,
  parseImportFileClient,
  type ParsedImportFile,
  type SystemFieldKey,
} from "./import-parse";

type Step = "upload" | "mapping" | "done";

const BATCH = 25; // linhas por chamada ao servidor

export function ImportModal({ onClose }: { onClose: () => void }) {
  const settings = useCrmSettings();
  const isB2C = settings.businessModel === "b2c";
  const fields = importFieldsFor({ isB2C, showOnline: showCompanyOnlineFields(settings), byContracts: settings.salesMode === "contratos" });
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [mapping, setMapping] = useState<(SystemFieldKey | "")[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number; duplicates: number; unknownChannels: string[] } | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError(null);
    startTransition(async () => {
      // Lê e parseia no navegador (não manda o arquivo pro servidor) —
      // evita o limite de tamanho de corpo de requisição da Vercel, que
      // travava planilhas maiores com um erro genérico de servidor.
      const res = await parseImportFileClient(file);
      if (res.error) {
        setUploadError(res.error);
        return;
      }
      setParsed(res);
      // Só sugere campos que o formulário desta conta usa (B2C sem empresa, etc.).
      setMapping(res.suggestedMapping.map((m) => (m && fields.some((f) => f.key === m) ? m : "")));
      setStep("mapping");
    });
  }

  function handleConfirm() {
    if (!parsed) return;
    startTransition(async () => {
      const finalMapping = mapping.map((m) => (m === "" ? null : m));
      const total = parsed.rows.length;
      const sum = { created: 0, skipped: 0, duplicates: 0, unknownChannels: [] as string[] };
      setUploadError(null);
      try {
        // Em lotes pequenos: planilhas grandes não estouram o tempo do servidor e a tela mostra o andamento.
        for (let i = 0; i < total; i += BATCH) {
          setProgress({ done: i, total });
          const res = await confirmImport(parsed.rows.slice(i, i + BATCH), finalMapping);
          if (res.error) {
            setUploadError(res.error);
            setProgress(null);
            return;
          }
          sum.created += res.created;
          sum.skipped += res.skipped;
          sum.duplicates += res.duplicates;
          for (const c of res.unknownChannels) if (!sum.unknownChannels.includes(c)) sum.unknownChannels.push(c);
        }
      } catch {
        setUploadError(`A importação parou no meio (${sum.created} leads já entraram). Confira a conexão e importe de novo: os que já entraram são reconhecidos pelo telefone e não duplicam.`);
        setProgress(null);
        return;
      }
      setProgress(null);
      setResult(sum);
      setStep("done");
    });
  }

  // B2C: o cliente é a pessoa, então basta mapear o nome do contato.
  const companyMapped = mapping.includes("company_name") || (isB2C && mapping.includes("contact_name"));

  return (
    <ModalBackdrop dirty={step === "mapping"} onClose={onClose} className="bg-ink/40 p-3">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-lg font-medium text-ink">Importar planilha</h2>

        {step === "upload" && (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-muted">
              Aceita .csv e .xlsx (até 1000 linhas). A primeira linha precisa ter os nomes das
              colunas: o sistema reconhece sozinho colunas como Nome, Telefone, Dia de entrada,
              Origem, Prioridade, Observação e Comentários, e você confere antes de importar.
              (.xls binário antigo não é suportado — salve como .xlsx primeiro.)
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx"
              onChange={handleFileChange}
              className="text-sm text-ink"
            />
            {isPending && <p className="text-sm text-muted">Lendo arquivo...</p>}
            {uploadError && <p className="text-sm text-brand">{uploadError}</p>}
          </div>
        )}

        {step === "mapping" && parsed && (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-muted">
              Confirma pra qual campo do sistema cada coluna corresponde.
              Colunas sem correspondência ficam sem preencher aquele campo —
              não trava a importação.
            </p>
            {parsed.truncated && (
              <p className="text-sm text-brand">
                A planilha tem mais de 1000 linhas — só as 1000 primeiras serão
                importadas.
              </p>
            )}

            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface2 text-left text-muted">
                    {parsed.headers.map((h, i) => (
                      <th key={i} className="px-3 py-2 font-normal">
                        <p className="font-medium text-ink">{h || `Coluna ${i + 1}`}</p>
                        <select
                          value={mapping[i] ?? ""}
                          onChange={(e) =>
                            setMapping((prev) =>
                              prev.map((m, idx) =>
                                idx === i ? (e.target.value as SystemFieldKey | "") : m
                              )
                            )
                          }
                          className="mt-1 w-full rounded-md border border-border bg-white px-1.5 py-1 text-xs text-ink outline-none focus:border-brand"
                        >
                          <option value="">Ignorar coluna</option>
                          {fields.map((f) => (
                            <option key={f.key} value={f.key}>
                              {f.label}
                            </option>
                          ))}
                        </select>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {parsed.rows.slice(0, 5).map((row, ri) => (
                    <tr key={ri} className="border-b border-border last:border-0">
                      {row.map((cell, ci) => (
                        <td key={ci} className="truncate px-3 py-2 text-muted">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="text-xs text-muted">
              Mostrando 5 de {parsed.rows.length} linhas.
            </p>

            {!companyMapped && (
              <p className="text-sm text-brand">
                {isB2C ? "Mapeie uma coluna pra \"Nome do contato\" — é obrigatório." : "Mapeie uma coluna pra \"Nome da empresa\" — é obrigatório."}
              </p>
            )}
            {uploadError && <p className="text-sm text-brand">{uploadError}</p>}

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setStep("upload")}
                className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition hover:text-ink"
              >
                Voltar
              </button>
              <button
                onClick={handleConfirm}
                disabled={isPending || !companyMapped}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
              >
                {isPending
                  ? progress
                    ? `Importando ${Math.min(progress.done + BATCH, progress.total)} de ${progress.total}...`
                    : "Importando..."
                  : `Importar ${parsed.rows.length} linhas`}
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-ink">
              {result.created} lead{result.created === 1 ? "" : "s"} importado{result.created === 1 ? "" : "s"} para o fluxo.
            </p>
            {result.duplicates > 0 && (
              <p className="text-xs text-muted">
                {result.duplicates} já existia{result.duplicates === 1 ? "" : "m"} (mesmo telefone ou WhatsApp) e não {result.duplicates === 1 ? "foi" : "foram"} duplicado{result.duplicates === 1 ? "" : "s"}.
              </p>
            )}
            {result.skipped > 0 && (
              <p className="text-xs text-muted">
                {result.skipped} linha{result.skipped === 1 ? "" : "s"} sem nome e sem telefone {result.skipped === 1 ? "foi ignorada" : "foram ignoradas"}.
              </p>
            )}
            {result.unknownChannels.length > 0 && (
              <p className="text-xs text-muted">
                Origens que não estão na sua lista (ficaram como vieram na planilha): {result.unknownChannels.join(", ")}. Para
                usá-las como origem oficial, adicione em Configurações → Origens dos leads.
              </p>
            )}
            <div className="flex justify-end">
              <button
                onClick={onClose}
                className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand/90"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </ModalBackdrop>
  );
}
