"use client";

import { VoiceInputButton } from "@/components/VoiceInputButton";
import { useEffect, useRef, useState, useTransition } from "react";
import {
  addActivityFile,
  addManualActivity,
  getActivityFileSignedUrl,
  getOpportunityActivities,
  updateManualActivity,
} from "../actions";
import { AutoGrowTextarea } from "@/components/AutoGrowTextarea";

const CONTENT_MAX = 1000;
const EDITABLE_TYPES = new Set(["mensagem", "ligacao", "email", "reuniao", "anotacao"]);

type Activity = {
  id: string;
  type: string;
  content: string | null;
  file_url: string | null;
  occurred_at: string;
};

const TYPE_LABELS: Record<string, string> = {
  mensagem: "Mensagem",
  ligacao: "Ligação",
  email: "E-mail",
  reuniao: "Reunião",
  mudanca_etapa: "Etapa",
  tarefa: "Tarefa",
  anotacao: "Anotação",
  arquivo: "Arquivo",
  proposta: "Proposta",
  motivo_perda: "Perda",
  automacao: "Automação",
};

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif)$/i;

// Anexo de arquivo/foto — busca a URL assinada só quando o item
// aparece (bucket privado, mesmo padrão de Demandas), e mostra como
// miniatura clicável quando é imagem, ou link de download quando não é.
function ActivityFile({ path, name }: { path: string; name: string | null }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    getActivityFileSignedUrl(path).then(setUrl);
  }, [path]);

  if (!url) return <p className="mt-1 text-xs text-muted">Carregando anexo...</p>;

  if (IMAGE_EXT.test(path)) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="mt-1.5 block">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img loading="lazy" decoding="async" src={url} alt={name ?? ""} className="max-h-40 rounded-lg border border-border object-cover" />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-1 inline-block text-xs text-brand hover:underline"
    >
      📎 {name ?? "Baixar arquivo"}
    </a>
  );
}

// Edição inline de um comentário manual já enviado — abre um textarea
// no lugar do texto, com Salvar/Cancelar, pro caso de o vendedor
// digitar/mandar algo errado e precisar corrigir.
function EditActivityForm({
  activity,
  onDone,
}: {
  activity: Activity;
  onDone: () => void;
}) {
  const [content, setContent] = useState(activity.content ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    setError(null);
    startTransition(async () => {
      const result = await updateManualActivity(activity.id, content);
      if (result?.error) {
        setError(result.error);
        return;
      }
      onDone();
    });
  }

  return (
    <div>
      <AutoGrowTextarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        maxLength={CONTENT_MAX}
        rows={4}
        className="w-full rounded-lg border border-border bg-white px-2 py-1.5 text-xs text-ink outline-none focus:border-brand"
      />
      <div className="mt-1 flex items-center justify-between">
        <span className="text-[10px] text-muted">
          {content.length}/{CONTENT_MAX}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onDone}
            className="text-[11px] text-muted transition hover:text-ink"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={save}
            className="rounded border border-border px-2 py-0.5 text-[11px] text-ink transition hover:border-brand hover:text-brand disabled:opacity-60"
          >
            {isPending ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>
      {error && <p className="mt-1 text-[11px] text-brand">{error}</p>}
    </div>
  );
}

export function ActivityTimeline({ opportunityId }: { opportunityId: string }) {
  const [activities, setActivities] = useState<Activity[] | null>(null);
  const [type, setType] = useState("anotacao");
  const voiceScopeRef = useRef<HTMLDivElement>(null);
  const [content, setContent] = useState("");
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function reload() {
    getOpportunityActivities(opportunityId).then(setActivities as (a: unknown) => void);
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opportunityId]);

  function handleAdd() {
    if (!content.trim()) return;
    startTransition(async () => {
      await addManualActivity(
        opportunityId,
        type as "mensagem" | "ligacao" | "email" | "reuniao" | "anotacao",
        content
      );
      setContent("");
      reload();
    });
  }

  async function handleFileSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;

    setIsUploading(true);
    setUploadError(null);
    const formData = new FormData();
    formData.set("file", file);
    const result = await addActivityFile(opportunityId, formData);
    setIsUploading(false);
    if (result?.error) {
      setUploadError(result.error);
      return;
    }
    reload();
  }

  return (
    <div>
      <h3 className="text-sm font-medium text-ink">Comentários e atividade</h3>
      {/* O painel lateral tem largura fixa (w-96) em qualquer tamanho
          de tela — não depende do monitor ser grande ou pequeno. Select
          + campo + botão numa linha só ainda fica apertado nessa
          largura, então o campo de texto (o mais importante dos três)
          fica numa linha própria, sempre com espaço decente. */}
      <div className="mt-2 space-y-2">
        <select
          value={type}
          onChange={(e) => setType(e.target.value)}
          className="w-full rounded-lg border border-border bg-surface2 px-2 py-2 text-xs text-ink outline-none focus:border-brand"
        >
          <option value="anotacao">Anotação</option>
          <option value="ligacao">Ligação</option>
          <option value="email">E-mail</option>
          <option value="mensagem">Mensagem</option>
          <option value="reuniao">Reunião</option>
        </select>
        <div ref={voiceScopeRef}>
          <AutoGrowTextarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleAdd();
              }
            }}
            maxLength={CONTENT_MAX}
            rows={4}
            placeholder="Registrar... (Ctrl/Cmd+Enter envia)"
            className="w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-xs text-ink outline-none focus:border-brand"
          />
          <div className="mt-1 flex items-center justify-between">
            <span className="flex items-center gap-2 text-[10px] text-muted">
              <VoiceInputButton within={voiceScopeRef} />
              {content.length}/{CONTENT_MAX}
            </span>
            <button
              type="button"
              disabled={isPending}
              onClick={handleAdd}
              className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
            >
              Adicionar
            </button>
          </div>
        </div>
      </div>

      <div className="mt-2">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelected}
          className="hidden"
        />
        <button
          type="button"
          disabled={isUploading}
          onClick={() => fileInputRef.current?.click()}
          className="rounded-lg border border-dashed border-border px-3 py-1.5 text-xs text-muted transition hover:border-brand hover:text-brand disabled:opacity-60"
        >
          {isUploading ? "Enviando..." : "+ Anexar foto ou arquivo"}
        </button>
        {uploadError && <p className="mt-1 text-xs text-brand">{uploadError}</p>}
      </div>

      <div className="mt-3 max-h-[420px] space-y-2 overflow-y-auto">
        {activities === null ? (
          <p className="text-xs text-muted">Carregando...</p>
        ) : activities.length === 0 ? (
          <p className="text-xs text-muted">Nenhuma atividade ainda.</p>
        ) : (
          activities.map((a) => (
            <div key={a.id} className="rounded-lg border border-border bg-surface2/50 p-2 text-xs">
              <div className="flex items-center justify-between text-muted">
                <span className="font-medium text-ink">{TYPE_LABELS[a.type] ?? a.type}</span>
                <span>{new Date(a.occurred_at).toLocaleString("pt-BR")}</span>
              </div>
              {editingId === a.id ? (
                <EditActivityForm
                  activity={a}
                  onDone={() => {
                    setEditingId(null);
                    reload();
                  }}
                />
              ) : a.file_url ? (
                <ActivityFile path={a.file_url} name={a.content} />
              ) : (
                <>
                  {a.content && <p className="mt-1 whitespace-pre-wrap text-ink">{a.content}</p>}
                  {EDITABLE_TYPES.has(a.type) && (
                    <button
                      type="button"
                      onClick={() => setEditingId(a.id)}
                      className="mt-1 text-[11px] text-muted transition hover:text-brand"
                    >
                      Editar
                    </button>
                  )}
                </>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
