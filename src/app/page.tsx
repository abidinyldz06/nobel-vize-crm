import LoginForm from "@/components/LoginForm"

const AUTH_ERROR_MESSAGES: Record<string, string> = {
  google_login_failed: "Google ile giriş tamamlanamadı. Lütfen tekrar deneyin.",
  staff_account_required: "Bu Google hesabı aktif bir personel kaydıyla eşleşmiyor.",
  inactive_account: "Bu hesaba bağlı personel kaydı pasif durumda.",
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ auth_error?: string | string[] }>
}) {
  const errorCode = (await searchParams).auth_error
  const normalizedCode = Array.isArray(errorCode) ? errorCode[0] : errorCode
  return <LoginForm initialError={normalizedCode ? AUTH_ERROR_MESSAGES[normalizedCode] ?? null : null} />
}
