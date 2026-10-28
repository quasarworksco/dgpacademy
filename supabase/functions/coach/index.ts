// =========================================================
// DGP Academy — coach con IA (Groq)
// Analiza las respuestas de los ejercicios de libros y cursos como un experto
// en marketing, IA, negocios y desarrollo personal / inteligencia emocional.
// La API key de Groq se guarda en Configuración → IA y nunca llega al navegador.
//   analyze → analiza un ejercicio guardado (todos; sin membresía hay pocos al mes)
//   chat    → coach de negocio adaptado a la encuesta del miembro (solo membresía)
//   test    → (admin) comprueba que la API key funciona
// Límite mensual: el del plan (plans.ai_monthly) o settings.ai.free_monthly sin membresía.
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 3 });
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });

// Modelos preferidos en orden; si el configurado ya no existe en Groq, se usa el primero disponible
const PREFERRED = ["llama-3.3-70b-versatile", "openai/gpt-oss-120b", "meta-llama/llama-4-maverick-17b-128e-instruct",
  "qwen/qwen3-32b", "openai/gpt-oss-20b", "llama-3.1-8b-instant"];

async function pickModel(key: string, failed: string) {
  const res = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` } });
  const data = await res.json().catch(() => ({}));
  const ids: string[] = (data.data || []).filter((m: any) => m.active !== false).map((m: any) => m.id);
  const model = PREFERRED.find((m) => m !== failed && ids.includes(m)) ||
    ids.find((m) => m !== failed && !/whisper|guard|tts|playai|orpheus|compound/i.test(m));
  if (!model) return null;
  await sql`update public.settings set value = jsonb_set(value, '{model}', to_jsonb(${model}::text)) where key = 'ai'`;
  return model;
}

async function groq(messages: { role: string; content: string }[], maxTokens = 900) {
  const [k] = await sql`select value from private.secrets where key = 'groq_api_key'`;
  if (!k?.value) throw new Error("Falta la API key de Groq en Configuración → IA");
  const [cfg] = await sql`select value from public.settings where key = 'ai'`;
  let model = cfg?.value?.model || PREFERRED[0];
  for (let attempt = 0; attempt < 2; attempt++) {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${k.value}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model, messages, temperature: 0.6, max_tokens: maxTokens }),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) return { text: String(data.choices?.[0]?.message?.content || "").replace(/<think>[\s\S]*?<\/think>/g, "").trim(), model };
    const msg = data.error?.message || `Groq respondió ${res.status}`;
    const gone = data.error?.code === "model_not_found" || data.error?.code === "model_decommissioned" || /does not exist|decommissioned|not have access/i.test(msg);
    if (attempt === 0 && gone) {
      const next = await pickModel(k.value, model);
      if (next) { model = next; continue; }
    }
    throw new Error(msg);
  }
  throw new Error("Groq no respondió");
}

const SYSTEM = {
  es: `Eres el coach de DGP Academy: experto en marketing digital, inteligencia artificial aplicada a negocios, emprendimiento, finanzas personales, desarrollo personal e inteligencia emocional. Hablas en español neutro, cálido y directo, como un mentor que cree en la persona.
Analiza las respuestas del estudiante al ejercicio. Estructura tu respuesta así, en texto simple con títulos cortos (sin markdown de tablas):
1. Lo que veo en ti: 2 o 3 observaciones concretas basadas en lo que escribió.
2. Tu fortaleza: una fortaleza clara que se nota en sus respuestas.
3. Lo que te puede frenar: un punto ciego o bloqueo, dicho con empatía.
4. Tu siguiente paso: 3 acciones concretas y pequeñas para esta semana, conectadas con su negocio o proyecto si lo menciona.
5. Una frase para recordar.
Máximo 350 palabras. No inventes datos que no estén en sus respuestas. No des consejos médicos, legales ni financieros personalizados; si detectas angustia seria, sugiere con cariño hablar con un profesional.`,
  en: `You are the DGP Academy coach: an expert in digital marketing, AI for business, entrepreneurship, personal finance, personal growth and emotional intelligence. You write in warm, direct English, like a mentor who believes in the person.
Analyze the student's answers to the exercise. Structure your reply like this, in plain text with short headings (no tables):
1. What I see in you: 2 or 3 specific observations based on what they wrote.
2. Your strength: one clear strength that shows in their answers.
3. What could hold you back: one blind spot or block, said with empathy.
4. Your next step: 3 small, concrete actions for this week, tied to their business or project if they mention it.
5. A line to remember.
Maximum 350 words. Don't invent facts that aren't in their answers. Don't give medical, legal or personalized financial advice; if you notice serious distress, kindly suggest talking to a professional.`,
};

const CHAT = {
  es: `Eres el Coach IA de DGP Academy, asesor personal del miembro: experto en marketing digital, ventas, redes sociales, IA aplicada a negocios, finanzas para emprendedores, desarrollo personal e inteligencia emocional. Conoces su negocio por la encuesta que te damos. Responde en español, cálido y práctico: ideas concretas que pueda aplicar hoy en su negocio, ejemplos de textos o publicaciones cuando ayuden, y pasos numerados. Máximo 300 palabras salvo que pida algo largo. Si pide algo que el equipo de DGP hace (flyers, páginas web, asesorías), recuérdale que puede pedirlo desde su membresía. No des asesoría legal, médica ni fiscal específica.`,
  en: `You are the DGP Academy AI Coach, the member's personal advisor: an expert in digital marketing, sales, social media, AI for business, finances for entrepreneurs, personal growth and emotional intelligence. You know their business from the survey we give you. Reply in English, warm and practical: concrete ideas they can apply today, sample captions or posts when useful, and numbered steps. Maximum 300 words unless they ask for something long. If they ask for something the DGP team does (flyers, websites, advisory sessions), remind them they can request it from their membership. No specific legal, medical or tax advice.`,
};

// Comprueba el límite del mes (el uso se cuenta solo si la IA respondió)
async function checkQuota(userId: string, isAdmin: boolean) {
  const [q] = await sql`
    select coalesce((select pl.ai_monthly from public.plans pl where pl.id = public.member_plan(${userId})),
                    (select (value->>'free_monthly')::int from public.settings where key = 'ai'), 3) as lim,
           coalesce((select sum(n) from private.ai_usage where user_id = ${userId} and day >= date_trunc('month', current_date)), 0) as used`;
  if (!isAdmin && Number(q.used) >= Number(q.lim)) {
    throw new Error("Usaste todas las consultas de IA de este mes. Sube de plan o vuelve el próximo mes.");
  }
}
async function addUse(userId: string) {
  await sql`insert into private.ai_usage (user_id, day, n) values (${userId}, current_date, 1)
    on conflict (user_id, day) do update set n = private.ai_usage.n + 1`;
}

async function profileContext(userId: string) {
  const [bp] = await sql`select * from public.business_profiles where user_id = ${userId}`;
  if (!bp) return "";
  return [
    `Tipo: ${bp.kind === "business" ? "negocio" : "marca personal / uso personal"}`,
    bp.business_name && `Nombre: ${bp.business_name}`, bp.industry && `Rubro: ${bp.industry}`,
    bp.description && `Ofrece: ${bp.description}`, bp.city && `Zona: ${bp.city}`, bp.stage && `Etapa: ${bp.stage}`,
    bp.audience && `Cliente ideal: ${bp.audience}`, (bp.goals || []).length && `Objetivos: ${(bp.goals || []).join(", ")}`,
    (bp.channels || []).length && `Canales: ${(bp.channels || []).join(", ")}`, bp.tone && `Estilo de marca: ${bp.tone}`,
  ].filter(Boolean).join("\n");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Inicia sesión" }, 401);
    const [prof] = await sql`select is_admin, full_name, lang from public.profiles where id = ${user.id}`;
    const body = await req.json();

    if (body.action === "test") {
      if (!prof?.is_admin) return json({ error: "Solo administradores" }, 403);
      const out = await groq([{ role: "user", content: "Responde solo: OK" }], 5);
      return json({ ok: true, reply: out.text, model: out.model });
    }

    if (body.action === "analyze") {
      const [cfg] = await sql`select value from public.settings where key = 'ai'`;
      if (cfg?.value?.enabled === false) return json({ error: "El coach con IA está desactivado" }, 400);
      const [row] = await sql`select * from public.exercise_answers where user_id = ${user.id} and product_id = ${body.product_id} and exercise_id = ${body.exercise_id}`;
      if (!row) return json({ error: "Guarda primero tus respuestas" }, 404);
      await checkQuota(user.id, !!prof?.is_admin);

      const lang = body.lang === "en" || prof?.lang === "en" ? "en" : "es";
      const [bp] = await sql`select kind, business_name, industry, description, stage, goals from public.business_profiles where user_id = ${user.id}`;
      const answers = Object.entries(row.answers || {}).map(([q, a]) => `• ${String(q).slice(0, 300)}\n  ${String(a).slice(0, 1500)}`).join("\n\n");
      const context = [
        `Ejercicio: ${String(body.title || row.exercise_id).slice(0, 200)}`,
        prof?.full_name ? `Nombre: ${String(prof.full_name).split(" ")[0]}` : "",
        bp ? `Perfil: ${bp.kind === "business" ? "negocio" : "personal"} · ${bp.business_name || ""} · ${bp.industry || ""} · ${bp.description || ""} · etapa ${bp.stage || ""}` : "",
      ].filter(Boolean).join("\n");
      const reply = (await groq([
        { role: "system", content: SYSTEM[lang] },
        { role: "user", content: `${context}\n\nRespuestas del estudiante:\n${answers}` },
      ])).text;
      await addUse(user.id);
      await sql`update public.exercise_answers set feedback = ${reply}, feedback_at = now()
        where user_id = ${user.id} and product_id = ${body.product_id} and exercise_id = ${body.exercise_id}`;
      return json({ ok: true, feedback: reply });
    }
    if (body.action === "chat") {
      const [cfg] = await sql`select value from public.settings where key = 'ai'`;
      if (cfg?.value?.enabled === false) return json({ error: "El coach con IA está desactivado" }, 400);
      const [mp] = await sql`select public.member_plan(${user.id}) as plan`;
      if (!mp.plan && !prof?.is_admin) return json({ error: "El Coach IA de negocio es parte de la membresía" }, 403);
      const text = String(body.message || "").trim().slice(0, 2000);
      if (text.length < 2) return json({ error: "Escribe tu pregunta" }, 400);
      await checkQuota(user.id, !!prof?.is_admin);
      const lang = body.lang === "en" || prof?.lang === "en" ? "en" : "es";
      const history = await sql`select role, content from public.coach_messages where user_id = ${user.id} order by created_at desc limit 10`;
      const ctx = await profileContext(user.id);
      const reply = (await groq([
        { role: "system", content: CHAT[lang] + (ctx ? `\n\nDatos del negocio del miembro:\n${ctx}` : "") },
        ...history.reverse().map((m: any) => ({ role: m.role, content: m.content })),
        { role: "user", content: text },
      ], 800)).text;
      await addUse(user.id);
      // La pregunta y la respuesta se guardan juntas: si la IA falla, no queda una pregunta suelta
      await sql`insert into public.coach_messages (user_id, role, content, created_at) values
        (${user.id}, 'user', ${text}, now()), (${user.id}, 'assistant', ${reply}, now() + interval '1 millisecond')`;
      return json({ ok: true, reply });
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "Error" }, 400);
  }
});
