"use server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"

export async function changePassword(formData: FormData) {
  const newPassword = formData.get("newPassword") as string
  const confirmPassword = formData.get("confirmPassword") as string

  if (!newPassword || newPassword.length < 6) {
    return { error: "Şifre en az 6 karakter olmalıdır." }
  }

  if (newPassword !== confirmPassword) {
    return { error: "Şifreler eşleşmiyor." }
  }

  const supabase = await createSupabaseServerClient()

  const { error } = await supabase.auth.updateUser({
    password: newPassword
  })

  if (error) {
    return { error: "Şifre güncellenirken hata oluştu: " + error.message }
  }

  revalidatePath("/", "layout")
  return { success: "Şifreniz başarıyla güncellendi." }
}
