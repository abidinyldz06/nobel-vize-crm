"use server"
import { createSupabaseServerClient } from "@/lib/supabase-server"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createCustomerWithApplication(formData: FormData) {
  const supabase = await createSupabaseServerClient()
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const countryId = formData.get('countryId') as string
  const countryName = formData.get('countryName') as string
  const visaType = formData.get('visaType') as string || 'turist'
  const consulateFeeStr = formData.get('consulateFee') as string
  const serviceFeeStr = formData.get('serviceFee') as string
  const assignedStaffId = formData.get('assignedStaffId') as string
  const consultantNote = formData.get('consultantNote') as string
  
  // Passport Data
  const passportNo = formData.get('passportNo') as string
  const passportExpiry = formData.get('passportExpiry') as string
  const passportIssuingCountry = formData.get('passportIssuingCountry') as string || 'Türkiye'

  // 1. Create Customer
  const customerData: any = {
    first_name: firstName,
    last_name: lastName,
    phone,
    email: email || null,
    profile_score: 30, // Başlangıç skoru — evraklar geldikçe otomatik artacak
    notes: consultantNote || null,
    passport_no: passportNo || null,
    passport_expiry: passportExpiry || null,
    passport_issuing_country: passportIssuingCountry,
  }

  if (assignedStaffId) {
    customerData.assigned_staff_id = assignedStaffId
  }

  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .insert([customerData])
    .select()
    .single()

  if (customerError) {
    console.error("Customer insert error:", customerError.message)
    redirect('/customers/new?error=' + encodeURIComponent(customerError.message))
  }

  // 2. Determine country info
  let resolvedCountryName = countryName || ''
  let baseFee = 0
  let checklist: string[] = []

  if (countryId) {
    const { data: country } = await supabase.from('countries').select('*').eq('id', countryId).single()
    if (country) {
      resolvedCountryName = country.name
      baseFee = country.base_fee || 0
      checklist = country.document_checklist || []
    }
  }

  // Use custom fee if provided, else use base fee from country
  const consulateFee = consulateFeeStr ? parseInt(consulateFeeStr) : 0
  const serviceFee = serviceFeeStr ? parseInt(serviceFeeStr) : baseFee
  const totalFee = consulateFee + serviceFee

  if (resolvedCountryName) {
    // 3. Create Application
    const appData: any = {
      customer_id: customer.id,
      country: resolvedCountryName,
      consulate_fee: consulateFee,
      service_fee: serviceFee,
      total_fee: totalFee,
      status: 'profil_analizi',
      visa_type: visaType,
    }

    if (assignedStaffId) {
      appData.assigned_staff_id = assignedStaffId
    }

    const { data: application, error: appError } = await supabase
      .from('applications')
      .insert([appData])
      .select()
      .single()

    if (appError) {
      console.error("Application insert error:", appError.message)
      redirect(`/customers/${customer.id}`)
    }

    // 4. Create Documents based on checklist
    if (checklist.length > 0) {
      const docs = checklist.map(doc => ({
        application_id: application.id,
        document_type: doc,
        status: 'bekleniyor'
      }))
      await supabase.from('documents').insert(docs)
    }

    // 5. Log activity
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('activity_log').insert([{
      application_id: application.id,
      customer_id: customer.id,
      action: `Yeni başvuru oluşturuldu: ${resolvedCountryName} — ${visaType} vizesi`,
      performed_by: user?.email || 'Danışman',
    }])
  }

  revalidatePath('/customers')
  redirect(`/customers/${customer.id}`)
}
