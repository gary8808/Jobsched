import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const webhookSecret = Deno.env.get("CLICKSEND_WEBHOOK_SECRET")!;

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing Supabase Edge Function environment variables" }, 500);
    }
    if (!webhookSecret) {
      return json({ error: "Missing CLICKSEND_WEBHOOK_SECRET secret" }, 500);
    }

    const url = new URL(req.url);
    const suppliedSecret = url.searchParams.get("secret") || req.headers.get("x-jobsched-webhook-secret") || "";
    if (suppliedSecret !== webhookSecret) {
      return json({ error: "Invalid webhook secret" }, 401);
    }

    const payload = await readClickSendPayload(req, url);

    const fromNumber = normalisePhone(firstNonEmpty(payload.from, payload.from_number, payload.sender, payload.mobile, payload.phone, payload.original_sender_id));
    const toNumber = normalisePhone(firstNonEmpty(payload.to, payload.to_number, payload.dedicated_number, payload.recipient, payload.number));
    const messageText = firstNonEmpty(payload.body, payload.message, payload.message_body, payload.text, payload.content, payload.sms).trim();
    const providerMessageId = firstNonEmpty(payload.message_id, payload.sms_id, payload.id, payload.inbound_id);
    const providerUserId = firstNonEmpty(payload.user_id, payload.userId);
    const inboundRuleId = firstNonEmpty(payload.inbound_rule_id, payload.rule_id, payload.ruleId);

    if (!fromNumber && !messageText) {
      return json({ error: "Could not read inbound SMS sender or message from ClickSend payload", payload }, 400);
    }
    if (!messageText) {
      return json({ error: "Inbound SMS body was empty", payload }, 400);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const match = await findJobForInboundReply(supabaseAdmin, fromNumber, payload);

    const insertPayload = {
      job_id: match.jobId || null,
      channel: "sms",
      direction: "in",
      message_text: messageText,
      to_number: toNumber || null,
      from_number: fromNumber || null,
      provider: "clicksend",
      provider_message_id: providerMessageId || null,
      status: "received",
      unread: true,
      actioned: false,
      app_payload: payload,
      matched_by: match.matchedBy || null,
      inbound_rule_id: inboundRuleId || null,
      provider_user_id: providerUserId || null,
    };

    const { data: savedMessage, error: messageError } = await supabaseAdmin
      .from("messages")
      .insert(insertPayload)
      .select("*")
      .single();

    if (messageError) throw messageError;

    if (match.jobId) {
      const { error: historyError } = await supabaseAdmin.from("job_history").insert({
        job_id: match.jobId,
        action: "SMS received",
        details: `Inbound SMS received from ${fromNumber || "client"}.`,
      });
      if (historyError) console.error("Could not write inbound SMS job history", historyError);
    }

    return json({ ok: true, message: savedMessage, matched_by: match.matchedBy || null });
  } catch (error) {
    console.error(error);
    return json({ error: error?.message || "Inbound SMS webhook failed" }, 500);
  }
});

async function readClickSendPayload(req: Request, url: URL): Promise<Record<string, string>> {
  const payload: Record<string, string> = {};

  url.searchParams.forEach((value, key) => {
    if (key !== "secret") payload[key] = value;
  });

  if (req.method === "GET") return payload;

  const contentType = req.headers.get("content-type") || "";
  const bodyText = await req.text();
  if (!bodyText) return payload;

  if (contentType.includes("application/json")) {
    const parsed = JSON.parse(bodyText);
    flattenObject(parsed, payload);
    return payload;
  }

  // ClickSend inbound URL rules commonly send x-www-form-urlencoded data.
  const params = new URLSearchParams(bodyText);
  params.forEach((value, key) => {
    payload[key] = value;
  });
  return payload;
}

function flattenObject(input: unknown, out: Record<string, string>, prefix = "") {
  if (!input || typeof input !== "object") return;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const nextKey = prefix ? `${prefix}_${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      flattenObject(value, out, nextKey);
    } else if (value !== undefined && value !== null) {
      out[nextKey] = String(value);
    }
  }
}

async function findJobForInboundReply(supabaseAdmin: any, fromNumber: string, payload: Record<string, string>) {
  const explicitJobId = firstNonEmpty(payload.job_id, payload.jobId, payload.custom_string, payload.customString);
  if (isUuid(explicitJobId)) return { jobId: explicitJobId, matchedBy: "payload_job_id" };

  if (fromNumber) {
    const { data: previousOutbound } = await supabaseAdmin
      .from("messages")
      .select("job_id, created_at")
      .eq("channel", "sms")
      .eq("direction", "out")
      .eq("to_number", fromNumber)
      .not("job_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(1);

    if (previousOutbound?.[0]?.job_id) {
      return { jobId: previousOutbound[0].job_id, matchedBy: "latest_outbound_to_number" };
    }

    const alternateLocal = fromNumber.startsWith("+61") ? `0${fromNumber.slice(3)}` : "";
    const { data: jobRows } = await supabaseAdmin
      .from("jobs")
      .select("id, client_phone, updated_at")
      .or(`client_phone.eq.${fromNumber}${alternateLocal ? `,client_phone.eq.${alternateLocal}` : ""}`)
      .order("updated_at", { ascending: false })
      .limit(1);

    if (jobRows?.[0]?.id) {
      return { jobId: jobRows[0].id, matchedBy: "job_client_phone" };
    }
  }

  return { jobId: null, matchedBy: "unmatched" };
}

function firstNonEmpty(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function normalisePhone(input: string) {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const noSpaces = trimmed.replace(/[\s().-]+/g, "");
  if (noSpaces.startsWith("+")) return noSpaces;
  if (noSpaces.startsWith("00")) return `+${noSpaces.slice(2)}`;
  if (noSpaces.startsWith("04")) return `+61${noSpaces.slice(1)}`;
  if (noSpaces.startsWith("4") && noSpaces.length === 9) return `+61${noSpaces}`;
  return noSpaces;
}

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ""));
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
