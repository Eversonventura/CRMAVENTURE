"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Channel } from "../channels";
import { addChannel, removeChannel, setChannelAd } from "./actions";

const field = "rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-brand";

// Origens (canais de aquisição) da conta: cada negócio tem os seus.
export function ChannelsSection({ channels }: { channels: Channel[] }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [isAd, setIsAd] = useState(false);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  async function run(action: () => Promise<{ error?: string }>, okText: string) {
    setBusy(true);
    setMsg(null);
    try {
      const result = await action();
      setMsg(result.error ? { kind: "error", text: result.error } : { kind: "ok", text: okText });
      if (!result.error) router.refresh();
      return !result.error;
    } catch {
      setMsg({ kind: "error", text: "Não foi possível salvar agora. Verifique a conexão e tente de novo." });
      return false;
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <ul className="max-w-xl divide-y divide-border rounded-lg border border-border bg-white">
        {channels.map((c) => (
          <li key={c.name} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2 text-sm">
            <span className="font-medium text-ink">{c.name}</span>
            <span className="flex items-center gap-3">
              <label className="flex items-center gap-1.5 text-xs text-muted" title="Leads dessa origem entram em Responder leads de anúncio e na meta de leads de anúncio">
                <input
                  type="checkbox"
                  checked={c.isAd}
                  disabled={busy}
                  onChange={(e) => run(() => setChannelAd(c.name, e.target.checked), "Origem atualizada.")}
                />
                é anúncio
              </label>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (confirm(`Remover a origem "${c.name}"? Os leads que já têm essa origem continuam com ela.`)) run(() => removeChannel(c.name), "Origem removida.");
                }}
                className="text-xs text-muted hover:text-brand"
              >
                Remover
              </button>
            </span>
          </li>
        ))}
      </ul>

      <form
        className="mt-3 flex max-w-xl flex-wrap items-center gap-2"
        onSubmit={async (e) => {
          e.preventDefault();
          if (await run(() => addChannel(name, isAd), "Origem adicionada.")) {
            setName("");
            setIsAd(false);
          }
        }}
      >
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} placeholder="Nova origem (ex.: Indicação de parceiro)" className={`${field} min-w-[220px] flex-1`} />
        <label className="flex items-center gap-1.5 text-xs text-muted">
          <input type="checkbox" checked={isAd} onChange={(e) => setIsAd(e.target.checked)} />é anúncio
        </label>
        <button type="submit" disabled={busy || name.trim() === ""} className="rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60">
          Adicionar
        </button>
      </form>
      {msg && <p className={`mt-2 text-sm ${msg.kind === "ok" ? "text-emerald-700" : "text-brand"}`}>{msg.text}</p>}
    </div>
  );
}
