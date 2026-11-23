"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { CompanyContactModal } from "./CompanyContactModal";
import { OpportunityModal } from "../funil/OpportunityModal";
import type { FunilOpportunityRow } from "../funil/FunilBoard";
import { getOpportunityForModal } from "../diario/actions";
import { useCrmSettings } from "../CrmSettingsContext";
import { showCompanyOnlineFields } from "../business";
import { ImportModal } from "./ImportModal";
import { deleteCompanyAction, deleteCompaniesAction } from "./actions";
import { registerContactAttempt } from "../actions";
import { TASK_TYPE_LABELS, type CrmStage, type TaskType, type TeamMemberOption } from "../types";
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
  editOpportunityId: string | null;
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

export function ContatosEmpresasList({
  companies,
  stages,
  teamMembers,
}: {
  companies: CompanyRow[];
  stages: CrmStage[];
  teamMembers: TeamMemberOption[];
}) {
  const settings = useCrmSettings();
  // B2C: só a pessoa (contato). B2B: empresa + contato; redes sociais e site só em agência de marketing.
  const isB2C = settings.businessModel === "b2c";
  const showOnline = showCompanyOnlineFields(settings);
  const [showForm, setShowForm] = useState(false);
  const [openedCard, setOpenedCard] = useState<{ opportunity: FunilOpportunityRow; stages: CrmStage[] } | null>(null);
  const [loadingEdit, setLoadingEdit] = useState<string | null>(null);
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

  // "Editar" abre o MESMO card do Funil (dados do contato, comerciais e origem), para o
  // cadastro por aqui e pelo Funil ser igual. Sem oportunidade, cai no formulário simples.
  async function handleEdit(c: CompanyRow) {
    if (!c.editOpportunityId) {
      setEditingCompany(c);
      return;
    }
    setLoadingEdit(c.id);
    setAttemptError(null);
    const result = await getOpportunityForModal(c.editOpportunityId);
    setLoadingEdit(null);
    if (result.error || !result.opportunity || !result.stages) {
      setAttemptError(result.error ?? "Não deu pra abrir o card.");
      return;
    }
    const member = teamMembers.find((m) => m.id === result.opportunity!.responsibleId);
    setOpenedCard({
      stages: result.stages,
      opportunity: { ...result.opportunity, responsibleName: member?.full_name ?? null, responsiblePhoto: member?.photo_url ?? null },
    });
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
    // Colunas do CSV seguem a mesma regra da tabela: B2C só a pessoa; B2B empresa + contato;
    // redes sociais e site só para agência de marketing.
    type Col = { header: string; value: (c: CompanyRow) => string | number | null };
    const cols: Col[] = [
      ...(isB2C
        ? [{ header: "Contato", value: (c: CompanyRow) => c.primaryContact?.name ?? c.name }]
        : [
            { header: "Empresa", value: (c: CompanyRow) => c.name },
            { header: "Segmento", value: (c: CompanyRow) => c.segment },
            { header: "Cidade", value: (c: CompanyRow) => c.city },
            { header: "Contato principal", value: (c: CompanyRow) => c.primaryContact?.name ?? "" },
            { header: "Cargo", value: (c: CompanyRow) => c.primaryContact?.role_title ?? "" },
          ]),
      { header: "Telefone", value: (c) => c.primaryContact?.phone ?? "" },
      { header: "WhatsApp", value: (c) => c.primaryContact?.whatsapp ?? "" },
      { header: "E-mail", value: (c) => c.primaryContact?.email ?? "" },
      ...(isB2C
        ? [{ header: "Observação interna", value: (c: CompanyRow) => c.internalNotes }]
        : [
            { header: "CNPJ", value: (c: CompanyRow) => c.cnpj },
            { header: "CEP", value: (c: CompanyRow) => c.postalCode },
          ]),
      ...(showOnline
        ? [
            { header: "Site", value: (c: CompanyRow) => c.website },
            { header: "Instagram", value: (c: CompanyRow) => c.instagram },
            { header: "Google Meu Negócio", value: (c: CompanyRow) => c.googleBusinessUrl },
            { header: "Outra rede social", value: (c: CompanyRow) => c.otherSocialUrl },
            { header: "Link (bio)", value: (c: CompanyRow) => c.bioLink },
          ]
        : []),
      { header: "Oportunidades", value: (c) => c.opportunityCount },
    ];
    const escapeCsv = (value: string | number | null) => {
      const str = value === null ? "" : String(value);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const lines = [cols.map((c) => c.header).join(","), ...rows.map((r) => cols.map((c) => escapeCsv(c.value(r))).join(","))];
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
              : "Exportar todos os contatos listados"
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
        <table className={`w-full text-sm ${isB2C ? "min-w-[760px]" : showOnline ? "min-w-[1180px]" : "min-w-[900px]"}`}>
          <thead>
            <tr className="border-b border-border text-left text-muted">
              <th className="w-10 px-4 py-3 font-normal">
                <input
                  type="checkbox"
                  checked={companies.length > 0 && selectedIds.size === companies.length}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 accent-brand"
                  aria-label="Selecionar todos"
                />
              </th>
              {isB2C ? (
                <th className="px-4 py-3 font-normal">Contato</th>
              ) : (
                <>
                  <th className="px-4 py-3 font-normal">Empresa</th>
                  <th className="px-4 py-3 font-normal">Contato principal</th>
                </>
              )}
              <th className="px-4 py-3 font-normal">WhatsApp/Telefone</th>
              <th className="px-4 py-3 font-normal">E-mail</th>
              {!isB2C && (
                <>
                  <th className="px-4 py-3 font-normal">CNPJ</th>
                  <th className="px-4 py-3 font-normal">CEP</th>
                </>
              )}
              {showOnline && (
                <>
                  <th className="px-4 py-3 font-normal">Site</th>
                  <th className="px-4 py-3 font-normal">Instagram</th>
                  <th className="px-4 py-3 font-normal">Google Meu Negócio</th>
                  <th className="px-4 py-3 font-normal">Outra rede social</th>
                  <th className="px-4 py-3 font-normal">Link (bio)</th>
                </>
              )}
              {!isB2C && <th className="px-4 py-3 font-normal">Oportunidades</th>}
              <th className="px-4 py-3 font-normal">Etapa / próxima ação</th>
              <th className="px-4 py-3 font-normal"></th>
            </tr>
          </thead>
          <tbody>
            {companies.length === 0 && (
              <tr>
                <td colSpan={15} className="px-4 py-8 text-center text-muted">
                  {isB2C ? "Nenhum contato cadastrado ainda." : "Nenhuma empresa cadastrada ainda."}
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
                {isB2C ? (
                  <td className="px-4 py-3 text-ink">
                    <button
                      type="button"
                      onClick={() => handleEdit(c)}
                      className="block break-words text-left hover:text-brand hover:underline"
                      title="Clique pra editar"
                    >
                      {c.primaryContact?.name ?? c.name}
                    </button>
                  </td>
                ) : (
                  <>
                    <td className="px-4 py-3 text-ink">
                      <button
                        type="button"
                        onClick={() => handleEdit(c)}
                        className="block break-words text-left hover:text-brand hover:underline"
                        title="Clique pra editar"
                      >
                        {c.name}
                      </button>
                      {(c.segment || c.city) && (
                        <span className="block break-words text-xs text-muted">{[c.segment, c.city].filter(Boolean).join(" · ")}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 break-words text-muted">
                      {c.primaryContact?.name ?? "—"}
                      {c.contactCount > 1 && <span className="ml-1 text-xs text-muted">+{c.contactCount - 1}</span>}
                      {c.primaryContact?.role_title && <span className="block text-xs text-muted">{c.primaryContact.role_title}</span>}
                    </td>
                  </>
                )}
                <td className="px-4 py-3 break-words text-muted">
                  {c.primaryContact?.whatsapp || c.primaryContact?.phone ? (
                    <ExternalLink
                      href={whatsappLink((c.primaryContact?.whatsapp ?? c.primaryContact?.phone) as string)}
                      label={c.primaryContact?.whatsapp ?? c.primaryContact?.phone ?? undefined}
                    />
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 break-words text-muted">{c.primaryContact?.email ?? "—"}</td>
                {!isB2C && (
                  <>
                    <td className="px-4 py-3 break-words text-muted">{c.cnpj ?? "—"}</td>
                    <td className="px-4 py-3 break-words text-muted">{c.postalCode ?? "—"}</td>
                  </>
                )}
                {showOnline && (
                  <>
                    <td className="px-4 py-3 break-words text-muted">{c.website ? <ExternalLink href={c.website} /> : "—"}</td>
                    <td className="px-4 py-3 break-words text-muted">
                      {c.instagram ? <ExternalLink href={instagramLink(c.instagram)} label={c.instagram} /> : "—"}
                    </td>
                    <td className="px-4 py-3 break-words text-muted">
                      {c.googleBusinessUrl ? <ExternalLink href={c.googleBusinessUrl} label="Ver" /> : "—"}
                    </td>
                    <td className="px-4 py-3 break-words text-muted">
                      {c.otherSocialUrl ? <ExternalLink href={c.otherSocialUrl} label="Ver" /> : "—"}
                    </td>
                    <td className="px-4 py-3 break-words text-muted">{c.bioLink ? <ExternalLink href={c.bioLink} label="Ver" /> : "—"}</td>
                  </>
                )}
                {!isB2C && <td className="px-4 py-3 text-muted">{c.opportunityCount}</td>}
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
                        {attemptPendingId === c.id ? "Registrando..." : attemptDoneId === c.id ? "✓ Registrado" : "Tentativa de contato"}
                      </button>
                    ) : c.openOpportunityCount > 1 ? (
                      <span
                        className="text-xs text-muted"
                        title="Mais de uma oportunidade aberta pra essa empresa — acesse o Funil pra escolher qual"
                      >
                        Tentativa de contato
                      </span>
                    ) : (
                      <span className="text-xs text-muted opacity-50" title="Sem oportunidade aberta no Funil pra essa empresa">
                        Tentativa de contato
                      </span>
                    )}
                    {c.internalNotes && (
                      <button onClick={() => setNotesOpen(c.id)} title="Ver observação interna" className="text-xs text-brand hover:opacity-80">
                        Nota
                      </button>
                    )}
                    <button
                      onClick={() => handleEdit(c)}
                      disabled={loadingEdit === c.id}
                      className="text-xs text-muted transition hover:text-brand disabled:opacity-50"
                    >
                      {loadingEdit === c.id ? "Abrindo..." : "Editar"}
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

      {showForm && <OpportunityModal opportunity={null} stages={stages} teamMembers={teamMembers} onClose={() => setShowForm(false)} />}
      {openedCard && (
        <OpportunityModal
          opportunity={openedCard.opportunity}
          stages={openedCard.stages}
          teamMembers={teamMembers}
          onClose={() => setOpenedCard(null)}
        />
      )}
      {editingCompany && (
        <CompanyContactModal company={editingCompany} onClose={() => setEditingCompany(null)} />
      )}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
    </div>
  );
}
