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
    if (!supabaseUrl || !serviceKey) return json({ error: "Missing Supabase service configuration" }, 500);

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!jwt) return json({ error: "Not signed in" }, 401);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const { data: caller, error: callerError } = await admin.auth.getUser(jwt);
    if (callerError || !caller?.user) return json({ error: "Invalid user session" }, 401);

    const { data: profile, error: profileError } = await admin.from("profiles").select("role,active").eq("id", caller.user.id).maybeSingle();
    if (profileError) throw profileError;
    if (profile?.role !== "admin" || profile?.active === false) return json({ error: "Admin permission required" }, 403);

    const body = await req.json();
    const workerId = String(body.worker_id || "").trim();
    const action = String(body.action || "revoke").toLowerCase();
    if (!workerId) return json({ error: "worker_id is required" }, 400);
    if (!["revoke", "restore"].includes(action)) return json({ error: "action must be revoke or restore" }, 400);

    const { data: worker, error: workerError } = await admin.from("workers").select("id,profile_id,email,name").eq("id", workerId).maybeSingle();
    if (workerError) throw workerError;
    if (!worker) return json({ error: "Worker not found" }, 404);

    if (action === "restore") {
      const { error: workerUpdateError } = await admin.from("workers").update({
        access_revoked: false,
        inactive: false,
        updated_at: new Date().toISOString(),
      }).eq("id", workerId);
      if (workerUpdateError) throw workerUpdateError;

      if (worker.profile_id) {
        const { error: profileUpdateError } = await admin.from("profiles").update({ active: true }).eq("id", worker.profile_id);
        if (profileUpdateError) throw profileUpdateError;
        const { error: unbanError } = await admin.auth.admin.updateUserById(worker.profile_id, { ban_duration: "none" });
        if (unbanError) throw unbanError;
      }
      return json({ ok: true, action: "restore", worker_id: workerId, user_id: worker.profile_id || null });
    }

    const { error: workerUpdateError } = await admin.from("workers").update({
      access_revoked: true,
      inactive: true,
      invite_requested: false,
      updated_at: new Date().toISOString(),
    }).eq("id", workerId);
    if (workerUpdateError) throw workerUpdateError;

    if (worker.profile_id) {
      const { error: profileUpdateError } = await admin.from("profiles").update({ active: false }).eq("id", worker.profile_id);
      if (profileUpdateError) throw profileUpdateError;
      const { error: banError } = await admin.auth.admin.updateUserById(worker.profile_id, { ban_duration: "876000h" });
      if (banError) throw banError;
    }

    return json({ ok: true, action: "revoke", worker_id: workerId, user_id: worker.profile_id || null });
  } catch (error) {
    console.error(error);
    return json({ error: error?.message || "Could not update worker access" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
