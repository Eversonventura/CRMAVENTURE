"use client";

import { useRef, useState, useTransition } from "react";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { confirmImport } from "./actions";
import {
  SYSTEM_FIELDS,
  parseImportFileClient,
  type ParsedImportFile,
  type SystemFieldKey,
} from "./import-parse";

type Step = "upload" | "mapping" | "done";

export function ImportModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState<Step>("upload");
  const [parsed, setParsed] = useState<ParsedImportFile | null>(null);
  const [mapping, setMapping] = useState<(SystemFieldKey | "")[]>([]);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [result, setResult] = useState<{ created: number; skipped: number } | null>(null);
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
      setMapping(res.suggestedMapping.map((m) => m ?? ""));
      setStep("mapping");
    });
  }

  function handleConfirm() {
    if (!parsed) return;
    startTransition(async () => {
      const finalMapping = mapping.map((m) => (m === "" ? null : m));
      const res = await confirmImport(parsed.rows, finalMapping);
      if (res.error) {
        setUploadError(res.error);
        return;
      }
      setResult({ created: res.created, skipped: res.skipped });
      setStep("done");
    });
  }

  const companyMapped = mapping.includes("company_name");

  return (
    <ModalBackdrop dirty={step === "mapping"} onClose={onClose} className="bg-ink/40 p-3">
      <div className="max-h-[92vh] w-full max-w-3xl overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-lg font-medium text-ink">Importar planilha</h2>

        {step === "upload" && (
          <div className="mt-5 space-y-3">
            <p className="text-sm text-muted">
              Aceita .csv e .xlsx. A primeira linha precisa ter os nomes das
              colunas. (.xls binário antigo não é suportado — salve como
              .xlsx primeiro.)
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
                A planilha tem mais de 500 linhas — só as 500 primeiras serão
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
                          {SYSTEM_FIELDS.map((f) => (
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
                Mapeie uma coluna pra "Nome da empresa" — é obrigatório.
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
                  ? "Importando..."
                  : `Importar ${parsed.rows.length} linhas`}
              </button>
            </div>
          </div>
        )}

        {step === "done" && result && (
          <div className="mt-5 space-y-4">
            <p className="text-sm text-ink">
              {result.created} lead{result.created === 1 ? "" : "s"} criado
              {result.created === 1 ? "" : "s"} como oportunidade em "Novo
              lead".
              {result.skipped > 0 &&
                ` ${result.skipped} linha${result.skipped === 1 ? "" : "s"} sem nome de empresa foi${result.skipped === 1 ? "" : "ram"} ignorada${result.skipped === 1 ? "" : "s"}.`}
            </p>
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
