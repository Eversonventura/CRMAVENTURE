// Envio de e-mail via Resend (opcional). Sem RESEND_API_KEY, ou se o envio
// falhar, nada acontece: nunca bloqueia a ação que disparou o e-mail.
export async function sendCrmEmail(to: string[], subject: string, text: string) {
  const apiKey = process.env.RESEND_API_KEY;
  if (to.length === 0 || !apiKey) return;

  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: process.env.RESEND_FROM_EMAIL || "CRM Aventure <onboarding@resend.dev>",
        to,
        subject,
        text,
      }),
    });
  } catch {
    // best-effort
  }
}
