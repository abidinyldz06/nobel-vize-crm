import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import { loginAttemptKey } from "@/lib/login-security";

type AuthFailure = "google_login_failed" | "staff_account_required" | "inactive_account";

function redirectUrl(request: Request, path: string) {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "");
  const origin = configuredOrigin || new URL(request.url).origin;
  return new URL(path, origin);
}

function loginFailure(request: Request, failure: AuthFailure) {
  const url = redirectUrl(request, "/login");
  url.searchParams.set("auth_error", failure);
  const response = NextResponse.redirect(url);
  response.headers.set("Cache-Control", "private, no-store, max-age=0");
  return response;
}

export async function GET(request: Request) {
  const code = new URL(request.url).searchParams.get("code");
  if (!code || code.length > 4096) {
    return loginFailure(request, "google_login_failed");
  }

  const supabase = await createSupabaseServerClient();
  const { data: authData, error: exchangeError } =
    await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError || !authData.user) {
    await supabase.auth.signOut();
    return loginFailure(request, "google_login_failed");
  }

  const admin = createSupabaseAdminClient();
  const { data: staff, error: staffError } = await admin
    .from("staff")
    .select("id, role, is_active")
    .eq("user_id", authData.user.id)
    .maybeSingle();
  const attemptKey = loginAttemptKey(
    authData.user.email ?? authData.user.id,
    request.headers.get("x-forwarded-for"),
  );

  if (staffError || !staff) {
    await admin.rpc("record_login_attempt_v1", {
      p_key_hash: attemptKey,
      p_success: false,
      p_user_id: authData.user.id,
    });
    await supabase.auth.signOut();
    return loginFailure(request, "staff_account_required");
  }
  if (!staff.is_active) {
    await admin.rpc("record_login_attempt_v1", {
      p_key_hash: attemptKey,
      p_success: false,
      p_user_id: authData.user.id,
      p_staff_id: staff.id,
    });
    await supabase.auth.signOut();
    return loginFailure(request, "inactive_account");
  }

  const { data: company, error: companyError } = await admin
    .from("tenants")
    .select("admin_mfa_required, consultant_mfa_required")
    .single();
  if (companyError || !company || (staff.role !== "admin" && staff.role !== "consultant")) {
    await supabase.auth.signOut();
    return loginFailure(request, "staff_account_required");
  }

  await admin.rpc("record_login_attempt_v1", {
    p_key_hash: attemptKey,
    p_success: true,
    p_user_id: authData.user.id,
    p_staff_id: staff.id,
  });

  const mfaRequired = staff.role === "admin"
    ? company.admin_mfa_required
    : company.consultant_mfa_required;
  if (mfaRequired) {
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance.currentLevel !== "aal2") {
      return NextResponse.redirect(redirectUrl(request, "/mfa"));
    }
  }

  return NextResponse.redirect(redirectUrl(request, "/dashboard"));
}
