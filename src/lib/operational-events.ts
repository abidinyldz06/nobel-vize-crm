import "server-only";

import {
  errorCodeFrom,
  structuredLog,
} from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

type OperationalSeverity = "warning" | "error" | "critical";
type OperationalSource = "api" | "health" | "backup" | "restore" | "system";

type OperationalEventInput = {
  eventKey: string;
  severity: OperationalSeverity;
  source: OperationalSource;
  requestId?: string;
  route?: string;
  errorCode?: string;
};

export async function recordOperationalEvent(input: OperationalEventInput) {
  try {
    const { data, error } = await createSupabaseAdminClient().rpc(
      "record_operational_event_v1",
      {
        p_event_key: input.eventKey,
        p_severity: input.severity,
        p_source: input.source,
        p_request_id: input.requestId,
        p_route: input.route,
        p_error_code: input.errorCode,
      },
    );
    if (error) throw error;
    return data;
  } catch (error) {
    structuredLog("error", "operational_event.persist.failed", {
      requestId: input.requestId,
      operation: input.eventKey,
      errorCode: errorCodeFrom(error),
    });
    return null;
  }
}
