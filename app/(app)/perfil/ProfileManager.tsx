"use client";

import { useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { createClient } from "@/lib/supabase/client";
import { setMyPhoto, switchWorkspace, updateMyName } from "@/lib/workspace-actions";

type Role = "administrador" | "gestor" | "vendedor";
type WorkspaceRow = { id: string; name: string; role: Role; isOwner: boolean };

const ROLE_LABELS: Record<Role, string> = { administrador: "Administrador", gestor: "Gestor", vendedor: "Vendedor" };
const MAX_PHOTO_MB = 5;

const input =
  "w-full rounded-lg border border-border bg-surface2 px-3 py-2 text-sm text-ink outline-none focus:border-brand disabled:opacity-60";
const primary = "rounded-lg bg-brand px-3.5 py-2 text-sm font-medium text-white transition hover:bg-brand/90 disabled:opacity-60";
const ghost = "rounded-lg border border-border px-3 py-1.5 text-sm text-muted transition hover:border-brand hover:text-ink disabled:opacity-60";

// Recorta o centro em quadrado e reduz para 256 px (JPEG): foto leve, sem distorcer.
async function resizeToSquare(file: File, size = 256): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Seu navegador não conseguiu processar a imagem.");
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, size, size);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("Não foi possível preparar a foto."))), "image/jpeg", 0.88)
  );
}

export function ProfileManager({
  userId,
  email,
  fullName,
  photoUrl,
  workspaces,
  activeId,
}: {
  userId: string;
  email: string;
  fullName: string;
  photoUrl: string | null;
  workspaces: WorkspaceRow[];
  activeId: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [feedback, setFeedback] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const [name, setName] = useState(fullName);
  const [photo, setPhoto] = useState<string | null>(photoUrl);
  const [uploading, setUploading] = useState(false);

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pwdBusy, setPwdBusy] = useState(false);
  const [pwdMsg, setPwdMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  function ok(text: string) {
    setFeedback({ kind: "ok", text });
  }
  function fail(text: string) {
    setFeedback({ kind: "error", text });
  }

  async function onPickPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setFeedback(null);
    if (!file.type.startsWith("image/")) return fail("Escolha um arquivo de imagem (JPG, PNG ou WebP).");
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) return fail(`A imagem passa de ${MAX_PHOTO_MB} MB.`);

    setUploading(true);
    try {
      const blob = await resizeToSquare(file);
      const supabase = createClient();
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error: upError } = await supabase.storage.from("avatars").upload(path, blob, { contentType: "image/jpeg", upsert: false });
      if (upError) throw new Error(upError.message);
      const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      const saved = await setMyPhoto(url);
      if (saved.error) throw new Error(saved.error);
      // Foto antiga: apaga em segundo plano (não bloqueia se falhar).
      if (photo) {
        const old = photo.split("/avatars/")[1];
        if (old) void supabase.storage.from("avatars").remove([old]);
      }
      setPhoto(url);
      ok("Foto atualizada.");
      router.refresh();
    } catch (err) {
      fail(err instanceof Error ? err.message : "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  function removePhoto() {
    setFeedback(null);
    start(async () => {
      const result = await setMyPhoto(null);
      if (result.error) return fail(result.error);
      const old = photo?.split("/avatars/")[1];
      if (old) void createClient().storage.from("avatars").remove([old]);
      setPhoto(null);
      ok("Foto removida.");
      router.refresh();
    });
  }

  function saveName() {
    setFeedback(null);
    start(async () => {
      const result = await updateMyName(name);
      if (result.error) return fail(result.error);
      ok("Nome atualizado.");
      router.refresh();
    });
  }

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwdMsg(null);
    if (next.length < 8) return setPwdMsg({ kind: "error", text: "A nova senha precisa ter pelo menos 8 caracteres." });
    if (next !== confirm) return setPwdMsg({ kind: "error", text: "A confirmação não é igual à nova senha." });
    if (next === current) return setPwdMsg({ kind: "error", text: "A nova senha precisa ser diferente da atual." });

    setPwdBusy(true);
    const supabase = createClient();
    // Confere a senha atual antes de trocar (quem está com a sessão aberta não pode trocar sem saber a senha).
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password: current });
    if (authError) {
      setPwdBusy(false);
      return setPwdMsg({ kind: "error", text: "A senha atual está incorreta." });
    }
    const { error } = await supabase.auth.updateUser({ password: next });
    setPwdBusy(false);
    if (error) return setPwdMsg({ kind: "error", text: `Não foi possível trocar a senha: ${error.message}` });
    setCurrent("");
    setNext("");
    setConfirm("");
    setPwdMsg({ kind: "ok", text: "Senha alterada." });
  }

  function changeWorkspace(id: string) {
    setFeedback(null);
    start(async () => {
      const result = await switchWorkspace(id);
      if (result.error) return fail(result.error);
      router.refresh();
    });
  }

  const msgClass = (kind: "ok" | "error") =>
    kind === "ok" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-brand/30 bg-brand-soft text-brand";

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <div>
        <h1 className="font-display text-2xl font-medium text-ink">Meu perfil</h1>
        <p className="mt-1.5 text-sm text-muted">Seus dados de acesso, sua foto e as contas (empresas) em que você trabalha.</p>
      </div>

      {feedback && (
        <p role="status" className={`rounded-lg border px-3.5 py-2.5 text-sm ${msgClass(feedback.kind)}`}>
          {feedback.text}
        </p>
      )}

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-medium text-ink">Dados pessoais</h2>
        <div className="mt-4 flex flex-wrap items-center gap-5">
          <Avatar name={name || email} src={photo} size={96} />
          <div className="space-y-2">
            <input ref={fileRef} type="file" accept="image/*" onChange={onPickPhoto} className="hidden" />
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={uploading || pending} onClick={() => fileRef.current?.click()} className={primary}>
                {uploading ? "Enviando..." : photo ? "Trocar foto" : "Enviar foto"}
              </button>
              {photo && (
                <button type="button" disabled={uploading || pending} onClick={removePhoto} className={ghost}>
                  Remover foto
                </button>
              )}
            </div>
            <p className="text-xs text-muted">JPG, PNG ou WebP até {MAX_PHOTO_MB} MB. A foto é recortada em quadrado.</p>
          </div>
        </div>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted">Nome</span>
            <div className="flex gap-2">
              <input value={name} onChange={(e) => setName(e.target.value)} className={input} />
              <button
                type="button"
                disabled={pending || !name.trim() || name.trim() === fullName}
                onClick={saveName}
                className={primary}
              >
                Salvar
              </button>
            </div>
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted">E-mail de acesso</span>
            <input value={email} disabled readOnly className={input} />
            <span className="block text-xs text-muted">É o login e o e-mail em que você recebe convites de contas.</span>
          </label>
        </div>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-medium text-ink">Minhas contas (empresas)</h2>
        <p className="mt-1 text-xs text-muted">
          Cada conta tem os próprios leads, funil e metas. Você pode participar de várias e alternar entre elas.
        </p>
        <ul className="mt-3 divide-y divide-border rounded-lg border border-border bg-white">
          {workspaces.map((w) => {
            const active = w.id === activeId;
            return (
              <li key={w.id} className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-3 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium text-ink">
                    {w.name}
                    {active && <span className="ml-2 rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-normal text-brand">conta ativa</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {ROLE_LABELS[w.role]} · {w.isOwner ? "você é o dono" : "você foi convidado"}
                  </p>
                </div>
                {!active && (
                  <button type="button" disabled={pending} onClick={() => changeWorkspace(w.id)} className={ghost}>
                    Usar esta conta
                  </button>
                )}
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">
          Para convidar pessoas ou criar outra conta, vá em{" "}
          <Link href="/conta" className="text-brand hover:underline">
            Compartilhar conta
          </Link>
          .
        </p>
      </section>

      <section className="rounded-xl border border-border bg-surface p-5">
        <h2 className="font-display text-base font-medium text-ink">Senha</h2>
        <form onSubmit={changePassword} className="mt-3 grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted">Senha atual</span>
            <input type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={input} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted">Nova senha (mín. 8)</span>
            <input type="password" autoComplete="new-password" required value={next} onChange={(e) => setNext(e.target.value)} className={input} />
          </label>
          <label className="space-y-1 text-sm">
            <span className="text-xs text-muted">Repetir nova senha</span>
            <input type="password" autoComplete="new-password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={input} />
          </label>
          <div className="sm:col-span-3">
            <button type="submit" disabled={pwdBusy} className={primary}>
              {pwdBusy ? "Alterando..." : "Alterar senha"}
            </button>
          </div>
        </form>
        {pwdMsg && (
          <p role="status" className={`mt-3 rounded-lg border px-3.5 py-2.5 text-sm ${msgClass(pwdMsg.kind)}`}>
            {pwdMsg.text}
          </p>
        )}
      </section>
    </div>
  );
}
