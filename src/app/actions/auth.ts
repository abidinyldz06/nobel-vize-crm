"use server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { redirect } from "next/navigation"
import { revalidatePath } from "next/cache"

export async function loginAction(formData: FormData) {
  const email = formData.get("email") as string
  const password = formData.get("password") as string

  if (!email || !password) {
    return { error: "E-posta ve şifre gereklidir." }
  }

  const supabase = await createSupabaseServerClient()

  const { data: authData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error || !authData.user) {
    return { error: "E-posta veya şifre hatalı. Lütfen tekrar deneyin." }
  }

  // Check if staff record exists
  const { data: staffRecord } = await supabase.from('staff').select('*').eq('user_id', authData.user.id).limit(1).single()

  if (!staffRecord) {
    // Güvenlik: Sistemdeki ilk Auth kullanıcısını otomatik admin yapmak hesap
    // ele geçirme riski doğurur. İlk admin kontrollü kurulumda oluşturulur;
    // sonraki personeller yalnızca admin davetiyle sisteme katılır.
    await supabase.auth.signOut()
    return { error: "Hesabınız personel kaydıyla eşleştirilmemiş. Lütfen yöneticinizle iletişime geçin." }
  } else if (!staffRecord.is_active) {
    await supabase.auth.signOut()
    return { error: "Hesabınız pasif duruma alınmış." }
  }

  revalidatePath("/", "layout")
  redirect("/dashboard")
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
