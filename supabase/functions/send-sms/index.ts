import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const clicksendUsername = Deno.env.get("CLICKSEND_USERNAME")!;
    const clicksendApiKey = Deno.env.get("CLICKSEND_API_KEY")!;

    if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase Edge Function environment variables" }, 500);
    if (!clicksendUsername || !clicksendApiKey) return json({ error: "Missing CLICKSEND_USERNAME or CLICKSEND_API_KEY secret" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();
    if (!jwt) return json({ error: "Not signed in" }, 401);

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(jwt);
    if (callerError || !callerData?.user) return json({ error: "Invalid user session" }, 401);

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!callerProfile?.active || callerProfile.role !== "admin") {
      return json({ error: "Only admin users can send client SMS messages" }, 403);
    }

    const body = await req.json();
    const jobId = String(body.job_id || "").trim();
    const to = normalisePhone(String(body.to || ""));
    const messageText = String(body.body || body.message || "").trim();
    const clientName = String(body.client_name || "Client").trim();

    if (!jobId) return json({ error: "job_id is required" }, 400);
    if (!to) return json({ error: "Client phone number is required" }, 400);
    if (!messageText) return json({ error: "SMS message text is required" }, 400);

    const clicksendPayload = {
      messages: [
        {
          body: messageText,
          to,
          source: "Jobsched",
          custom_string: jobId,
        },
      ],
    };

    const clicksendResponse = await fetch("https://rest.clicksend.com/v3/sms/send", {
      method: "POST",
      headers: {
        "Authorization": `Basic ${btoa(`${clicksendUsername}:${clicksendApiKey}`)}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(clicksendPayload),
    });

    const clicksendJson = await clicksendResponse.json().catch(() => ({}));
    if (!clicksendResponse.ok) {
      console.error("ClickSend error", clicksendResponse.status, clicksendJson);
      return json({ error: clicksendJson?.response_msg || clicksendJson?.message || "ClickSend SMS failed", details: clicksendJson }, 502);
    }

    const firstMessage = clicksendJson?.data?.messages?.[0] || {};
    const providerMessageId = String(firstMessage.message_id || firstMessage.sms_id || "");
    const status = firstMessage.status || clicksendJson?.response_msg || "sent";

    const { data: savedMessage, error: messageError } = await supabaseAdmin
      .from("messages")
      .insert({
        job_id: jobId,
        channel: "sms",
        direction: "out",
        message_text: messageText,
        to_number: to,
        from_number: "ClickSend shared number",
        provider: "clicksend",
        provider_message_id: providerMessageId || null,
        status,
        unread: false,
        actioned: true,
        actioned_by: callerData.user.id,
        actioned_at: new Date().toISOString(),
        created_by: callerData.user.id,
        app_payload: { clicksend: clicksendJson, client_name: clientName },
      })
      .select("*")
      .single();

    if (messageError) throw messageError;

    const { error: historyError } = await supabaseAdmin.from("job_history").insert({
      job_id: jobId,
      action: "SMS sent",
      details: `SMS sent to ${clientName} (${to}) via ClickSend.`,
      created_by: callerData.user.id,
    });
    if (historyError) console.error("Could not write job history", historyError);

    return json({ ok: true, message: savedMessage, clicksend: clicksendJson });
  } catch (error) {
    console.error(error);
    return json({ error: error?.message || "SMS send failed" }, 500);
  }
});

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

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
