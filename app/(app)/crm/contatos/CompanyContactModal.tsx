"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { updateCompanyContactAction } from "./actions";
import type { CrmFormState } from "../actions";
import { ModalBackdrop } from "@/components/ModalBackdrop";
import { useCrmSettings } from "../CrmSettingsContext";
import { showCompanyOnlineFields } from "../business";

export type CompanyEditData = {
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
  primaryContact: {
    id: string;
    name: string;
    role_title: string | null;
    phone: string | null;
    whatsapp: string | null;
    email: string | null;
  } | null;
};

// Edição simples de um contato que ainda NÃO tem oportunidade no fluxo. Contatos com
// oportunidade (e o cadastro de novos) usam o mesmo formulário do Fluxo
// (funil/OpportunityModal.tsx), para o dado ser o mesmo nas duas telas.
export function CompanyContactModal({ company, onClose }: { company: CompanyEditData; onClose: () => void }) {
  const settings = useCrmSettings();
  const isB2C = settings.businessModel === "b2c";
  const showOnline = showCompanyOnlineFields(settings);
  const [state, formAction, pending] = useActionState<CrmFormState, FormData>(updateCompanyContactAction, {});
  const prevPending = useRef(pending);
  const [dirty, setDirty] = useState(false);
  // B2C: a "empresa" interna tem o mesmo nome do contato.
  const [contactName, setContactName] = useState(company.primaryContact?.name ?? company.name);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) onClose();
    prevPending.current = pending;
  }, [pending, state, onClose]);

  const inputClass = "w-full rounded-lg border border-border bg-surface2 px-3.5 py-2.5 text-ink outline-none focus:border-brand";
  const label = "text-sm text-muted";

  return (
    <ModalBackdrop dirty={dirty} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-medium text-ink">{isB2C ? "Editar contato" : "Editar empresa e contato"}</h2>

        <form action={formAction} onChange={() => setDirty(true)} className="mt-5 space-y-4">
          <input type="hidden" name="company_id" value={company.id} />
          {company.primaryContact && <input type="hidden" name="contact_id" value={company.primaryContact.id} />}

          {isB2C ? (
            <>
              <input type="hidden" name="company_name" value={contactName} />
              <div className="space-y-1.5">
                <label className={label}>Nome do contato *</label>
                <input name="contact_name" required value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} />
              </div>
            </>
          ) : (
            <>
              <div className="space-y-1.5">
                <label className={label}>Empresa *</label>
                <input name="company_name" required defaultValue={company.name} className={inputClass} />
              </div>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <label className={label}>Segmento</label>
                  <input name="segment" defaultValue={company.segment ?? ""} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>Cidade</label>
                  <input name="city" defaultValue={company.city ?? ""} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>CNPJ</label>
                  <input name="cnpj" defaultValue={company.cnpj ?? ""} className={inputClass} />
                </div>
                <div className="space-y-1.5">
                  <label className={label}>CEP</label>
                  <input name="postal_code" defaultValue={company.postalCode ?? ""} className={inputClass} />
                </div>
              </div>
              {showOnline && (
                <>
                  <div className="space-y-1.5">
                    <label className={label}>Site</label>
                    <input name="website" placeholder="https://" defaultValue={company.website ?? ""} className={inputClass} />
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <label className={label}>Instagram</label>
                      <input name="instagram" placeholder="@usuario" defaultValue={company.instagram ?? ""} className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={label}>Google Meu Negócio</label>
                      <input name="google_business_url" placeholder="https://" defaultValue={company.googleBusinessUrl ?? ""} className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={label}>Outra rede social</label>
                      <input name="other_social_url" placeholder="https://" defaultValue={company.otherSocialUrl ?? ""} className={inputClass} />
                    </div>
                    <div className="space-y-1.5">
                      <label className={label}>Link (bio/linktree)</label>
                      <input name="bio_link" placeholder="https://" defaultValue={company.bioLink ?? ""} className={inputClass} />
                    </div>
                  </div>
                </>
              )}
              <hr className="border-border" />
              <div className="space-y-1.5">
                <label className={label}>Nome do contato{company.primaryContact && " (deixe em branco pra remover)"}</label>
                <input name="contact_name" defaultValue={company.primaryContact?.name ?? ""} className={inputClass} />
              </div>
            </>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {!isB2C && (
              <div className="space-y-1.5">
                <label className={label}>Cargo</label>
                <input name="contact_role" defaultValue={company.primaryContact?.role_title ?? ""} className={inputClass} />
              </div>
            )}
            <div className="space-y-1.5">
              <label className={label}>WhatsApp</label>
              <input name="contact_whatsapp" defaultValue={company.primaryContact?.whatsapp ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={label}>E-mail</label>
              <input name="contact_email" type="email" defaultValue={company.primaryContact?.email ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className={label}>Telefone</label>
              <input name="contact_phone" defaultValue={company.primaryContact?.phone ?? ""} className={inputClass} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className={label}>Observação interna</label>
            <textarea
              name="internal_notes"
              rows={3}
              placeholder="Só a equipe vê — nunca aparece pro cliente."
              defaultValue={company.internalNotes ?? ""}
              className="w-full rounded-lg border border-border bg-surface2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand"
            />
          </div>

          {state.error && <p className="text-sm text-brand">{state.error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition hover:text-ink">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60"
            >
              {pending ? "Salvando..." : "Salvar"}
            </button>
          </div>
        </form>
      </div>
    </ModalBackdrop>
  );
}
