import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { authorizationErrorResponse } from "@/lib/api-auth";

export async function GET(request: Request) {
  let supabase;
  try {
    ({ supabase } = await requireStaff());
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json({ customers: [], countries: [], applications: [] });
  }

  const normalizedQuery = q.trim().slice(0, 100);
  const searchPattern = `%${normalizedQuery.replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;

  // 1. Search Customers
  const customerFields = ['first_name', 'last_name', 'phone', 'email', 'passport_no'] as const;
  const customerResults = await Promise.all(
    customerFields.map(field => supabase
      .from('customers')
      .select('id, first_name, last_name, phone, email, passport_no')
      .eq('is_deleted', false)
      .ilike(field, searchPattern)
      .limit(5)),
  );
  const customers = Array.from(
    new Map(customerResults.flatMap(result => result.data || []).map(customer => [customer.id, customer])).values(),
  ).slice(0, 5);

  // 2. Search Countries
  const { data: countries } = await supabase
    .from('countries')
    .select('id, name, visa_system')
    .ilike('name', searchPattern)
    .limit(5);

  // 3. Search Applications (by country or status, and join customer name)
  const applicationResults = await Promise.all(
    ['country', 'status'].map(field => supabase
      .from('applications')
      .select('id, country, status, customer_id, customers!inner(first_name, last_name)')
      .eq('customers.is_deleted', false)
      .ilike(field, searchPattern)
      .limit(5)),
  );
  const applications = Array.from(
    new Map(applicationResults.flatMap(result => result.data || []).map(application => [application.id, application])).values(),
  ).slice(0, 5);

  return NextResponse.json({
    customers,
    countries: (countries || []).map(country => ({
      id: country.id,
      country: country.name,
      visa_type: country.visa_system,
    })),
    applications,
  });
}
