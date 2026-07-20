import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";

export interface CustomerApplicationPayload {
  customer_id?: string;
  first_name: string;
  last_name: string;
  phone?: string | null;
  email?: string | null;
  profile_score?: number;
  passport_no?: string | null;
  passport_expiry?: string | null;
  passport_issuing_country?: string | null;
  customer_notes?: string | null;
  country_id?: string | null;
  country_name?: string | null;
  visa_type?: string;
  matched_rule_id?: string | null;
  travel_method?: string | null;
  accommodation?: string | null;
  occupation?: string | null;
  with_children?: string | boolean | null;
  nationality?: string | null;
  assigned_staff_id?: string | null;
  consulate_fee?: string | number | null;
  service_fee?: string | number | null;
  consultant_note?: string | null;
  activity_action?: string | null;
  reject_duplicate_application?: boolean;
}

export interface CustomerApplicationResult {
  customer_id: string;
  application_id: string | null;
  country_id: string | null;
  matched_rule_id: string | null;
  existing_customer: boolean;
}

export class CustomerWorkflowError extends Error {
  readonly code: string;
  readonly details: string | null;

  constructor(error: PostgrestError) {
    super(error.message);
    this.name = "CustomerWorkflowError";
    this.code = error.code;
    this.details = error.details;
  }
}

function isWorkflowResult(value: unknown): value is CustomerApplicationResult {
  if (!value || typeof value !== "object") return false;
  const result = value as Record<string, unknown>;
  return typeof result.customer_id === "string"
    && (typeof result.application_id === "string" || result.application_id === null)
    && (typeof result.country_id === "string" || result.country_id === null)
    && (typeof result.matched_rule_id === "string" || result.matched_rule_id === null)
    && typeof result.existing_customer === "boolean";
}

export async function runCustomerApplicationWorkflow(
  supabase: SupabaseClient,
  payload: CustomerApplicationPayload,
): Promise<CustomerApplicationResult> {
  const { data, error } = await supabase.rpc("create_customer_application_v1", {
    p_payload: payload,
  });

  if (error) throw new CustomerWorkflowError(error);
  if (!isWorkflowResult(data)) {
    throw new Error("Müşteri iş akışı beklenmeyen bir sonuç döndürdü.");
  }

  return data;
}
