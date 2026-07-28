"use server"
import { requireStaff } from "@/lib/authz"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function updateCustomer(formData: FormData) {
  const { supabase, staff } = await requireStaff()
  const id = formData.get('id') as string
  const applicationId = formData.get('applicationId') as string
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const financialStatus = formData.get('financialStatus') as string
  const monthlyIncome = formData.get('monthlyIncome') ? parseInt(formData.get('monthlyIncome') as string) : null
  const assignedStaffId = formData.get('assignedStaffId') as string
  const notes = formData.get('notes') as string
  const countryId = formData.get('countryId') as string
  const visaType = formData.get('visaType') as string
  const applicationStatus = formData.get('applicationStatus') as string
  const rejectionReason = formData.get('rejectionReason') as string
  const travelMethod = formData.get('travelMethod') as string
  const accommodation = formData.get('accommodation') as string
  const occupation = formData.get('occupation') as string
  const withChildren = formData.get('withChildren') as string
  const nationality = formData.get('nationality') as string
  const tagIds = formData.getAll('tagIds').map(value => String(value))
  
  // Passport Data
  const passportNo = formData.get('passportNo') as string
  const passportExpiry = formData.get('passportExpiry') as string
  const passportIssuingCountry = formData.get('passportIssuingCountry') as string || 'Türkiye'

  const { error } = await supabase.rpc('update_customer_application_v1', {
    p_customer_id: id,
    p_application_id: applicationId,
    p_payload: {
      first_name: firstName,
      last_name: lastName,
      phone,
      email: email || null,
      financial_status: financialStatus || 'orta',
      monthly_income: monthlyIncome,
      notes: notes || null,
      passport_no: passportNo || null,
      passport_expiry: passportExpiry || null,
      passport_issuing_country: passportIssuingCountry,
      assigned_staff_id: staff.role === 'admin' ? (assignedStaffId || null) : undefined,
      country_id: countryId,
      visa_type: visaType,
      status: applicationStatus,
      rejection_reason: rejectionReason || null,
      travel_method: travelMethod || null,
      accommodation: accommodation || null,
      occupation: occupation || null,
      with_children: withChildren || null,
      nationality: nationality || null,
      tag_ids: tagIds,
    },
  })

  if (error) {
    console.error("Update error:", error.message)
    redirect(`/customers/${id}/edit?error=` + encodeURIComponent(error.message))
  }

  revalidatePath(`/customers/${id}`)
  revalidatePath('/applications')
  revalidatePath('/customers')
  redirect(`/customers/${id}`)
}

export async function addAppointment(formData: FormData) {
  const { supabase } = await requireStaff()
  const customerId = formData.get('customerId') as string
  const applicationId = formData.get('applicationId') as string
  const date = formData.get('date') as string
  const time = formData.get('time') as string
  const location = formData.get('location') as string
  const system = formData.get('appointmentSystem') as string || 'VFS'
  const datetime = `${date}T${time}:00+03:00`

  const { error } = await supabase.rpc('set_application_appointment_v1', {
    p_application_id: applicationId,
    p_appointment_date: datetime,
    p_location: location,
    p_system: system,
  })

  if (error) {
    console.error("Appointment error:", error.message)
    redirect(`/customers/${customerId}?error=` + encodeURIComponent(error.message))
  }

  revalidatePath(`/customers/${customerId}`)
  redirect(`/customers/${customerId}`)
}

export async function checkAppointmentConflicts(applicationId: string, dateStr: string, time: string) {
  if (!applicationId || !dateStr || !time) return [];
  const { supabase } = await requireStaff();
  const { data, error } = await supabase.rpc("list_appointment_conflicts_v1", {
    p_application_id: applicationId,
    p_appointment_date: `${dateStr}T${time}:00+03:00`,
    p_duration_minutes: 60,
  });

  if (error || !data) return [];
  return data.map((app) => ({
    id: app.application_id,
    time: new Date(app.appointment_date).toLocaleTimeString("tr-TR", {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul",
    }),
    customerName: app.customer_name,
  })).sort((a, b) => a.time.localeCompare(b.time));
}
