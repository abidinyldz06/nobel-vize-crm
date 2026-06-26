import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json({ customers: [], countries: [], applications: [] });
  }

  const supabase = await createSupabaseServerClient();
  const searchPattern = `%${q}%`;

  // 1. Search Customers
  const { data: customers } = await supabase
    .from('customers')
    .select('id, first_name, last_name, phone, email, passport_no')
    .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern},passport_no.ilike.${searchPattern}`)
    .limit(5);

  // 2. Search Countries
  const { data: countries } = await supabase
    .from('visa_requirements')
    .select('country, visa_type')
    .ilike('country', searchPattern)
    .limit(5);

  // Unique countries (since visa_requirements has multiple types per country)
  const uniqueCountries = [];
  const countryNames = new Set();
  if (countries) {
    for (const c of countries) {
      if (!countryNames.has(c.country)) {
        countryNames.add(c.country);
        uniqueCountries.push(c);
      }
    }
  }

  // 3. Search Applications (by country or status, and join customer name)
  const { data: applications } = await supabase
    .from('applications')
    .select('id, country, status, customer_id, customers!inner(first_name, last_name)')
    .or(`country.ilike.${searchPattern},status.ilike.${searchPattern}`)
    .limit(5);

  return NextResponse.json({
    customers: customers || [],
    countries: uniqueCountries.slice(0, 5),
    applications: applications || []
  });
}
