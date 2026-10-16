import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

const passportReadActions = {
  customer_detail: "Pasaport bilgisi müşteri detayında görüntülendi.",
  customer_edit: "Pasaport bilgisi düzenleme formunda görüntülendi.",
} as const;

export async function recordPassportRead(
  supabase: SupabaseClient<Database>,
  customerId: string,
  surface: keyof typeof passportReadActions,
) {
  const { data: { user } } = await supabase.auth.getUser();
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle();
  const { error } = await supabase.from("activity_log").insert({
    customer_id: customerId,
    action: passportReadActions[surface],
    performed_by: user?.email || "Sistem",
    performed_by_staff_id: staff?.id ?? null,
    type: "passport_access",
  });
  if (error) console.error("Pasaport erişim kaydı yazılamadı.");
}
