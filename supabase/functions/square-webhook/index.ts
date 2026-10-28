// =========================================================
// DGP Academy — webhook de Square para las membresías mensuales
// Square llama aquí cada vez que cobra una mensualidad o cambia una suscripción.
// La firma se comprueba con la clave guardada en Configuración → Square.
//   invoice.payment_made            → registra el pago, extiende el mes y envía la factura
//   invoice.scheduled_charge_failed → la membresía pasa a "pago pendiente"
//   subscription.updated            → refleja cancelaciones y pausas
// =========================================================
import postgres from "npm:postgres@3.4.5";

const sql = postgres(Deno.env.get("SUPABASE_DB_URL")!, { prepare: false, max: 2 });
const URL_SELF = `${Deno.env.get("SUPABASE_URL")}/functions/v1/square-webhook`;

async function validSignature(raw: string, header: string | null) {
  const [r] = await sql`select value from private.secrets where key = 'square_webhook_key'`;
  if (!r?.value || !header) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(r.value), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(URL_SELF + raw));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  if (expected.length !== header.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i++) diff |= expected.charCodeAt(i) ^ header.charCodeAt(i);
  return diff === 0;
}

// La factura la envía la función payments (misma plantilla que el resto de facturas)
async function sendInvoice(orderId: string) {
  const [k] = await sql`select value from private.secrets where key = 'smtp_password'`;
  if (!k) return;
  await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "x-internal": "1" },
    body: JSON.stringify({ action: "internal_invoice", order_id: orderId }),
  }).catch((e) => console.error("factura", e));
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("ok");
  const raw = await req.text();
  if (!(await validSignature(raw, req.headers.get("x-square-hmacsha256-signature")))) {
    return new Response("firma no válida", { status: 401 });
  }
  try {
    const ev = JSON.parse(raw);
    const obj = ev.data?.object || {};

    if (ev.type === "invoice.payment_made") {
      const inv = obj.invoice;
      if (!inv?.subscription_id) return new Response("ok");
      const [s] = await sql`select * from public.subscriptions where square_subscription_id = ${inv.subscription_id}`;
      if (!s) return new Response("ok");
      const [dup] = await sql`select 1 from public.orders where external_id = ${inv.id}`;
      if (dup) return new Response("ok");
      const cents = inv.payment_requests?.[0]?.total_completed_amount_money?.amount ?? inv.payment_requests?.[0]?.computed_amount_money?.amount ?? 0;
      // El primer cobro llega justo después de suscribirse: ese mes ya está activo, solo se registra
      const [prev] = await sql`select 1 from public.orders where user_id = ${s.user_id} and kind = 'subscription' and method = 'square' and created_at >= ${s.current_period_start}`;
      const firstOfPeriod = !prev && new Date(s.current_period_start).getTime() > Date.now() - 2 * 86400000;
      const [o] = await sql`
        insert into public.orders (user_id, kind, plan_id, amount, method, status, reference, external_id, verified_at, invoice_number)
        values (${s.user_id}, 'subscription', ${s.plan_id}, ${cents / 100}, 'square', 'verified', ${"Square " + (inv.invoice_number || inv.id)}, ${inv.id}, now(), private.next_invoice_number())
        returning *`;
      if (!firstOfPeriod) await sql`select private.activate_subscription(o) from public.orders o where o.id = ${o.id}`;
      else await sql`update public.subscriptions set status = 'active', updated_at = now() where id = ${s.id}`;
      await sendInvoice(o.id);
    }

    if (ev.type === "invoice.scheduled_charge_failed") {
      const inv = obj.invoice;
      if (inv?.subscription_id) await sql`update public.subscriptions set status = 'past_due', updated_at = now() where square_subscription_id = ${inv.subscription_id}`;
    }

    if (ev.type === "subscription.updated") {
      const sub = obj.subscription;
      if (sub?.id && ["CANCELED", "DEACTIVATED"].includes(sub.status)) {
        await sql`update public.subscriptions set status = case when current_period_end > now() then status else 'canceled' end,
          cancel_at_period_end = true, updated_at = now() where square_subscription_id = ${sub.id}`;
      }
      if (sub?.id && sub.status === "PAUSED") await sql`update public.subscriptions set status = 'past_due', updated_at = now() where square_subscription_id = ${sub.id}`;
    }
    return new Response("ok");
  } catch (e) {
    console.error(e);
    return new Response("error", { status: 500 });
  }
});
