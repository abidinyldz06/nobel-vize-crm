import "server-only";

import { errorCodeFrom } from "@/lib/observability";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export type HealthCheckStatus = "ok" | "failed";

export type ReadinessResult = {
  ready: boolean;
  checkedAt: string;
  checks: {
    configuration: HealthCheckStatus;
    database: HealthCheckStatus;
    storage: HealthCheckStatus;
  };
  errorCodes: string[];
};

const READINESS_TIMEOUT_MS = 2_500;
const REQUIRED_ENVIRONMENT_KEYS = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "GOOGLE_FORM_WEBHOOK_SECRET",
] as const;

async function withTimeout<T>(operation: Promise<T>, timeoutCode: string) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(Object.assign(new Error("readiness_timeout"), { code: timeoutCode })),
          READINESS_TIMEOUT_MS,
        );
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

export async function checkReadiness(): Promise<ReadinessResult> {
  const checks: ReadinessResult["checks"] = {
    configuration: "ok",
    database: "failed",
    storage: "failed",
  };
  const errorCodes: string[] = [];

  const missingConfiguration = REQUIRED_ENVIRONMENT_KEYS.some(key => !process.env[key]);
  if (missingConfiguration) {
    checks.configuration = "failed";
    errorCodes.push("configuration_missing");
    return {
      ready: false,
      checkedAt: new Date().toISOString(),
      checks,
      errorCodes,
    };
  }

  const admin = createSupabaseAdminClient();
  const [databaseResult, storageResult] = await Promise.allSettled([
    withTimeout(
      Promise.resolve(admin.from("tenants").select("id").limit(1)).then(({ error }) => {
        if (error) throw error;
      }),
      "database_timeout",
    ),
    withTimeout(
      admin.storage.getBucket("documents").then(({ data, error }) => {
        if (error || !data || data.public) {
          throw error ?? Object.assign(new Error("documents_bucket_invalid"), {
            code: "documents_bucket_invalid",
          });
        }
      }),
      "storage_timeout",
    ),
  ]);

  if (databaseResult.status === "fulfilled") {
    checks.database = "ok";
  } else {
    errorCodes.push(errorCodeFrom(databaseResult.reason));
  }

  if (storageResult.status === "fulfilled") {
    checks.storage = "ok";
  } else {
    errorCodes.push(errorCodeFrom(storageResult.reason));
  }

  return {
    ready: Object.values(checks).every(status => status === "ok"),
    checkedAt: new Date().toISOString(),
    checks,
    errorCodes,
  };
}

export async function checkBackupFreshness(maxAgeHours = 36) {
  try {
    const { data, error } = await createSupabaseAdminClient()
      .from("backup_runs")
      .select("verified_at")
      .eq("status", "verified")
      .order("verified_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw error;

    const verifiedAt = data?.verified_at ? Date.parse(data.verified_at) : Number.NaN;
    const stale = !Number.isFinite(verifiedAt)
      || Date.now() - verifiedAt > maxAgeHours * 60 * 60 * 1000;
    return { stale, errorCode: stale ? "verified_backup_stale" : null };
  } catch (error) {
    return { stale: true, errorCode: errorCodeFrom(error) };
  }
}
