import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";

const http = httpRouter();
http.route({ path: "/paystack/webhook", method: "POST", handler: httpAction(async (ctx, request) => {
  const secret = process.env.PAYSTACK_SECRET_KEY;
  if (!secret) return new Response("Unavailable", { status: 503 });
  const body = await request.text();
  const signature = request.headers.get("x-paystack-signature") || "";
  if (!/^[0-9a-f]{128}$/i.test(signature)) return new Response("Unauthorized", { status: 401 });
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const bytes = new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body)));
  const expected = Array.from(bytes, x => x.toString(16).padStart(2, "0")).join("");
  let difference = 0;
  for (let i = 0; i < expected.length; i++) difference |= expected.charCodeAt(i) ^ signature.toLowerCase().charCodeAt(i);
  if (difference) return new Response("Unauthorized", { status: 401 });
  let event;
  try { event = JSON.parse(body); } catch { return new Response("Invalid JSON", { status: 400 }); }
  try {
    if (event.event === "charge.success") {
      const d = event.data;
      const a = await ctx.runQuery(internal.paystack.details, { reference: String(d.reference || "") });
      if (String(d.customer?.email || "").toLowerCase() !== a.email.toLowerCase()) return new Response("Identity mismatch", { status: 400 });
      const result = await ctx.runMutation(internal.paystack.settle, { reference: a.reference, amountKobo: Number(d.amount), currency: String(d.currency), status: String(d.status), providerId: Number(d.id) });
      if (result.refundRequired) {
        const response = await fetch("https://api.paystack.co/refund", { method: "POST", headers: { Authorization: "Bearer " + secret, "Content-Type": "application/json" }, body: JSON.stringify({ transaction: a.reference, amount: a.amountKobo }) });
        const refund = await response.json().catch(() => null);
        if (!response.ok || !refund?.status) throw new Error("Late-payment refund request failed.");
        await ctx.runMutation(internal.paystack.recordRefund, { reference: a.reference, amountKobo: a.amountKobo, providerStatus: refund.data?.status || "pending" });
      }
    } else if (event.event === "refund.processed") {
      const d = event.data;
      const ref = String(d.transaction?.reference || d.reference || "");
      if (ref) await ctx.runMutation(internal.paystack.recordRefund, { reference: ref, amountKobo: Number(d.amount), providerStatus: "processed" });
    }
  } catch (error) {
    console.error("Paystack webhook processing failed", error);
    return new Response("Retry", { status: 500 });
  }
  return new Response("OK", { status: 200 });
}) });

export default http;
