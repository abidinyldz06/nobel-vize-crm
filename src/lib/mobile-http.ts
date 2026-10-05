import { NextResponse } from "next/server";

import { MobileAccessError } from "@/lib/mobile-session";
import { errorCodeFrom, requestIdFrom, structuredLog } from "@/lib/observability";

export function mobileJson(request: Request, body: Record<string, unknown>, status = 200) {
  const requestId = requestIdFrom(request);
  return NextResponse.json(
    { ...body, requestId },
    { status, headers: { "cache-control": "no-store", "x-request-id": requestId } },
  );
}

export function mobileAccessResponse(request: Request, error: unknown) {
  if (error instanceof MobileAccessError) {
    return mobileJson(request, { code: error.code, message: error.message }, error.status);
  }
  structuredLog("error", "mobile.access.failed", {
    requestId: requestIdFrom(request),
    operation: "mobile.access",
    errorCode: errorCodeFrom(error),
  });
  return mobileJson(request, { code: "mobile_access_failed", message: "İşlem tamamlanamadı." }, 500);
}
