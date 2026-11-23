"use client";

import { useEffect, useMemo, useState } from "react";
import { listActiveTemplates } from "../mensagens/actions";
import { MESSAGE_KINDS, fillTemplate, suggestedKind, type MessageKind, type MessageTemplate } from "../messages";
import { whatsappLink } from "../linkUtils";

// Os modelos mudam pouco: uma busca por sessão do navegador basta.
let cache: { templates: MessageTemplate[]; me: string | null } | null = null;

// Sugestão de mensagem no card do lead: escolhe o tipo e o modelo, o texto já vem com o nome do
// contato, a empresa e o vendedor, e dá para ajustar antes de copiar ou abrir no WhatsApp.
export function MessageSuggestions({
  companyName,
  contactName,
  phone,
  stageRole,
}: {
  companyName: string;
  contactName: string | null;
  phone: string | null;
  stageRole: string | null;
}) {
  const [data, setData] = useState(cache);
  const [kind, setKind] = useState<MessageKind>(suggestedKind(stageRole));
  const [templateId, setTemplateId] = useState<string>("");
  const [text, setText] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (cache) return;
    let alive = true;
    listActiveTemplates().then((r) => {
      cache = r;
      if (alive) setData(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const options = useMemo(() => (data?.templates ?? []).filter((t) => t.kind === kind), [data, kind]);
  const current = options.find((t) => t.id === templateId) ?? options[0] ?? null;

  // O texto acompanha o modelo escolhido (e volta ao modelo se trocar de tipo).
  useEffect(() => {
    setText(current ? fillTemplate(current.body, { contact: contactName, company: companyName, seller: data?.me ?? null }) : "");
    setCopied(false);
  }, [current, contactName, companyName, data?.me]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // sem permissão de área de transferência: o texto continua selecionável na caixa
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-border bg-white p-3.5">
      <p className="text-sm font-medium text-ink">Mensagem sugerida</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {MESSAGE_KINDS.map((k) => (
          <button
            key={k.kind}
            type="button"
            onClick={() => {
              setKind(k.kind);
              setTemplateId("");
            }}
            className={`rounded-full border px-2.5 py-1 text-xs transition ${
              kind === k.kind ? "border-brand bg-brand-soft text-brand" : "border-border text-muted hover:text-ink"
            }`}
          >
            {k.label}
          </button>
        ))}
      </div>

      {!data ? (
        <p className="mt-3 text-xs text-muted">Carregando…</p>
      ) : options.length === 0 ? (
        <p className="mt-3 text-xs text-muted">Nenhum modelo ativo desse tipo. O administrador cadastra em Mensagens.</p>
      ) : (
        <>
          {options.length > 1 && (
            <select
              value={current?.id ?? ""}
              onChange={(e) => setTemplateId(e.target.value)}
              className="mt-3 w-full rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-xs text-ink outline-none focus:border-brand"
            >
              {options.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title}
                </option>
              ))}
            </select>
          )}
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
            className="mt-2 w-full resize-y rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-brand"
          />
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={copy}
              className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white transition hover:bg-brand/90"
            >
              {copied ? "✓ Copiado" : "Copiar"}
            </button>
            {phone ? (
              <a
                href={`${whatsappLink(phone)}?text=${encodeURIComponent(text)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-ink transition hover:border-brand"
              >
                Abrir no WhatsApp
              </a>
            ) : (
              <span className="text-[11px] text-muted">Sem WhatsApp/telefone no contato.</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
