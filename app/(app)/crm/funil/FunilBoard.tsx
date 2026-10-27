"use client";

import { useEffect, useRef, useState } from "react";
import {
  DndContext,
  closestCorners,
  pointerWithin,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { moveOpportunityStage } from "../actions";
import { StageColorPicker } from "./StageColorPicker";
import type { CompanyExtra, OpportunityDetails } from "./details";
import { useRouter, useSearchParams } from "next/navigation";
import { StageManagerModal } from "./StageManagerModal";
import { ClosedDealModal } from "./ClosedDealModal";
import { PipelineManagerModal, type PipelineOption } from "./PipelineManagerModal";
import { OpportunityModal } from "./OpportunityModal";
import { LostOpportunityModal } from "./LostOpportunityModal";
import {
  TEMPERATURE_LABELS,
  type CrmStage,
  type TeamMemberOption,
  type Temperature,
} from "../types";
import { StatusPill, type StatusTone } from "@/components/StatusPill";
import { whatsappLink } from "../linkUtils";

// Design: quente pede atenção (vermelho),
// morno é intermediário (amarelo), frio é neutro (cinza) — antes as
// 3 temperaturas tinham a mesma cor cinza, sem diferenciação visual
// nenhuma.
const TEMPERATURE_TONE: Record<Temperature, StatusTone> = {
  quente: "red",
  morno: "yellow",
  frio: "gray",
};

export type FunilOpportunityRow = {
  id: string;
  companyId: string;
  contactId: string | null;
  stageId: string;
  status: "aberta" | "fechada" | "perdida";
  estimatedValue: number | null;
  serviceInterest: string | null;
  acquisitionChannel: string | null;
  responsibleId: string | null;
  responsibleName: string | null;
  responsiblePhoto: string | null;
  temperature: Temperature | null;
  expectedCloseDate: string | null;
  companyName: string;
  contactName: string | null;
  stageEnteredAt: string;
  website: string | null;
  segment: string | null;
  city: string | null;
  employeeCount: string | null;
  approxRevenue: string | null;
  instagram: string | null;
  contactRole: string | null;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  contactEmail: string | null;
  contactPreference: string | null;
  eventName: string | null;
  // Demais campos do card (qualificação e origem) — precisam voltar preenchidos
  // ao reabrir, senão salvar o formulário apagaria o que já estava gravado.
  details: OpportunityDetails;
  companyExtra: CompanyExtra;
};

// Mesmo fix real já aplicado no Kanban (app/(admin)/kanban/KanbanBoard.tsx):
// closestCorners sozinho mede distância global entre TODOS os
// retângulos (cards de todas as colunas + colunas vazias), então
// soltar sobre uma coluna vazia ou pouco povoada às vezes "perde" pra
// um card de uma coluna vizinha mais alta — na prática, o card parece
// não conseguir ser arrastado pra outra coluna. pointerWithin resolve
// olhando o que o ponteiro está literalmente sobrepondo primeiro; só
// cai pro closestCorners como fallback (ponteiro fora de qualquer
// retângulo).
const boardCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCorners(args);
};

const STALLED_DAYS = 7;

function formatCurrency(value: number | null) {
  if (value === null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function daysSince(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  return Math.floor(diff / 86400000);
}

// Cor do card, calculada no front (não armazenada). Vermelho > amarelo
// (parada) > azul (reunião) > verde (próxima ação) > cinza (aguardando).
// Sinais de tarefa/reunião/próxima ação ainda não existem (chegam no
// Sprint de Tarefas) — por ora só "parada" (sem mudança de etapa há
// mais de 7 dias) está ativo.
function cardBorderColor(opp: FunilOpportunityRow): string {
  const stalled = daysSince(opp.stageEnteredAt) > STALLED_DAYS;
  if (stalled) return "border-l-amber-400";
  return "border-l-border";
}

function OpportunityCard({
  opp,
  onClick,
}: {
  opp: FunilOpportunityRow;
  onClick: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: opp.id,
    data: { type: "card" },
  });
  const days = daysSince(opp.stageEnteredAt);

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      {...attributes}
      {...listeners}
      onClick={onClick}
      data-funil-draggable
      className={`cursor-pointer rounded-lg border border-l-4 border-border bg-white p-3 shadow-sm transition hover:border-brand ${cardBorderColor(
        opp
      )} ${isDragging ? "opacity-40" : ""}`}
    >
      <p className="truncate text-sm font-medium text-ink">{opp.companyName}</p>
      {opp.contactName && <p className="truncate text-xs text-muted">{opp.contactName}</p>}
      {(opp.contactWhatsapp || opp.contactPhone) && (
        <a
          href={whatsappLink((opp.contactWhatsapp ?? opp.contactPhone) as string)}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5 block truncate text-xs text-brand hover:underline"
        >
          {opp.contactWhatsapp ?? opp.contactPhone}
        </a>
      )}
      {opp.serviceInterest && (
        <p className="mt-1 truncate text-xs text-muted">{opp.serviceInterest}</p>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-sm font-medium text-ink">{formatCurrency(opp.estimatedValue)}</span>
        {opp.temperature && (
          <StatusPill
            label={TEMPERATURE_LABELS[opp.temperature]}
            tone={TEMPERATURE_TONE[opp.temperature]}
            className="text-[10px]"
          />
        )}
      </div>
      <div className="mt-2 flex items-center justify-between text-[11px] text-muted">
        <span>{days}d na etapa</span>
        {opp.responsibleName && (
          <span className="flex items-center gap-1">
            {opp.responsiblePhoto ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img loading="lazy" decoding="async" src={opp.responsiblePhoto} alt="" className="h-4 w-4 rounded-full object-cover" />
            ) : (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-surface2 text-[8px]">
                {opp.responsibleName.slice(0, 1)}
              </span>
            )}
          </span>
        )}
      </div>
    </div>
  );
}

function StageColumn({
  stage,
  opportunities,
  onCardClick,
}: {
  stage: CrmStage;
  opportunities: FunilOpportunityRow[];
  onCardClick: (opp: FunilOpportunityRow) => void;
}) {
  const { setNodeRef } = useDroppable({ id: stage.id });
  const total = opportunities.reduce((sum, o) => sum + (o.estimatedValue ?? 0), 0);

  return (
    <div
      className="flex w-72 shrink-0 flex-col rounded-xl border border-t-4 border-border bg-surface p-3"
      style={{ borderTopColor: stage.color }}
    >
      <div className="flex items-center justify-between px-1 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <StageColorPicker stageId={stage.id} color={stage.color} />
          <h3 className="truncate text-sm font-medium text-ink">{stage.name}</h3>
        </div>
        <span className="text-xs text-muted">{opportunities.length}</span>
      </div>
      <p className="px-1 pb-2 text-[11px] text-muted">{formatCurrency(total)}</p>
      <SortableContext items={opportunities.map((o) => o.id)} strategy={verticalListSortingStrategy}>
        <div ref={setNodeRef} className="flex min-h-[40px] flex-1 flex-col gap-2">
          {opportunities.map((opp) => (
            <OpportunityCard key={opp.id} opp={opp} onClick={() => onCardClick(opp)} />
          ))}
        </div>
      </SortableContext>
    </div>
  );
}

export function FunilBoard({
  stages,
  opportunities,
  teamMembers,
  pipelines,
  selectedPipelineId,
  canManage,
}: {
  stages: CrmStage[];
  opportunities: FunilOpportunityRow[];
  teamMembers: TeamMemberOption[];
  pipelines: PipelineOption[];
  selectedPipelineId: string;
  canManage: boolean;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [managing, setManaging] = useState<"stages" | "pipelines" | null>(null);
  const [items, setItems] = useState(opportunities);
  // Bug real ("editei e não salvou"): sem isso, o board ficava preso
  // nos dados do primeiro carregamento pra sempre — useState só usa o
  // valor inicial na primeira renderização, então mesmo depois de
  // salvar uma edição (o servidor revalida a página e manda `opportunities`
  // atualizado) o card continuava mostrando os valores antigos até um
  // reload manual da página inteira.
  useEffect(() => {
    setItems(opportunities);
  }, [opportunities]);
  // ?novo=1 (atalho do Diário) abre direto o formulário de nova oportunidade.
  const [modalState, setModalState] = useState<FunilOpportunityRow | null | undefined>(
    searchParams.get("novo") === "1" ? null : undefined
  );
  const [lostTarget, setLostTarget] = useState<FunilOpportunityRow | null>(null);
  // Venda fechada → pergunta como será o pagamento (recorrência ou projeto).
  const [closedDeal, setClosedDeal] = useState<FunilOpportunityRow | null>(null);
  const [moveError, setMoveError] = useState<string | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  // Etapa de perda = a de kind `lost` (o nome pode ser trocado).
  const lostStage = stages.find((s) => s.kind === "lost");

  // Mesma dinâmica já existente em Demandas (Kanban): clicar e
  // arrastar em qualquer área vazia do board (fundo, cabeçalho de
  // etapa, espaço entre cards) rola horizontalmente, sem depender só
  // da barra de rolagem embaixo. Só ativa quando o clique começa fora
  // de um card/elemento clicável de verdade, pra não brigar com o
  // drag-and-drop dos cards.
  const boardScrollRef = useRef<HTMLDivElement>(null);
  const panState = useRef<{ startX: number; scrollLeft: number } | null>(null);
  const [isPanning, setIsPanning] = useState(false);

  function handleBoardPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const target = e.target as HTMLElement;
    if (target.closest("[data-funil-draggable], button, a, input, textarea, select")) return;
    const el = boardScrollRef.current;
    if (!el) return;
    panState.current = { startX: e.clientX, scrollLeft: el.scrollLeft };
    setIsPanning(true);
  }

  function handleBoardPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!panState.current || !boardScrollRef.current) return;
    const dx = e.clientX - panState.current.startX;
    boardScrollRef.current.scrollLeft = panState.current.scrollLeft - dx;
  }

  function stopPanning() {
    panState.current = null;
    setIsPanning(false);
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over) return;

    const opp = items.find((o) => o.id === active.id);
    if (!opp) return;

    const overStage = stages.find((s) => s.id === over.id);
    const overOpp = items.find((o) => o.id === over.id);
    const targetStageId = overStage?.id ?? overOpp?.stageId;
    if (!targetStageId || targetStageId === opp.stageId) return;

    if (lostStage && targetStageId === lostStage.id) {
      setLostTarget(opp);
      return;
    }

    const previousStageId = opp.stageId;
    setItems((prev) => prev.map((o) => (o.id === opp.id ? { ...o, stageId: targetStageId } : o)));
    moveOpportunityStage(opp.id, targetStageId).then((result) => {
      if (result?.error) {
        // Desfaz o movimento otimista na tela — sem isso o card ficava
        // "preso" na coluna nova mesmo com o banco não tendo mudado,
        // sem erro nenhum visível.
        setItems((prev) =>
          prev.map((o) => (o.id === opp.id ? { ...o, stageId: previousStageId } : o))
        );
        setMoveError(result.error);
      } else if (stages.find((st) => st.id === targetStageId)?.kind === "won") {
        setClosedDeal(opp);
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {pipelines.length > 1 && (
            <select
              value={selectedPipelineId}
              onChange={(e) => router.push(`/crm/funil?pipeline=${e.target.value}`)}
              className="rounded-lg border border-border bg-surface2 px-2.5 py-1.5 text-sm font-medium text-ink outline-none focus:border-brand"
              aria-label="Pipeline"
            >
              {pipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
          <p className="text-sm text-muted">Arraste os cards entre as etapas.</p>
        </div>
        <div className="flex items-center gap-2">
          {canManage && (
            <>
              <button
                type="button"
                onClick={() => setManaging("stages")}
                className="rounded-lg border border-border px-3 py-2 text-sm text-ink transition hover:border-brand"
              >
                Etapas
              </button>
              <button
                type="button"
                onClick={() => setManaging("pipelines")}
                className="rounded-lg border border-border px-3 py-2 text-sm text-ink transition hover:border-brand"
              >
                Pipelines
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setModalState(null)}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white transition hover:bg-brand/90"
          >
            + Nova oportunidade
          </button>
        </div>
      </div>

      {moveError && (
        <p className="mb-3 rounded-lg bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
          Não deu pra mover: {moveError}
        </p>
      )}

      <DndContext sensors={sensors} collisionDetection={boardCollisionDetection} onDragEnd={handleDragEnd}>
        <div
          ref={boardScrollRef}
          onPointerDown={handleBoardPointerDown}
          onPointerMove={handleBoardPointerMove}
          onPointerUp={stopPanning}
          onPointerLeave={stopPanning}
          className={`flex gap-3 overflow-x-auto pb-4 ${
            isPanning ? "cursor-grabbing select-none" : "cursor-grab"
          }`}
        >
          {stages.map((stage) => (
            <StageColumn
              key={stage.id}
              stage={stage}
              opportunities={items.filter((o) => o.stageId === stage.id)}
              onCardClick={(opp) => setModalState(opp)}
            />
          ))}
        </div>
      </DndContext>

      {modalState !== undefined && (
        <OpportunityModal
          opportunity={modalState}
          stages={stages}
          teamMembers={teamMembers}
          onClose={() => setModalState(undefined)}
        />
      )}

      {managing === "stages" && (
        <StageManagerModal
          pipelineId={selectedPipelineId}
          stages={stages}
          cardCountByStage={items.reduce<Record<string, number>>((acc, o) => {
            acc[o.stageId] = (acc[o.stageId] ?? 0) + 1;
            return acc;
          }, {})}
          onClose={() => setManaging(null)}
        />
      )}
      {managing === "pipelines" && (
        <PipelineManagerModal pipelines={pipelines} selectedId={selectedPipelineId} onClose={() => setManaging(null)} />
      )}

      {closedDeal && (
        <ClosedDealModal
          opportunityId={closedDeal.id}
          companyName={closedDeal.companyName}
          defaultValue={closedDeal.estimatedValue}
          onClose={() => setClosedDeal(null)}
        />
      )}

      {lostTarget && (
        <LostOpportunityModal
          opportunity={lostTarget}
          onClose={() => setLostTarget(null)}
          onDone={() => {
            setItems((prev) => prev.filter((o) => o.id !== lostTarget.id));
            setLostTarget(null);
          }}
        />
      )}
    </div>
  );
}
