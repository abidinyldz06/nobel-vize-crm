"use server"
import { requireStaff } from "@/lib/authz"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateCustomer(formData: FormData) {
  const { supabase, user, staff } = await requireStaff()
  const id = formData.get('id') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const financialStatus = formData.get('financialStatus') as string
  const monthlyIncome = formData.get('monthlyIncome') ? parseInt(formData.get('monthlyIncome') as string) : null
  const assignedStaffId = formData.get('assignedStaffId') as string
  const notes = formData.get('notes') as string
  
  // Passport Data
  const passportNo = formData.get('passportNo') as string
  const passportExpiry = formData.get('passportExpiry') as string
  const passportIssuingCountry = formData.get('passportIssuingCountry') as string || 'Türkiye'

  // Profil skoru otomatik hesapla
  let profileScore = 30 // base
  if (email) profileScore += 10
  if (phone) profileScore += 10
  if (financialStatus === 'iyi') profileScore += 15
  if (financialStatus === 'yuksek') profileScore += 25
  if (financialStatus === 'orta') profileScore += 10
  if (monthlyIncome && monthlyIncome > 20000) profileScore += 10
  if (monthlyIncome && monthlyIncome > 50000) profileScore += 10
  // Max 100
  profileScore = Math.min(100, profileScore)

  const isAdmin = staff.role === 'admin'

  const updateData: any = {
    first_name: firstName,
    last_name: lastName,
    phone,
    email: email || null,
    financial_status: financialStatus || null,
    monthly_income: monthlyIncome,
    notes: notes || null,
    profile_score: profileScore,
    passport_no: passportNo || null,
    passport_expiry: passportExpiry || null,
    passport_issuing_country: passportIssuingCountry,
  }

  // Sadece adminler atama değiştirebilir. Danışmanlar değiştiremez.
  if (isAdmin) {
    updateData.assigned_staff_id = assignedStaffId || null;
  }

  const { error } = await supabase
    .from('customers')
    .update(updateData)
    .eq('id', id)

  if (error) {
    console.error("Update error:", error.message)
    redirect(`/customers/${id}/edit?error=` + encodeURIComponent(error.message))
  }

  await supabase.from('activity_log').insert([{
    customer_id: id,
    action: "Müşteri bilgileri güncellendi",
    performed_by: user?.email || 'Danışman',
  }])

  revalidatePath(`/customers/${id}`)
  revalidatePath('/customers')
  redirect(`/customers/${id}`)
}

export async function addAppointment(formData: FormData) {
  const { supabase, user } = await requireStaff()
  const customerId = formData.get('customerId') as string
  const applicationId = formData.get('applicationId') as string
  const date = formData.get('date') as string
  const time = formData.get('time') as string
  const location = formData.get('location') as string
  const system = formData.get('appointmentSystem') as string || 'VFS'
  const note = formData.get('appointmentNote') as string

  const datetime = `${date}T${time}:00`

  const { error } = await supabase
    .from('applications')
    .update({
      appointment_date: datetime,
      appointment_location: location,
      status: 'randevu_alindi'
    })
    .eq('id', applicationId)

  if (error) {
    console.error("Appointment error:", error.message)
    redirect(`/customers/${customerId}?error=` + encodeURIComponent(error.message))
  }

  // Log activity
  await supabase.from('activity_log').insert([{
    application_id: applicationId,
    customer_id: customerId,
    action: `Randevu eklendi: ${system} — ${new Date(datetime).toLocaleString('tr-TR')} (${location})`,
    performed_by: user?.email || 'Danışman',
  }])

  revalidatePath(`/customers/${customerId}`)
  redirect(`/customers/${customerId}`)
}

export async function checkAppointmentDensity(dateStr: string, location: string) {
  if (!dateStr || !location) return [];
  
  const { supabase } = await requireStaff();
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return [];
  
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const { data, error } = await supabase
    .from('applications')
    .select('id, appointment_date, customers!inner(first_name, last_name)')
    .not('appointment_date', 'is', null)
    .gte('appointment_date', startOfDay.toISOString())
    .lte('appointment_date', endOfDay.toISOString())
    .ilike('appointment_location', `%${location.trim()}%`);

  if (error || !data) return [];
  
  return data.map((app: any) => ({
    id: app.id,
    time: new Date(app.appointment_date).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }),
    customerName: `${app.customers.first_name} ${app.customers.last_name}`
  })).sort((a: any, b: any) => a.time.localeCompare(b.time));
}
