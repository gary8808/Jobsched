import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    if (!supabaseUrl || !serviceKey) {
      return json({ error: "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" }, 500);
    }

    const authHeader = req.headers.get("Authorization") || "";
    const jwt = authHeader.replace("Bearer ", "").trim();

    if (!jwt) {
      return json({ error: "Not signed in" }, 401);
    }

    const supabaseAdmin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const { data: callerData, error: callerError } = await supabaseAdmin.auth.getUser(jwt);
    if (callerError || !callerData?.user) {
      return json({ error: "Invalid user session" }, 401);
    }

    const { data: callerProfile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("role, active")
      .eq("id", callerData.user.id)
      .maybeSingle();

    if (profileError) throw profileError;

    if (!callerProfile?.active || callerProfile.role !== "admin") {
      return json({ error: "Only admin users can invite employees" }, 403);
    }

    const body = await req.json();
    const email = String(body.email || "").trim().toLowerCase();
    const fullName = String(body.full_name || email).trim();
    const workerId = String(body.worker_id || "").trim();
    const role = body.role === "admin" ? "admin" : body.role === "warehouse" ? "warehouse" : "employee";
    const redirectTo = String(body.redirect_to || "").trim() || undefined;

    if (!email || !workerId) {
      return json({ error: "worker_id and email are required" }, 400);
    }

    const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: {
        full_name: fullName,
        role,
        worker_id: workerId,
      },
    });

    if (inviteError) throw inviteError;

    const invitedUser = inviteData.user;
    if (!invitedUser?.id) {
      return json({ error: "Invite did not return a user id" }, 500);
    }

    const { error: profileUpsertError } = await supabaseAdmin
      .from("profiles")
      .upsert({
        id: invitedUser.id,
        full_name: fullName,
        role,
        active: true,
      }, { onConflict: "id" });

    if (profileUpsertError) throw profileUpsertError;

    const { error: workerUpdateError } = await supabaseAdmin
      .from("workers")
      .update({
        profile_id: invitedUser.id,
        email,
        name: fullName,
        app_role: role,
        invite_requested: false,
        invite_status: "sent",
        invited_at: new Date().toISOString(),
        access_revoked: false,
      })
      .eq("id", workerId);

    if (workerUpdateError) throw workerUpdateError;

    return json({ ok: true, user_id: invitedUser.id, email, role });
  } catch (error) {
    console.error(error);
    return json({ error: error?.message || "Invite failed" }, 500);
  }
});

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
