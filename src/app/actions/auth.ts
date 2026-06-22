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
    // If staff record does not exist, check if table is empty
    const { count } = await supabase.from('staff').select('*', { count: 'exact', head: true })
    
    if (count === 0) {
      // First user ever -> bootstrap as admin
      const { error: insertError } = await supabase.from('staff').insert({
        user_id: authData.user.id,
        full_name: email.split('@')[0], // Extract name from email
        email: email,
        role: 'admin',
        is_active: true
      })
      if (insertError) {
        await supabase.auth.signOut()
        return { error: "Sistem başlatılırken hata oluştu: " + insertError.message }
      }
    } else {
      // Not empty, but no staff record -> unauthorized
      await supabase.auth.signOut()
      return { error: "Hesabınız henüz onaylanmamış. Lütfen yöneticinizle iletişime geçin." }
    }
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
