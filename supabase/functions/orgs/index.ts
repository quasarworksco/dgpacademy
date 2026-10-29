// =========================================================
// DGP Empresas — acciones del servidor (equipo DGP con permiso 'empresas' o gerente de una empresa que se configura sola)
//   invite     → envía UNA invitación por correo a un empleado (no se reintenta si falla)
//   sop_draft  → redacta con IA (Groq) el borrador de un SOP o capacitación en el formato de la plataforma
// La contraseña SMTP y la API key de Groq se leen de private.secrets: nunca llegan al navegador.
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import postgres from "npm:postgres@3.4.5";
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const SITE = "https://academy.dgpglobalgroup.com";
const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3 });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function setting(key: string) { const [r] = await sql`select value from public.settings where key = ${key}`; return (r?.value ?? {}) as Record<string, any>; }
async function secret(key: string) { const [r] = await sql`select value from private.secrets where key = ${key}`; return r?.value as string | undefined; }

async function sendMail(to: string, subject: string, html: string) {
  const cfg = await setting("email");
  const pass = await secret("smtp_password");
  if (!pass || !cfg.from_email) throw new Error("Falta configurar el correo en Configuración → Correo");
  const client = new SMTPClient({ connection: { hostname: cfg.smtp_host || "smtp.gmail.com", port: Number(cfg.smtp_port) || 465, tls: true, auth: { username: cfg.from_email, password: pass } } });
  try { await client.send({ from: `${cfg.from_name || "DGP Academy"} <${cfg.from_email}>`, to, subject, html, content: "auto" }); }
  finally { await client.close(); }
}

function shell(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f8fc;font-family:Helvetica,Arial,sans-serif;color:#0a1430">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc;padding:32px 12px"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3e8f2">
  <tr><td style="background:#0a1430;padding:20px 28px;color:#fff;font-size:18px;font-weight:700">DGP Academy <span style="font-weight:400;color:#a5b4fc">× Moya &amp; Company</span></td></tr>
  <tr><td style="padding:28px">${inner}</td></tr>
  <tr><td style="padding:16px 28px;border-top:1px solid #e3e8f2;color:#5d6982;font-size:12px">DGP Global Group · <a href="${SITE}" style="color:#1a56e8">academy.dgpglobalgroup.com</a></td></tr>
  </table></td></tr></table></body></html>`;
}

const PREFERRED = ["openai/gpt-oss-120b", "llama-3.3-70b-versatile", "meta-llama/llama-4-maverick-17b-128e-instruct", "qwen/qwen3-32b", "openai/gpt-oss-20b"];
async function groq(messages: { role: string; content: string }[], maxTokens = 1800) {
  const key = await secret("groq_api_key");
  if (!key) throw new Error("Falta la API key de Groq en Configuración → IA");
  const cfg = await setting("ai");
  const models = [cfg.model, ...PREFERRED].filter((m, i, a) => m && a.indexOf(m) === i);
  let last = "Groq no respondió";
  for (const model of models.slice(0, 3)) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.4, max_tokens: maxTokens }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return String(data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim();
    last = data.error?.message || `Groq respondió ${res.status}`;
    if (!/does not exist|decommissioned|not have access|not found/i.test(last)) break;
  }
  throw new Error(last);
}

const SOP_PROMPT = `Eres consultor de procesos de DGP Empresas. Redactas procedimientos operativos estándar (SOPs) y capacitaciones internas claras para pequeñas empresas cuyos empleados no son técnicos.
Escribe en español neutro, frases cortas, tono profesional y cercano. Usa EXACTAMENTE este formato de texto plano (sin markdown de negritas ni tablas):
# Objetivo
Una o dos frases.
# Alcance y responsables
- puntos
# Materiales o herramientas
- puntos (si aplica)
# Pasos
1. Paso concreto y verificable
2. ...
> Nota importante o advertencia de seguridad (si aplica)
# Errores comunes que debes evitar
- puntos
# Cómo saber que se hizo bien
- criterios verificables
No inventes datos específicos (precios, nombres, marcas) que no te den; si falta información usa [completar].`;

const SOP_PROMPT_EN = `You are a process consultant at DGP Business. You write clear standard operating procedures (SOPs) and internal trainings for small businesses whose employees are not technical.
Write in plain English, short sentences, professional and friendly tone. Use EXACTLY this plain-text format (no bold markdown or tables):
# Objective
One or two sentences.
# Scope and owners
- bullets
# Materials or tools
- bullets (if applicable)
# Steps
1. Concrete, verifiable step
2. ...
> Important note or safety warning (if applicable)
# Common mistakes to avoid
- bullets
# How to know it was done right
- verifiable criteria
Don't invent specific data (prices, names, brands) you weren't given; if information is missing use [complete].`;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Inicia sesión" }, 401);
    const body = await req.json();
    // Equipo DGP, o el gerente de una empresa que se configura sola (socio piloto) para su propia empresa
    const { data: allowed } = await supa.rpc("can_manage_org", { o: body.org_id });
    if (!allowed) return json({ error: "Sin permiso para esta empresa" }, 403);

    if (body.action === "invite") {
      const email = String(body.email || "").toLowerCase().trim();
      const [m] = await sql`select m.*, o.name as org_name, o.status as org_status, p.title as position, l.name as level
        from public.org_members m join public.orgs o on o.id = m.org_id
        left join public.org_positions p on p.id = m.position_id left join public.org_levels l on l.id = m.level_id
        where m.org_id = ${body.org_id} and m.email = ${email}`;
      if (!m) return json({ error: "Empleado no encontrado" }, 404);
      if (!m.active || m.org_status !== "activo") return json({ error: "La persona o la empresa no están activas" }, 400);
      const name = String(m.full_name || "").split(" ")[0];
      const link = `${SITE}/?registro=${encodeURIComponent(email)}`;
      const btn = (label: string) => `<a href="${link}" style="display:inline-block;background:#1a56e8;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${label}</a>`;
      const org = esc(m.org_name), pos = m.position ? esc(m.position) : "", lvl = m.level ? esc(m.level) : "";
      // Correo bilingüe: inglés primero (idioma principal) y luego español.
      // Se envía una sola vez por clic; si el correo no existe, no se vuelve a intentar
      await sendMail(email, `${m.org_name} invited you to its training platform · te invita a su plataforma de capacitación — DGP Academy`, shell(`
        <p style="margin:0 0 6px;font-size:16px">Hi${name ? " " + esc(name) : ""},</p>
        <p style="margin:0 0 16px;font-size:15px;color:#3d4a63;line-height:1.6"><strong>${org}</strong> gave you access to its training platform on DGP Academy. There you'll find ${pos ? "your role description (<strong>" + pos + "</strong>), " : ""}your team's procedures and trainings${lvl ? " for the <strong>" + lvl + "</strong> level" : ""}.</p>
        <p style="margin:0 0 8px;font-size:15px;font-weight:700">To get in:</p>
        <ol style="margin:0 0 18px;padding-left:20px;font-size:15px;color:#3d4a63;line-height:1.7">
          <li>Create your account with this same email: <strong>${esc(email)}</strong></li>
          <li>Confirm your email and go to your campus</li>
          <li>Open the <strong>My company</strong> section</li>
        </ol>
        <p style="margin:0 0 12px">${btn("Create my account")}</p>
        <p style="margin:0 0 24px;font-size:13px;color:#5d6982">Already have an account with this email? Just log in.</p>
        <hr style="border:0;border-top:1px solid #e3e8f2;margin:0 0 22px">
        <p style="margin:0 0 6px;font-size:16px">Hola${name ? " " + esc(name) : ""},</p>
        <p style="margin:0 0 16px;font-size:15px;color:#3d4a63;line-height:1.6"><strong>${org}</strong> te dio acceso a su plataforma de capacitación en DGP Academy. Ahí encontrarás ${pos ? "la descripción de tu cargo (<strong>" + pos + "</strong>), " : ""}los procedimientos y capacitaciones de tu equipo${lvl ? " para el nivel <strong>" + lvl + "</strong>" : ""}.</p>
        <p style="margin:0 0 8px;font-size:15px;font-weight:700">Para entrar:</p>
        <ol style="margin:0 0 18px;padding-left:20px;font-size:15px;color:#3d4a63;line-height:1.7">
          <li>Crea tu cuenta con este mismo correo: <strong>${esc(email)}</strong></li>
          <li>Confirma tu correo y entra a tu campus</li>
          <li>Abre la sección <strong>Mi empresa</strong></li>
        </ol>
        <p style="margin:0 0 12px">${btn("Crear mi cuenta")}</p>
        <p style="margin:0;font-size:13px;color:#5d6982">Si ya tienes cuenta con este correo, solo inicia sesión.</p>`));
      await sql`update public.org_members set invited_at = now() where org_id = ${body.org_id} and email = ${email}`;
      return json({ ok: true });
    }

    if (body.action === "sop_draft") {
      const title = String(body.title || "").trim().slice(0, 160);
      if (title.length < 3) return json({ error: body.lang === "en" ? "Write the document title" : "Escribe el título del documento" }, 400);
      const [o] = await sql`select name, industry from public.orgs where id = ${body.org_id}`;
      const en = body.lang === "en";
      const kind = en ? (body.kind === "capacitacion" ? "internal training" : "SOP (standard operating procedure)") : (body.kind === "capacitacion" ? "capacitación interna" : "SOP (procedimiento operativo estándar)");
      const ctx = [`Tipo: ${kind}`, `Título: ${title}`, o ? `Empresa: ${o.name}${o.industry ? " (" + o.industry + ")" : ""}` : "",
        body.area ? `Área: ${String(body.area).slice(0, 80)}` : "", body.notes ? `Información del cliente:\n${String(body.notes).slice(0, 3000)}` : ""].filter(Boolean).join("\n");
      const text = await groq([{ role: "system", content: en ? SOP_PROMPT_EN : SOP_PROMPT }, { role: "user", content: ctx }]);
      return json({ ok: true, body: text.replace(/\*\*/g, "") });
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "Error" }, 400);
  }
});
