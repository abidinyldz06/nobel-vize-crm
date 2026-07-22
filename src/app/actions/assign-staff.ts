"use server"
import { requireAdmin } from "@/lib/authz"
import { revalidatePath } from "next/cache"

export async function assignStaff(customerId: string, staffId: string | null) {
  const { supabase, user } = await requireAdmin()

  const { error } = await supabase
    .from('customers')
    .update({ assigned_staff_id: staffId })
    .eq('id', customerId)
    .eq('is_deleted', false)

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
