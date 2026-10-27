"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { createCompanyContactAction, updateCompanyContactAction } from "./actions";
import type { CrmFormState } from "../actions";
import { ModalBackdrop } from "@/components/ModalBackdrop";

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

export function CompanyContactModal({
  company,
  onClose,
}: {
  company?: CompanyEditData | null;
  onClose: () => void;
}) {
  const isEdit = !!company;
  const [state, formAction, pending] = useActionState<CrmFormState, FormData>(
    isEdit ? updateCompanyContactAction : createCompanyContactAction,
    {}
  );
  const prevPending = useRef(pending);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (prevPending.current && !pending && !state.error) onClose();
    prevPending.current = pending;
  }, [pending, state, onClose]);

  const inputClass =
    "w-full rounded-lg border border-border bg-surface2 px-3.5 py-2.5 text-ink outline-none focus:border-brand";

  return (
    <ModalBackdrop dirty={dirty} onClose={onClose}>
      <div className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-xl border border-border bg-white p-6 shadow-xl">
        <h2 className="font-display text-xl font-medium text-ink">
          {isEdit ? "Editar empresa e contato" : "Adicionar empresa e contato"}
        </h2>

        <form action={formAction} onChange={() => setDirty(true)} className="mt-5 space-y-4">
          {isEdit && (
            <>
              <input type="hidden" name="company_id" value={company.id} />
              {company.primaryContact && (
                <input type="hidden" name="contact_id" value={company.primaryContact.id} />
              )}
            </>
          )}

          <div className="space-y-1.5">
            <label className="text-sm text-muted">Empresa *</label>
            <input
              name="company_name"
              required
              defaultValue={company?.name ?? ""}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm text-muted">Segmento</label>
              <input name="segment" defaultValue={company?.segment ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted">Cidade</label>
              <input name="city" defaultValue={company?.city ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted">CNPJ</label>
              <input name="cnpj" defaultValue={company?.cnpj ?? ""} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted">CEP</label>
              <input
                name="postal_code"
                defaultValue={company?.postalCode ?? ""}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted">Site</label>
            <input
              name="website"
              placeholder="https://"
              defaultValue={company?.website ?? ""}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm text-muted">Instagram</label>
              <input
                name="instagram"
                placeholder="@usuario"
                defaultValue={company?.instagram ?? ""}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted">Google Meu Negócio</label>
              <input
                name="google_business_url"
                placeholder="https://"
                defaultValue={company?.googleBusinessUrl ?? ""}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted">Outra rede social</label>
              <input
                name="other_social_url"
                placeholder="https://"
                defaultValue={company?.otherSocialUrl ?? ""}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted">Link (bio/linktree)</label>
              <input
                name="bio_link"
                placeholder="https://"
                defaultValue={company?.bioLink ?? ""}
                className={inputClass}
              />
            </div>
          </div>

          <hr className="border-border" />

          <div className="space-y-1.5">
            <label className="text-sm text-muted">
              Nome do contato{isEdit && company?.primaryContact && " (deixe em branco pra remover)"}
            </label>
            <input
              name="contact_name"
              defaultValue={company?.primaryContact?.name ?? ""}
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label className="text-sm text-muted">Cargo</label>
              <input
                name="contact_role"
                defaultValue={company?.primaryContact?.role_title ?? ""}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted">E-mail</label>
              <input
                name="contact_email"
                type="email"
                defaultValue={company?.primaryContact?.email ?? ""}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted">Telefone</label>
              <input
                name="contact_phone"
                defaultValue={company?.primaryContact?.phone ?? ""}
                className={inputClass}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-sm text-muted">WhatsApp</label>
              <input
                name="contact_whatsapp"
                defaultValue={company?.primaryContact?.whatsapp ?? ""}
                className={inputClass}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm text-muted">Observação interna</label>
            <textarea
              name="internal_notes"
              rows={3}
              placeholder="Só a equipe vê — nunca aparece pro cliente."
              defaultValue={company?.internalNotes ?? ""}
              className="w-full rounded-lg border border-border bg-surface2 px-3.5 py-2.5 text-sm text-ink outline-none focus:border-brand"
            />
          </div>

          {state.error && <p className="text-sm text-brand">{state.error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-border px-4 py-2.5 text-sm text-muted transition hover:text-ink"
            >
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
