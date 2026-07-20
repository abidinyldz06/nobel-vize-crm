"use server"
import { requireStaff } from "@/lib/authz"
import { runCustomerApplicationWorkflow } from "@/lib/customer-workflow"
import { revalidatePath } from "next/cache"
import { redirect } from "next/navigation"

export async function createCustomerWithApplication(formData: FormData) {
  const { supabase, staff } = await requireStaff()
  const firstName = formData.get('firstName') as string
  const lastName = formData.get('lastName') as string
  const phone = formData.get('phone') as string
  const email = formData.get('email') as string
  const countryId = formData.get('countryId') as string
  const visaType = formData.get('visaType') as string || 'turistik'
  const consulateFeeStr = formData.get('consulateFee') as string
  const serviceFeeStr = formData.get('serviceFee') as string
  const assignedStaffId = formData.get('assignedStaffId') as string
  const consultantNote = formData.get('consultantNote') as string
  const matchedRuleId = formData.get('matchedRuleId') as string
  const travelMethod = formData.get('travelMethod') as string
  const accommodation = formData.get('accommodation') as string
  const occupation = formData.get('occupation') as string
  const withChildren = formData.get('withChildren') as string
  const nationality = formData.get('nationality') as string
  
  // Passport Data
  const passportNo = formData.get('passportNo') as string
  const passportExpiry = formData.get('passportExpiry') as string
  const passportIssuingCountry = formData.get('passportIssuingCountry') as string || 'Türkiye'

  const finalAssignedStaffId = staff.role === 'admin' ? assignedStaffId : staff.id

  let customerId: string
  try {
    const result = await runCustomerApplicationWorkflow(supabase, {
      first_name: firstName,
      last_name: lastName,
      phone,
      email: email || null,
      profile_score: 30,
      passport_no: passportNo || null,
      passport_expiry: passportExpiry || null,
      passport_issuing_country: passportIssuingCountry,
      customer_notes: consultantNote || null,
      country_id: countryId || null,
      visa_type: visaType,
      matched_rule_id: matchedRuleId || null,
      travel_method: travelMethod || null,
      accommodation: accommodation || null,
      occupation: occupation || null,
      with_children: withChildren || null,
      nationality: nationality || null,
      assigned_staff_id: finalAssignedStaffId || null,
      consulate_fee: consulateFeeStr || null,
      service_fee: serviceFeeStr || null,
    })
    customerId = result.customer_id
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Müşteri oluşturulamadı'
    console.error("Atomic customer workflow error:", message)
    redirect('/customers/new?error=' + encodeURIComponent(message))
  }

  revalidatePath('/customers')
  redirect(`/customers/${customerId}`)
}
