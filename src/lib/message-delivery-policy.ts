import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../types/database";
import type { DeliveryMessage } from "./message-delivery";

export async function deliveryAllowed(admin: SupabaseClient<Database>, message: DeliveryMessage) {
  const [{ data: customer, error: customerError }, { data: preference, error: preferenceError }] = await Promise.all([
    admin.from("customers").select("id").eq("id", message.customer_id).eq("is_deleted", false).maybeSingle(),
    admin.from("communication_preferences").select("allowed")
      .eq("customer_id", message.customer_id).eq("channel", message.channel)
      .eq("purpose", message.purpose).maybeSingle(),
  ]);
  if (customerError) throw customerError;
  if (preferenceError) throw preferenceError;
  if (!customer || preference?.allowed !== true) return false;
  if (message.purpose === "transactional") return true;
  if (message.purpose !== "marketing") return false;

  const { data: consent, error } = await admin.from("customer_consents")
    .select("decision").eq("customer_id", message.customer_id).eq("consent_type", "marketing")
    .order("decision_at", { ascending: false }).order("created_at", { ascending: false })
    .order("id", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return consent?.decision === "granted";
}
