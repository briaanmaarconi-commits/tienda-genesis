import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const token = Deno.env.get("MERCADOPAGO_ACCESS_TOKEN");
    if (!token) throw new Error("MERCADOPAGO_ACCESS_TOKEN no configurado");

    const url = new URL(req.url);
    let paymentId = url.searchParams.get("data.id") || url.searchParams.get("id");
    let topic = url.searchParams.get("type") || url.searchParams.get("topic");

    if (req.method === "POST") {
      try {
        const body = await req.json();
        paymentId = paymentId || body?.data?.id || body?.id;
        topic = topic || body?.type || body?.topic;
      } catch (_) {}
    }

    console.log("mp-webhook", { topic, paymentId });

    if (topic !== "payment" || !paymentId) {
      return new Response("ok", { headers: corsHeaders });
    }

    const payRes = await fetch(`https://api.mercadopago.com/v1/payments/${paymentId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const pay = await payRes.json();
    if (!payRes.ok) throw new Error(`MP get payment failed: ${JSON.stringify(pay)}`);

    const saleId = pay.external_reference;
    const status = pay.status; // approved | pending | rejected | refunded | cancelled

    if (!saleId) return new Response("ok no ref", { headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const newStatus =
      status === "approved" ? "abonado" :
      status === "rejected" || status === "cancelled" ? "cancelada" :
      undefined;

    const update: any = { mp_payment_id: String(paymentId), mp_status: status };
    if (newStatus) update.status = newStatus;

    const { data: prev } = await supabase.from("sales").select("status").eq("id", saleId).single();
    await supabase.from("sales").update(update).eq("id", saleId);

    if (newStatus === "abonado" && prev?.status !== "abonado") {
      try {
        await supabase.functions.invoke("send-order-confirmation", { body: { sale_id: saleId } });
      } catch (e) { console.error("send-order-confirmation failed", e); }
      try {
        await supabase.functions.invoke("send-admin-order-notification", { body: { sale_id: saleId, event: "paid" } });
      } catch (e) { console.error("send-admin-order-notification (paid) failed", e); }
    }

    return new Response("ok", { headers: corsHeaders });
  } catch (err: any) {
    console.error("mp-webhook error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
