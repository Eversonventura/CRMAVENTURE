"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompanyContactModal, type CompanyEditData } from "./CompanyContactModal";
import { ImportModal } from "./ImportModal";
import { deleteCompanyAction, deleteCompaniesAction } from "./actions";
import { registerContactAttempt } from "../actions";
import { TASK_TYPE_LABELS, type TaskType } from "../types";
import { whatsappLink, instagramLink } from "../linkUtils";

type CompanyRow = {
  id: string;
  name: string;
  segment: string | null;
  city: string | null;
  website: string | null;
  internalNotes: string | null;
  instagram: string | null;
  postalCode: string | null;
  cnpj: string | null;
  googleBusinessUrl: string | null;
  otherSocialUrl: string | null;
  bioLink: string | null;
  opportunityCount: number;
  openOpportunityId: string | null;
  stageName: string | null;
  stageColor: string | null;
  nextTask: { type: string; dueAt: string } | null;
  openOpportunityCount: number;
  contactCount: number;
  primaryContact: {
    id: string;
    name: string;
    role_title: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  } | null;
};

function ExternalLink({ href, label }: { href: string; label?: string }) {
  const url = href.startsWith("http") ? href : `https://${href}`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-brand underline-offset-2 hover:underline"
    >
      {label ?? href}
    </a>
  );
}

export function ContatosEmpresasList({ companies }: { companies: CompanyRow[] }) {
  const [showForm, setShowForm] = useState(false);
  // ?importar=1 (atalho do Diário) abre direto a importação de planilha.
  const searchParams = useSearchParams();
  const [showImport, setShowImport] = useState(searchParams.get("importar") === "1");
  const [notesOpen, setNotesOpen] = useState<string | null>(null);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [attemptPendingId, setAttemptPendingId] = useState<string | null>(null);
  const [attemptError, setAttemptError] = useState<string | null>(null);
  const [attemptDoneId, setAttemptDoneId] = useState<string | null>(null);

  async function handleContactAttempt(c: CompanyRow) {
    if (!c.openOpportunityId) return;
    setAttemptPendingId(c.id);
    setAttemptError(null);
    const result = await registerContactAttempt(c.openOpportunityId);
    setAttemptPendingId(null);
    if (result?.error) {
      setAttemptError(result.error);
      return;
    }
    setAttemptDoneId(c.id);
    setTimeout(() => setAttemptDoneId((prev) => (prev === c.id ? null : prev)), 2500);
  }

  async function handleDelete(c: CompanyRow) {
    if (!confirm(`Apagar "${c.name}" e seus contatos/oportunidades vinculados?`)) return;
    setDeletingId(c.id);
    await deleteCompanyAction(c.id);
    setDeletingId(null);
  }

  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelectedIds((prev) =>
      prev.size === companies.length ? new Set() : new Set(companies.map((c) => c.id))
    );
  }

  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (
      !confirm(
        `Apagar ${selectedIds.size} empresa(s) selecionada(s) e seus contatos/oportunidades vinculados? Essa ação não pode ser desfeita.`
      )
    )
      return;
    setBulkDeleting(true);
    await deleteCompaniesAction(Array.from(selectedIds));
    setBulkDeleting(false);
    setSelectedIds(new Set());
  }

  // Exporta a lista pra CSV — se tiver algo selecionado, exporta só a
  // seleção; sem seleção, exporta a lista inteira.
  function handleExport() {
    const rows = selectedIds.size > 0 ? companies.filter((c) => selectedIds.has(c.id)) : companies;
    const headers = [
      "Empresa",
      "Segmento",
      "Cidade",
      "Contato principal",
      "Cargo",
      "Telefone",
      "WhatsApp",
      "E-mail",
      "CNPJ",
      "CEP",
      "Site",
      "Instagram",
      "Google Meu Negócio",
      "Outra rede social",
      "Link (bio)",
      "Oportunidades",
    ];
    const escapeCsv = (value: string | number | null) => {
      const str = value === null ? "" : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [
      headers.join(","),
      ...rows.map((c) =>
        [
          c.name,
          c.segment,
          c.city,
          c.primaryContact?.name ?? "",
          c.primaryContact?.role_title ?? "",
          c.primaryContact?.phone ?? "",
          c.primaryContact?.whatsapp ?? "",
          c.primaryContact?.email ?? "",
          c.cnpj,
          c.postalCode,
          c.website,
          c.instagram,
          c.googleBusinessUrl,
          c.otherSocialUrl,
          c.bioLink,
          c.opportunityCount,
        ]
          .map(escapeCsv)
          .join(",")
      ),
    ];
    // BOM (﻿) evita o Excel abrir acento errado num CSV UTF-8.
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `contatos-empresas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-end gap-2">
        {selectedIds.size > 0 && (
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleting}
            className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700 transition hover:bg-red-50 disabled:opacity-50"
          >
            {bulkDeleting
              ? "Apagando..."
              : `Apagar selecionadas (${selectedIds.size})`}
          </button>
        )}
        <button
          onClick={handleExport}
          disabled={companies.length === 0}
          title={
            selectedIds.size > 0
              ? `Exportar ${selectedIds.size} selecionada(s)`
              : "Exportar todas as empresas listadas"
          }
          className="rounded-lg border border-border px-4 py-2 text-sm text-ink transition hover:border-brand disabled:opacity-50"
        >
          {selectedIds.size > 0 ? `Exportar (${selectedIds.size})` : "Exportar"}
        </button>
        <button
          onClick={() => setShowImport(true)}
          className="rounded-lg border border-border px-4 py-2 text-sm text-ink transition hover:border-brand"
        >
          Importar planilha
        </button>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
        >
          + Adicionar
        </button>
      </div>

      {attemptError && (
        <p className="mt-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">{attemptError}</p>
      )}

      <div className="mt-4 overflow-x-auto rounded-xl border border-border bg-surface">
        {/* table-fixed + colgroup: colunas com largura proporcional
            fixa (soma 100%) em vez de largura pelo conteúdo — texto
            longo (e-mail, link, CNPJ) quebra dentro da própria coluna
            (break-words) ao invés de esticar a tabela, em telas onde as
            14 colunas cabem confortavelmente (desktop/tablet largo).
            min-w garante uma largura mínima legível por coluna — abaixo
            dela, o container acima assume a rolagem horizontal em vez
            de espremer o texto a ponto de ficar ilegível (celular). */}
        <table className="w-full min-w-[980px] table-fixed text-sm">
          <colgroup>
            <col className="w-[3%]" />
            <col className="w-[15%]" />
            <col className="w-[10%]" />
            <col className="w-[9%]" />
            <col className="w-[11%]" />
            <col className="w-[7%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[5%]" />
            <col className="w-[4%]" />
            <col className="w-[11%]" />
          </colgroup>
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="px-4 py-3 font-normal">
                <input
                  type="checkbox"
                  checked={companies.length > 0 && selectedIds.size === companies.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 accent-brand"
                  aria-label="Selecionar todas"
                />
              </th>
              <th className="px-4 py-3 font-normal">Empresa</th>
              <th className="px-4 py-3 font-normal">Contato principal</th>
              <th className="px-4 py-3 font-normal">WhatsApp/Telefone</th>
              <th className="px-4 py-3 font-normal">E-mail</th>
              <th className="px-4 py-3 font-normal">CNPJ</th>
              <th className="px-4 py-3 font-normal">CEP</th>
              <th className="px-4 py-3 font-normal">Site</th>
              <th className="px-4 py-3 font-normal">Instagram</th>
              <th className="px-4 py-3 font-normal">Google Meu Negócio</th>
              <th className="px-4 py-3 font-normal">Outra rede social</th>
              <th className="px-4 py-3 font-normal">Link (bio)</th>
              <th className="px-4 py-3 font-normal">Oportunidades</th>
              <th className="px-4 py-3 font-normal">Etapa / próxima ação</th>
              <th className="px-4 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-muted">
                  Nenhuma empresa cadastrada ainda.
                </td>
              </tr>
            )}
            {companies.map((c) => (
              <tr key={c.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(c.id)}
                    onChange={() => toggleSelected(c.id)}
                    className="h-4 w-4 accent-brand"
                    aria-label={`Selecionar ${c.name}`}
                  />
                </td>
                <td className="px-4 py-3 text-ink">
                  <button
                    type="button"
                    onClick={() => setEditingCompany(c)}
                    className="block break-words text-left hover:text-brand hover:underline"
                    title="Clique pra editar"
                  >
                    {c.name}
                  </button>
                  {(c.segment || c.city) && (
                    <span className="block break-words text-xs text-muted">
                      {[c.segment, c.city].filter(Boolean).join(" · ")}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 break-words text-muted">
                  {c.primaryContact?.name ?? "—"}
                  {c.contactCount > 1 && (
                    <span className="ml-1 text-xs text-muted">+{c.contactCount - 1}</span>
                  )}
                  {c.primaryContact?.role_title && (
                    <span className="block text-xs text-muted">
                      {c.primaryContact.role_title}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 break-words text-muted">
                  {c.primaryContact?.whatsapp || c.primaryContact?.phone ? (
                    <ExternalLink
                      href={whatsappLink(
                        (c.primaryContact?.whatsapp ?? c.primaryContact?.phone) as string
                      )}
                      label={c.primaryContact?.whatsapp ?? c.primaryContact?.phone ?? undefined}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 break-words text-muted">{c.primaryContact?.email ?? "—"}</td>
                <td className="px-4 py-3 break-words text-muted">{c.cnpj ?? "—"}</td>
                <td className="px-4 py-3 break-words text-muted">{c.postalCode ?? "—"}</td>
                <td className="px-4 py-3 break-words text-muted">
                  {c.website ? <ExternalLink href={c.website} /> : "—"}
                </td>
                <td className="px-4 py-3 break-words text-muted">
                  {c.instagram ? (
                    <ExternalLink href={instagramLink(c.instagram)} label={c.instagram} />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 break-words text-muted">
                  {c.googleBusinessUrl ? <ExternalLink href={c.googleBusinessUrl} label="Ver" /> : "—"}
                </td>
                <td className="px-4 py-3 break-words text-muted">
                  {c.otherSocialUrl ? <ExternalLink href={c.otherSocialUrl} label="Ver" /> : "—"}
                </td>
                <td className="px-4 py-3 break-words text-muted">
                  {c.bioLink ? <ExternalLink href={c.bioLink} label="Ver" /> : "—"}
                </td>
                <td className="px-4 py-3 text-muted">{c.opportunityCount}</td>
                <td className="px-4 py-3 text-muted">
                  {c.stageName ? (
                    <div className="space-y-0.5">
                      <span className="inline-flex items-center gap-1.5 text-ink">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: c.stageColor ?? "#64748B" }} />
                        {c.stageName}
                      </span>
                      <p className={`text-xs ${c.nextTask && new Date(c.nextTask.dueAt) < new Date() ? "text-brand" : "text-muted"}`}>
                        {c.nextTask
                          ? `${TASK_TYPE_LABELS[c.nextTask.type as TaskType] ?? c.nextTask.type} · ${new Date(c.nextTask.dueAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}${new Date(c.nextTask.dueAt) < new Date() ? " (atrasada)" : ""}`
                          : "sem próxima ação"}
                      </p>
                    </div>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2.5">
                    {c.openOpportunityId ? (
                      <button
                        onClick={() => handleContactAttempt(c)}
                        disabled={attemptPendingId === c.id}
                        title="Registra a tentativa de contato no Funil sem precisar abrir o card"
                        className="text-xs text-muted transition hover:text-brand disabled:opacity-50"
                      >
                        {attemptPendingId === c.id
                          ? "Registrando..."
                          : attemptDoneId === c.id
                            ? "✓ Registrado"
                            : "Tentativa de contato"}
                      </button>
                    ) : c.openOpportunityCount > 1 ? (
                      <span
                        className="text-xs text-muted"
                        title="Mais de uma oportunidade aberta pra essa empresa — acesse o Funil pra escolher qual"
                      >
                        Tentativa de contato
                      </span>
                    ) : (
                      <span
                        className="text-xs text-muted opacity-50"
                        title="Sem oportunidade aberta no Funil pra essa empresa"
                      >
                        Tentativa de contato
                      </span>
                    )}
                    {c.internalNotes && (
                      <button
                        onClick={() => setNotesOpen(c.id)}
                        title="Ver observação interna"
                        className="text-xs text-brand hover:opacity-80"
                      >
                        Nota
                      </button>
                    )}
                    <button
                      onClick={() => setEditingCompany(c)}
                      className="text-xs text-muted transition hover:text-brand"
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => handleDelete(c)}
                      disabled={deletingId === c.id}
                      className="text-xs text-muted transition hover:text-brand disabled:opacity-50"
                    >
                      {deletingId === c.id ? "Apagando..." : "Apagar"}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {notesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-ink/30 p-4"
          onClick={() => setNotesOpen(null)}
        >
          <div
            className="w-full max-w-sm rounded-xl border border-border bg-white p-5 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-sm font-medium text-ink">Observação interna</p>
            <p className="mt-2 text-sm text-muted">
              {companies.find((c) => c.id === notesOpen)?.internalNotes}
            </p>
            <button
              onClick={() => setNotesOpen(null)}
              className="mt-4 text-sm text-brand hover:opacity-80"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {showForm && <CompanyContactModal onClose={() => setShowForm(false)} />}
      {editingCompany && (
        <CompanyContactModal company={editingCompany} onClose={() => setEditingCompany(null)} />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
