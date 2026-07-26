import "server-only";

import { NextResponse } from "next/server";
import { AuthorizationError } from "@/lib/authz";
import { errorCodeFrom, structuredLog } from "@/lib/observability";

export function authorizationErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  structuredLog("error", "authorization.check.failed", {
    operation: "authorization.check",
    errorCode: errorCodeFrom(error),
  });
  return NextResponse.json({ error: "Yetkilendirme kontrolü tamamlanamadı." }, { status: 500 });
}
