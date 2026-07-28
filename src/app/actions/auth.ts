"use server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"
import { headers } from "next/headers"
import { createSupabaseAdminClient } from "@/lib/supabase-admin"
import { loginAttemptKey, retryAfterMessage } from "@/lib/login-security"

export async function loginAction(formData: FormData) {
  const email = String(formData.get("email") ?? "")
  const password = String(formData.get("password") ?? "")

  if (!email || !password) {
    return { success: false, error: "E-posta ve şifre gereklidir." }
  }

  const requestHeaders = await headers()
  const attemptKey = loginAttemptKey(email, requestHeaders.get("x-forwarded-for"))
  const admin = createSupabaseAdminClient()
  const { data: rateLimit, error: rateLimitError } = await admin.rpc("check_login_rate_limit_v1", {
    p_key_hash: attemptKey,
  })
  if (rateLimitError) {
    return {
      success: false,
      error: "Giriş güvenliği geçici olarak doğrulanamıyor. Lütfen kısa süre sonra tekrar deneyin.",
      mfa: null,
    }
  }
  const rate = rateLimit as { allowed?: boolean; retry_after_seconds?: number } | null
  if (rate?.allowed === false) {
    return {
      success: false,
      error: retryAfterMessage(rate.retry_after_seconds ?? 900),
      mfa: null,
    }
  }

  const supabase = await createSupabaseServerClient()
  const startedAt = Date.now()
  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !authData.user) {
    await admin.rpc("record_login_attempt_v1", {
      p_key_hash: attemptKey,
      p_success: false,
    })
    const remainingDelay = 750 - (Date.now() - startedAt)
    if (remainingDelay > 0) await new Promise(resolve => setTimeout(resolve, remainingDelay))
    return { success: false, error: "E-posta veya şifre hatalı. Lütfen tekrar deneyin.", mfa: null }
  }

  // Check if staff record exists
  const { data: staffRecord } = await supabase.from('staff').select('*').eq('user_id', authData.user.id).limit(1).single()

  if (!staffRecord) {
    // Güvenlik: Sistemdeki ilk Auth kullanıcısını otomatik admin yapmak hesap
    // ele geçirme riski doğurur. İlk admin kontrollü kurulumda oluşturulur;
    // sonraki personeller yalnızca admin davetiyle sisteme katılır.
    await admin.rpc("record_login_attempt_v1", {
      p_key_hash: attemptKey,
      p_success: false,
      p_user_id: authData.user.id,
    })
    await supabase.auth.signOut()
    return { success: false, error: "Hesabınız personel kaydıyla eşleştirilmemiş. Lütfen yöneticinizle iletişime geçin.", mfa: null }
  } else if (!staffRecord.is_active) {
    await admin.rpc("record_login_attempt_v1", {
      p_key_hash: attemptKey,
      p_success: false,
      p_user_id: authData.user.id,
      p_staff_id: staffRecord.id,
    })
    await supabase.auth.signOut()
    return { success: false, error: "Hesabınız pasif duruma alınmış.", mfa: null }
  }

  await admin.rpc("record_login_attempt_v1", {
    p_key_hash: attemptKey,
    p_success: true,
    p_user_id: authData.user.id,
    p_staff_id: staffRecord.id,
  })

  const { data: company } = await supabase
    .from("tenants")
    .select("admin_mfa_required, consultant_mfa_required")
    .single()
  const mfaRequired = staffRecord.role === "admin"
    ? company?.admin_mfa_required !== false
    : company?.consultant_mfa_required === true
  if (mfaRequired) {
    const [{ data: factors }, { data: assurance }] = await Promise.all([
      supabase.auth.mfa.listFactors(),
      supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
    ])
    if (assurance?.currentLevel !== "aal2") {
      const verified = factors?.totp.find(factor => factor.status === "verified")
      return {
        success: true,
        error: null,
        mfa: {
          required: true,
          enrollmentRequired: !verified,
          factorId: verified?.id ?? null,
        },
      }
    }
  }

  // Production'da Server Action redirect'i hedef sayfayı aynı POST içinde
  // render edebilir. Yeni oturum çerezinin okunacağı ayrı bir tarayıcı isteği
  // başlatmak için başarılı sonucu istemciye döndürürüz.
  return { success: true, error: null, mfa: null }
}

export async function logoutAction() {
  const supabase = await createSupabaseServerClient()
  await supabase.auth.signOut()
  revalidatePath("/", "layout")
  redirect("/")
}

export async function getUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
}
