import { createSupabaseServerClient } from "@/lib/supabase-server";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q');

  if (!q || q.length < 2) {
    return NextResponse.json([]);
  }

  const supabase = await createSupabaseServerClient();
  const searchPattern = `%${q}%`;

  const { data: customers, error } = await supabase
    .from('customers')
    .select('id, first_name, last_name, phone, email, passport_no')
    .or(`first_name.ilike.${searchPattern},last_name.ilike.${searchPattern},phone.ilike.${searchPattern},email.ilike.${searchPattern},passport_no.ilike.${searchPattern}`)
    .limit(5);

  if (error) {
    console.error("Search error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(customers);
}
