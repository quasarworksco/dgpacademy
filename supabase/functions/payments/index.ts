// =========================================================
// DGP Academy — pagos, facturas y correos (Supabase Edge Function)
// Acciones:
//   order_placed  → el estudiante registró un pago por Zelle: avisa al admin y al estudiante
//   send_invoice  → (admin) envía la factura de un pedido verificado
//   square_pay    → cobra con tarjeta (Square), activa el acceso y envía la factura
//   weekly_report → (admin) envía por correo el resumen semanal de ingresos (Zelle / Square / manual)
//   order_rejected→ (admin) avisa al estudiante que su pago no se pudo verificar
//   test_email    → (admin) correo de prueba para revisar la configuración SMTP
//   square_setup_plans → (admin) crea los planes de membresía en el catálogo de Square
//   square_subscribe   → guarda la tarjeta y crea el cobro mensual automático
//   cancel_membership  → cancela la renovación (sigue activa hasta fin de mes)
//   member_request     → aviso al equipo de un flyer o asesoría solicitada
//   member_notify      → (admin) avisa al miembro: flyer entregado o asesoría agendada
// Secretos (token de Square, contraseña SMTP) se leen de private.secrets: nunca llegan al navegador.
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
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const esc = (v: unknown) =>
  String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));

async function setting(key: string) {
  const [r] = await sql`select value from public.settings where key = ${key}`;
  return (r?.value ?? {}) as Record<string, any>;
}
async function secret(key: string) {
  const [r] = await sql`select value from private.secrets where key = ${key}`;
  return r?.value as string | undefined;
}

// ── Correo ───────────────────────────────────────────────────────────────────
async function sendMail(to: string, subject: string, html: string) {
  const cfg = await setting("email");
  const pass = await secret("smtp_password");
  if (!pass) throw new Error("Falta la contraseña SMTP en Configuración → Correo");
  const client = new SMTPClient({
    connection: {
      hostname: cfg.smtp_host || "smtp.gmail.com",
      port: Number(cfg.smtp_port) || 465,
      tls: true,
      auth: { username: cfg.from_email, password: pass },
    },
  });
  try {
    await client.send({
      from: `${cfg.from_name || "DGP Academy"} <${cfg.from_email}>`,
      to,
      subject,
      html,
      content: "auto",
    });
  } finally {
    await client.close();
  }
}

const T = {
  es: {
    invoice: "Factura", receipt: "Comprobante de pago", date: "Fecha", billed: "Facturado a", item: "Concepto",
    method: "Método", ref: "Referencia", total: "Total pagado", paid: "PAGADO", access: "Tu acceso ya está activo.",
    go: "Entrar a mi panel", hi: "Hola", thanks: "Gracias por tu compra en DGP Academy.",
    received: "Recibimos tu pago", receivedBody: "Registramos tu pago por Zelle y lo estamos verificando. Te avisaremos por correo en cuanto activemos tu acceso (normalmente en menos de 24 horas).",
    amount: "Monto", methods: { zelle: "Zelle", square: "Tarjeta (Square)", manual: "Pago registrado" } as Record<string, string>,
  },
  en: {
    invoice: "Invoice", receipt: "Payment receipt", date: "Date", billed: "Billed to", item: "Item",
    method: "Method", ref: "Reference", total: "Total paid", paid: "PAID", access: "Your access is now active.",
    go: "Go to my dashboard", hi: "Hi", thanks: "Thank you for your purchase at DGP Academy.",
    received: "We received your payment", receivedBody: "We recorded your Zelle payment and are verifying it. We’ll email you as soon as your access is activated (usually within 24 hours).",
    amount: "Amount", methods: { zelle: "Zelle", square: "Card (Square)", manual: "Recorded payment" } as Record<string, string>,
  },
};

function shell(inner: string) {
  return `<!doctype html><html><body style="margin:0;background:#f6f8fc;font-family:Helvetica,Arial,sans-serif;color:#0a1430">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f6f8fc;padding:32px 12px"><tr><td align="center">
  <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e3e8f2">
  <tr><td style="background:#0a1430;padding:20px 28px;color:#fff;font-size:18px;font-weight:700"><img src="${SITE}/assets/img/apple-touch-icon.png" width="34" height="34" alt="" style="vertical-align:middle;border-radius:9px;margin-right:10px">DGP <span style="font-weight:400;color:#a8c0ff">Academy</span></td></tr>
  <tr><td style="padding:28px">${inner}</td></tr>
  <tr><td style="padding:16px 28px;border-top:1px solid #e3e8f2;color:#5d6982;font-size:12px">DGP Global Group · <a href="${SITE}" style="color:#1a56e8">academy.dgpglobalgroup.com</a></td></tr>
  </table></td></tr></table></body></html>`;
}

async function invoiceHtml(o: any) {
  const lang = o.lang === "en" ? "en" : "es";
  const t = T[lang];
  const billing = await setting("billing");
  const date = new Date(o.verified_at || o.created_at).toLocaleDateString(lang === "en" ? "en-US" : "es-ES", { year: "numeric", month: "long", day: "numeric" });
  const title = lang === "en" ? (o.title_en || o.title) : o.title;
  const money = `$${Number(o.amount).toFixed(2)} ${esc(o.currency)}`;
  const row = (k: string, v: string) => `<tr><td style="padding:8px 0;color:#5d6982;font-size:14px">${k}</td><td style="padding:8px 0;text-align:right;font-size:14px">${v}</td></tr>`;
  return shell(`
    <p style="margin:0 0 6px;font-size:15px">${t.hi} ${esc(o.full_name || o.email)},</p>
    <p style="margin:0 0 22px;font-size:15px;color:#3d4a63">${t.thanks} <strong>${t.access}</strong></p>
    <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e3e8f2;border-radius:12px;padding:18px 20px">
      <tr><td style="font-size:20px;font-weight:700">${t.invoice} ${esc(o.invoice_number)}</td>
          <td style="text-align:right"><span style="background:#e7f6ec;color:#15803d;font-weight:700;font-size:12px;padding:5px 10px;border-radius:99px">${t.paid}</span></td></tr>
      <tr><td colspan="2" style="padding-top:14px">
        <table width="100%" cellpadding="0" cellspacing="0">
          ${row(t.date, esc(date))}
          ${row(t.billed, esc(o.full_name || "") + "<br><span style='color:#5d6982'>" + esc(o.email) + "</span>")}
          ${row(t.item, esc(title))}
          ${row(t.method, esc(t.methods[o.method] || o.method))}
          ${o.reference ? row(t.ref, esc(o.reference)) : ""}
          <tr><td colspan="2" style="border-top:1px solid #e3e8f2"></td></tr>
          <tr><td style="padding:12px 0 0;font-weight:700">${t.total}</td><td style="padding:12px 0 0;text-align:right;font-weight:700;font-size:18px">${money}</td></tr>
        </table>
      </td></tr>
    </table>
    <p style="margin:22px 0"><a href="${SITE}" style="display:inline-block;background:#1a56e8;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${t.go}</a></p>
    <p style="margin:0;font-size:12px;color:#5d6982;line-height:1.6">${esc(billing.company || "")}${billing.address ? " · " + esc(billing.address) : ""}${billing.tax_id ? " · " + esc(billing.tax_id) : ""}<br>
    ${esc(lang === "en" ? billing.footer_en : billing.footer_es)}</p>`);
}

async function loadOrder(id: string) {
  const [o] = await sql`
    select o.*, p.email, p.full_name, p.lang,
      coalesce(pd.title, 'Membresía ' || pl.name || ' (1 mes)') as title,
      coalesce(pd.title_en, pl.name_en || ' membership (1 month)') as title_en
    from public.orders o join public.profiles p on p.id = o.user_id
    left join public.products pd on pd.id = o.product_id left join public.plans pl on pl.id = o.plan_id
    where o.id = ${id}`;
  return o;
}

async function sendInvoice(id: string) {
  const o = await loadOrder(id);
  if (!o || o.status !== "verified") throw new Error("El pedido no está verificado");
  const t = T[o.lang === "en" ? "en" : "es"];
  await sendMail(o.email, `${t.invoice} ${o.invoice_number} — DGP Academy`, await invoiceHtml(o));
  await sql`update public.orders set invoice_sent_at = now() where id = ${id}`;
  return o;
}

// ── Square ───────────────────────────────────────────────────────────────────
async function squareCfg() {
  const pay = await setting("payments");
  const sq = pay.square || {};
  if (!sq.enabled) throw new Error("El pago con tarjeta no está activo");
  const token = await secret("square_access_token");
  if (!token || !sq.location_id) throw new Error("Square no está configurado");
  const base = sq.env === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  return { sq, token, base, currency: pay.currency || "USD" };
}
async function squareApi(c: { token: string; base: string }, path: string, method = "GET", body?: unknown) {
  const res = await fetch(`${c.base}${path}`, {
    method,
    headers: { Authorization: `Bearer ${c.token}`, "Content-Type": "application/json", "Square-Version": "2024-10-17" },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.errors?.[0]?.detail || `Square respondió ${res.status}`);
  return data;
}

// Crea en el catálogo de Square el plan de membresía con una variación por nivel
async function squareSetupPlans() {
  const c = await squareCfg();
  const plans = await sql`select * from public.plans where active order by position`;
  const plan = await squareApi(c, "/v2/catalog/object", "POST", {
    idempotency_key: crypto.randomUUID(),
    object: { type: "SUBSCRIPTION_PLAN", id: "#dgp_membership", subscription_plan_data: { name: "DGP Academy — Membresía" } },
  });
  const planId = plan.catalog_object.id;
  const out: Record<string, string> = {};
  for (const p of plans) {
    const v = await squareApi(c, "/v2/catalog/object", "POST", {
      idempotency_key: crypto.randomUUID(),
      object: {
        type: "SUBSCRIPTION_PLAN_VARIATION", id: `#v_${p.id}`,
        subscription_plan_variation_data: {
          name: `${p.name} — $${Number(p.price_usd)}/mes`, subscription_plan_id: planId,
          phases: [{ cadence: "MONTHLY", ordinal: 0, pricing: { type: "STATIC", price_money: { amount: Math.round(Number(p.price_usd) * 100), currency: c.currency } } }],
        },
      },
    });
    out[p.id] = v.catalog_object.id;
    await sql`update public.plans set square_variation_id = ${v.catalog_object.id} where id = ${p.id}`;
  }
  return out;
}

// Suscribe al estudiante: guarda la tarjeta en Square y crea el cobro mensual automático
async function squareSubscribe(userId: string, body: any) {
  const c = await squareCfg();
  const [pl] = await sql`select * from public.plans where id = ${body.plan_id} and active`;
  if (!pl) throw new Error("Plan no disponible");
  if (!pl.square_variation_id) throw new Error("Los planes aún no están creados en Square");
  const [bp] = await sql`select 1 from public.business_profiles where user_id = ${userId}`;
  if (!bp) throw new Error("Completa primero la encuesta de tu negocio");
  const [prof] = await sql`select email, full_name from public.profiles where id = ${userId}`;
  const [cur] = await sql`select * from public.subscriptions where user_id = ${userId}`;
  if (cur?.square_subscription_id && cur.status === "active" && !cur.cancel_at_period_end) throw new Error("Ya tienes una membresía activa con tarjeta");

  let customerId = cur?.square_customer_id;
  if (!customerId) {
    const cu = await squareApi(c, "/v2/customers", "POST", {
      idempotency_key: crypto.randomUUID(), email_address: prof.email, given_name: prof.full_name || undefined, reference_id: userId,
    });
    customerId = cu.customer.id;
  }
  const card = await squareApi(c, "/v2/cards", "POST", {
    idempotency_key: crypto.randomUUID(), source_id: body.source_id, verification_token: body.verification_token || undefined,
    card: { customer_id: customerId, reference_id: userId },
  });
  const sub = await squareApi(c, "/v2/subscriptions", "POST", {
    idempotency_key: crypto.randomUUID(), location_id: c.sq.location_id, plan_variation_id: pl.square_variation_id,
    customer_id: customerId, card_id: card.card.id, timezone: "America/New_York",
  });
  // Queda activa al momento; el webhook registra cada cobro mensual y extiende el periodo
  await sql`
    insert into public.subscriptions (user_id, plan_id, status, method, current_period_start, current_period_end,
      square_customer_id, square_card_id, square_subscription_id, updated_at)
    values (${userId}, ${pl.id}, 'active', 'square', now(), now() + interval '1 month', ${customerId}, ${card.card.id}, ${sub.subscription.id}, now())
    on conflict (user_id) do update set plan_id = excluded.plan_id, status = 'active', method = 'square',
      current_period_start = excluded.current_period_start, current_period_end = excluded.current_period_end,
      square_customer_id = excluded.square_customer_id, square_card_id = excluded.square_card_id,
      square_subscription_id = excluded.square_subscription_id, cancel_at_period_end = false, updated_at = now()`;
  return { subscription_id: sub.subscription.id };
}

async function squareCancel(userId: string) {
  const [cur] = await sql`select * from public.subscriptions where user_id = ${userId}`;
  if (!cur) throw new Error("No tienes una membresía");
  if (cur.method === "square" && cur.square_subscription_id) {
    const c = await squareCfg();
    await squareApi(c, `/v2/subscriptions/${cur.square_subscription_id}/cancel`, "POST", {});
  }
  await sql`update public.subscriptions set cancel_at_period_end = true, updated_at = now() where user_id = ${userId}`;
}

async function squarePay(userId: string, body: any) {
  const pay = await setting("payments");
  const sq = pay.square || {};
  if (!sq.enabled) throw new Error("El pago con tarjeta no está activo");
  const token = await secret("square_access_token");
  if (!token || !sq.location_id) throw new Error("Square no está configurado");
  const [prod] = await sql`select * from public.products where id = ${body.product_id}`;
  if (!prod || prod.price_usd == null || prod.status !== "available") throw new Error("Este producto no está a la venta");
  const [has] = await sql`select 1 from public.access where user_id = ${userId} and product_id = ${prod.id} and active`;
  if (has) throw new Error("Ya tienes acceso a este producto");
  const [prof] = await sql`select email, full_name from public.profiles where id = ${userId}`;

  const base = sq.env === "production" ? "https://connect.squareup.com" : "https://connect.squareupsandbox.com";
  const res = await fetch(`${base}/v2/payments`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Square-Version": "2024-10-17" },
    body: JSON.stringify({
      idempotency_key: crypto.randomUUID(),
      source_id: body.source_id,
      verification_token: body.verification_token || undefined,
      amount_money: { amount: Math.round(Number(prod.price_usd) * 100), currency: pay.currency || "USD" },
      location_id: sq.location_id,
      buyer_email_address: prof.email,
      note: `DGP Academy — ${prod.title}`,
      reference_id: userId.slice(0, 40),
    }),
  });
  const data = await res.json();
  const p = data.payment;
  if (!res.ok || !p || !["COMPLETED", "APPROVED"].includes(p.status)) {
    const msg = data.errors?.[0]?.detail || "El pago fue rechazado";
    throw new Error(msg);
  }
  const [o] = await sql`
    insert into public.orders (user_id, product_id, amount, method, status, reference, payer_name, external_id, verified_at, invoice_number)
    values (${userId}, ${prod.id}, ${prod.price_usd}, 'square', 'verified', ${p.card_details?.card?.last_4 ? "•••• " + p.card_details.card.last_4 : p.id},
            ${prof.full_name || ""}, ${p.id}, now(), private.next_invoice_number())
    returning *`;
  await sql`select private.grant_from_order(o) from public.orders o where o.id = ${o.id}`;
  try { await sendInvoice(o.id); } catch (e) { console.error("factura", e); }
  return o;
}

// ── Servidor ─────────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: CORS });
  try {
    // Llamada interna del webhook de Square (con la clave de servicio): enviar factura
    const auth = req.headers.get("Authorization") ?? "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (service && auth === `Bearer ${service}` && req.headers.get("x-internal") === "1") {
      const b = await req.json();
      if (b.action === "internal_invoice") { await sendInvoice(b.order_id); return json({ ok: true }); }
      return json({ error: "Acción no válida" }, 400);
    }
    const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } },
    });
    const { data: { user } } = await supa.auth.getUser();
    if (!user) return json({ error: "Inicia sesión" }, 401);
    const [prof] = await sql`select is_admin, email, full_name, lang from public.profiles where id = ${user.id}`;
    const isAdmin = !!prof?.is_admin;
    const body = await req.json();

    switch (body.action) {
      case "order_placed": {
        const o = await loadOrder(body.order_id);
        if (!o || o.user_id !== user.id) return json({ error: "Pedido no encontrado" }, 404);
        const cfg = await setting("email");
        const t = T[o.lang === "en" ? "en" : "es"];
        const jobs: Promise<unknown>[] = [];
        if (cfg.notify_admin !== false) {
          jobs.push(sendMail(cfg.from_email, `Nuevo pago por verificar — ${o.full_name || o.email} ($${Number(o.amount).toFixed(2)})`, shell(`
            <p style="font-size:16px;font-weight:700;margin:0 0 12px">Nuevo pago por Zelle para verificar</p>
            <p style="margin:0;font-size:14px;line-height:1.7">Estudiante: <strong>${esc(o.full_name)}</strong> (${esc(o.email)})<br>
            Producto: ${esc(o.title)}<br>Monto: $${Number(o.amount).toFixed(2)} ${esc(o.currency)}<br>
            Titular que envió: ${esc(o.payer_name || "—")}<br>Confirmación: <strong>${esc(o.reference)}</strong></p>
            <p style="margin:20px 0 0"><a href="${SITE}" style="display:inline-block;background:#0a1430;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:999px">Verificar en el panel admin</a></p>`)));
        }
        jobs.push(sendMail(o.email, `${t.received} — DGP Academy`, shell(`
          <p style="font-size:16px;font-weight:700;margin:0 0 10px">${t.received}</p>
          <p style="margin:0 0 14px;font-size:14px;color:#3d4a63;line-height:1.6">${t.receivedBody}</p>
          <p style="margin:0;font-size:14px">${esc(o.lang === "en" ? (o.title_en || o.title) : o.title)} · ${t.amount}: <strong>$${Number(o.amount).toFixed(2)} ${esc(o.currency)}</strong></p>`)));
        const results = await Promise.allSettled(jobs);
        return json({ ok: true, sent: results.filter((r) => r.status === "fulfilled").length });
      }
      case "send_invoice": {
        if (!isAdmin) return json({ error: "Solo administradores" }, 403);
        const o = await sendInvoice(body.order_id);
        return json({ ok: true, invoice_number: o.invoice_number });
      }
      case "square_pay": {
        const o = await squarePay(user.id, body);
        return json({ ok: true, order: o });
      }
      case "square_setup_plans": {
        if (!isAdmin) return json({ error: "Solo administradores" }, 403);
        return json({ ok: true, variations: await squareSetupPlans() });
      }
      case "square_subscribe": {
        return json({ ok: true, ...(await squareSubscribe(user.id, body)) });
      }
      case "cancel_membership": {
        await squareCancel(user.id);
        return json({ ok: true });
      }
      case "member_request": {
        // El estudiante pidió un flyer o una asesoría: aviso al equipo
        const cfg = await setting("email");
        const table = body.type === "meeting" ? "meetings" : "flyer_requests";
        const [r] = table === "meetings"
          ? await sql`select m.topic as title, m.preferred_times as extra from public.meetings m where m.id = ${body.id} and m.user_id = ${user.id}`
          : await sql`select f.title, f.headline || ' · ' || f.format as extra from public.flyer_requests f where f.id = ${body.id} and f.user_id = ${user.id}`;
        if (!r) return json({ error: "Solicitud no encontrada" }, 404);
        await sendMail(cfg.from_email, `${body.type === "meeting" ? "Nueva asesoría solicitada" : "Nuevo flyer solicitado"} — ${prof.full_name || prof.email}`, shell(`
          <p style="font-size:16px;font-weight:700;margin:0 0 10px">${body.type === "meeting" ? "Nueva asesoría solicitada" : "Nuevo flyer solicitado"}</p>
          <p style="margin:0;font-size:14px;line-height:1.7">Miembro: <strong>${esc(prof.full_name)}</strong> (${esc(prof.email)})<br>
          ${esc(r.title)}<br><span style="color:#5d6982">${esc(r.extra)}</span></p>
          <p style="margin:20px 0 0"><a href="${SITE}" style="display:inline-block;background:#0a1430;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:999px">Abrir el panel admin</a></p>`));
        return json({ ok: true });
      }
      case "member_notify": {
        // (admin) avisa al miembro: flyer entregado o asesoría agendada
        if (!isAdmin) return json({ error: "Solo administradores" }, 403);
        if (body.type === "meeting") {
          const [m] = await sql`select m.*, p.email, p.full_name, p.lang from public.meetings m join public.profiles p on p.id = m.user_id where m.id = ${body.id}`;
          if (!m) return json({ error: "Asesoría no encontrada" }, 404);
          const en = m.lang === "en";
          const when = m.scheduled_at ? new Date(m.scheduled_at).toLocaleString(en ? "en-US" : "es-ES", { dateStyle: "full", timeStyle: "short", timeZone: "America/New_York" }) + " (Florida)" : "";
          await sendMail(m.email, en ? "Your advisory session is scheduled — DGP Academy" : "Tu asesoría está agendada — DGP Academy", shell(`
            <p style="font-size:16px;font-weight:700;margin:0 0 10px">${en ? "Your session is scheduled" : "Tu asesoría está agendada"}</p>
            <p style="margin:0 0 8px;font-size:14px;color:#3d4a63">${esc(m.topic)}</p>
            <p style="margin:0 0 16px;font-size:15px"><strong>${esc(when)}</strong></p>
            ${m.meet_url ? `<p style="margin:0 0 16px"><a href="${esc(m.meet_url)}" style="display:inline-block;background:#1a56e8;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${en ? "Join the meeting" : "Entrar a la reunión"}</a></p>` : ""}
            ${m.admin_note ? `<p style="margin:0;font-size:14px;color:#3d4a63">${esc(m.admin_note)}</p>` : ""}`));
        } else {
          const [f] = await sql`select f.*, p.email, p.full_name, p.lang from public.flyer_requests f join public.profiles p on p.id = f.user_id where f.id = ${body.id}`;
          if (!f) return json({ error: "Flyer no encontrado" }, 404);
          const en = f.lang === "en";
          await sendMail(f.email, en ? "Your flyer is ready — DGP Academy" : "Tu flyer está listo — DGP Academy", shell(`
            <p style="font-size:16px;font-weight:700;margin:0 0 10px">${en ? "Your flyer is ready" : "Tu flyer está listo"}</p>
            <p style="margin:0 0 16px;font-size:14px;color:#3d4a63">${esc(f.title)}</p>
            ${f.caption ? `<p style="margin:0 0 16px;font-size:14px;color:#3d4a63;white-space:pre-line">${esc(f.caption)}</p>` : ""}
            <p style="margin:0"><a href="${SITE}" style="display:inline-block;background:#1a56e8;color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px">${en ? "Download it from your dashboard" : "Descárgalo desde tu panel"}</a></p>`));
        }
        return json({ ok: true });
      }
      case "weekly_report": {
        if (!isAdmin) return json({ error: "Solo administradores" }, 403);
        const weeks = Math.min(Math.max(Number(body.weeks) || 4, 1), 26);
        const [w] = await sql`
          select jsonb_agg(x) r from (
            select to_char(ws, 'YYYY-MM-DD') week_start,
              coalesce(sum(o.amount) filter (where o.method = 'zelle'), 0) zelle,
              coalesce(sum(o.amount) filter (where o.method = 'square'), 0) square,
              coalesce(sum(o.amount) filter (where o.method = 'manual'), 0) manual,
              coalesce(sum(o.amount), 0) total, count(o.id) n,
              count(o.id) filter (where o.reconciled_at is null) pending_rec
            from generate_series(date_trunc('week', now() at time zone 'America/New_York') - make_interval(weeks => ${weeks}::int - 1),
                                 date_trunc('week', now() at time zone 'America/New_York'), interval '1 week') ws
            left join public.orders o on o.status = 'verified'
              and (o.verified_at at time zone 'America/New_York') >= ws
              and (o.verified_at at time zone 'America/New_York') < ws + interval '1 week'
            group by ws order by ws desc) x`;
        const rows = (w?.r ?? []) as any[];
        const m = (v: number) => `$${Number(v).toFixed(2)}`;
        const td = "padding:8px 10px;border-bottom:1px solid #e3e8f2;font-size:13px";
        const sum = rows.reduce((a, r) => a + Number(r.total), 0);
        const cfg = await setting("email");
        await sendMail(body.to || cfg.from_email, `Resumen de ingresos — últimas ${weeks} semanas (${m(sum)})`, shell(`
          <p style="font-size:16px;font-weight:700;margin:0 0 6px">Resumen de ingresos verificados</p>
          <p style="margin:0 0 16px;font-size:13px;color:#5d6982">Semanas de lunes a domingo (hora de Florida). Compara cada fila con tus movimientos de Zelle y Square.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
            <tr style="background:#f6f8fc"><th align="left" style="${td}">Semana</th><th align="right" style="${td}">Zelle</th><th align="right" style="${td}">Square</th><th align="right" style="${td}">Manual</th><th align="right" style="${td}">Total</th><th align="right" style="${td}">Pagos</th><th align="right" style="${td}">Sin conciliar</th></tr>
            ${rows.map((r) => `<tr><td style="${td}">${esc(r.week_start)}</td><td align="right" style="${td}">${m(r.zelle)}</td><td align="right" style="${td}">${m(r.square)}</td><td align="right" style="${td}">${m(r.manual)}</td><td align="right" style="${td};font-weight:700">${m(r.total)}</td><td align="right" style="${td}">${r.n}</td><td align="right" style="${td};color:${Number(r.pending_rec) ? "#b45309" : "#15803d"}">${r.pending_rec}</td></tr>`).join("")}
          </table>
          <p style="margin:18px 0 0;font-size:14px">Total del periodo: <strong>${m(sum)}</strong></p>
          <p style="margin:20px 0 0"><a href="${SITE}" style="display:inline-block;background:#0a1430;color:#fff;text-decoration:none;font-weight:700;padding:11px 20px;border-radius:999px">Abrir conciliación</a></p>`));
        return json({ ok: true });
      }
      case "order_rejected": {
        if (!isAdmin) return json({ error: "Solo administradores" }, 403);
        const o = await loadOrder(body.order_id);
        if (!o || o.status !== "rejected") return json({ error: "Pedido no encontrado" }, 404);
        const en = o.lang === "en";
        await sendMail(o.email, en ? "We couldn’t verify your payment — DGP Academy" : "No pudimos verificar tu pago — DGP Academy", shell(`
          <p style="font-size:16px;font-weight:700;margin:0 0 10px">${en ? "We couldn’t verify your payment" : "No pudimos verificar tu pago"}</p>
          <p style="margin:0 0 12px;font-size:14px;color:#3d4a63;line-height:1.6">${en
            ? `We couldn’t find a Zelle payment matching confirmation <strong>${esc(o.reference)}</strong>.`
            : `No encontramos un pago de Zelle con la confirmación <strong>${esc(o.reference)}</strong>.`}</p>
          ${o.rejected_reason ? `<p style="margin:0 0 12px;font-size:14px;color:#3d4a63">${esc(o.rejected_reason)}</p>` : ""}
          <p style="margin:0;font-size:14px;color:#3d4a63">${en ? "Reply to this email and we’ll help you sort it out." : "Responde a este correo y te ayudamos a resolverlo."}</p>`));
        return json({ ok: true });
      }
      case "test_email": {
        if (!isAdmin) return json({ error: "Solo administradores" }, 403);
        await sendMail(body.to || prof.email, "Prueba de correo — DGP Academy", shell(`
          <p style="font-size:16px;font-weight:700;margin:0 0 8px">¡El correo funciona!</p>
          <p style="margin:0;font-size:14px;color:#3d4a63">Este es un correo de prueba enviado desde el panel admin de DGP Academy.</p>`));
        return json({ ok: true });
      }
      default:
        return json({ error: "Acción no válida" }, 400);
    }
  } catch (e) {
    console.error(e);
    return json({ error: (e as Error).message || "Error" }, 400);
  }
});
