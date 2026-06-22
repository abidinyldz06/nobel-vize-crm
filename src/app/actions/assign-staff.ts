"use server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"

export async function assignStaff(customerId: string, staffId: string | null) {
  const supabase = await createSupabaseServerClient()

  // Sadece Admin yetkisi olanlar atama yapabilir
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Yetkisiz işlem." }

  const { data: currentStaff } = await supabase.from('staff').select('role').eq('user_id', user.id).single()
  if (currentStaff?.role !== 'admin') {
    return { error: "Sadece yöneticiler danışman ataması yapabilir." }
  }

  const { error } = await supabase
    .from('customers')
    .update({ assigned_staff_id: staffId })
    .eq('id', customerId)

  if (error) {
    return { error: "Danışman atanırken hata oluştu: " + error.message }
  }

  // Activity log ekleyelim
  await supabase.from('activity_log').insert([{
    customer_id: customerId,
    action: staffId ? "Müşteriye yeni danışman atandı." : "Müşterinin danışman ataması kaldırıldı.",
    performed_by: user.email || 'Sistem',
  }])

  revalidatePath('/customers')
  revalidatePath(`/customers/${customerId}`)
  
  return { success: true }
}
