export const REQUEST_ID_HEADER = "x-request-id";

export type LogLevel = "info" | "warn" | "error";

export type LogContext = {
  requestId?: string;
  route?: string;
  method?: string;
  status?: number;
  durationMs?: number;
  operation?: string;
  actorStaffId?: string;
  resourceType?: string;
  resourceId?: string;
  errorCode?: string;
};

type ObservedRouteHandler<Context> = (
  request: Request,
  context: Context,
) => Response | Promise<Response>;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SAFE_TOKEN_PATTERN = /^[a-zA-Z0-9_.:/-]{1,200}$/;

function safeToken(value: string | undefined) {
  if (!value || !SAFE_TOKEN_PATTERN.test(value)) return undefined;
  return value;
}

export function isRequestId(value: string | null | undefined): value is string {
  return Boolean(value && UUID_PATTERN.test(value));
}

export function createRequestId() {
  return crypto.randomUUID();
}

export function requestIdFrom(request: Request) {
  const value = request.headers.get(REQUEST_ID_HEADER);
  return isRequestId(value) ? value : createRequestId();
}

export function errorCodeFrom(error: unknown) {
  if (!error || typeof error !== "object") return "unknown_error";
  if ("code" in error && typeof error.code === "string") return safeToken(error.code) ?? "unsafe_error_code";
  if (error instanceof Error) return safeToken(error.name) ?? "error";
  return "unknown_error";
}

export function structuredLog(level: LogLevel, event: string, context: LogContext = {}) {
  const payload = {
    timestamp: new Date().toISOString(),
    level,
    event: safeToken(event) ?? "invalid_event",
    request_id: isRequestId(context.requestId) ? context.requestId : undefined,
    route: safeToken(context.route),
    method: safeToken(context.method?.toUpperCase()),
    status: Number.isInteger(context.status) ? context.status : undefined,
    duration_ms: Number.isFinite(context.durationMs) ? Math.max(0, Math.round(context.durationMs ?? 0)) : undefined,
    operation: safeToken(context.operation),
    actor_staff_id: safeToken(context.actorStaffId),
    resource_type: safeToken(context.resourceType),
    resource_id: safeToken(context.resourceId),
    error_code: safeToken(context.errorCode),
  };
  const serialized = JSON.stringify(payload);

  if (level === "error") {
    console.error(serialized);
  } else if (level === "warn") {
    console.warn(serialized);
  } else {
    console.info(serialized);
  }
}

export function observedRoute<Context = unknown>(
  operation: string,
  handler: ObservedRouteHandler<Context>,
) {
  return async (request: Request, context: Context) => {
    const requestId = requestIdFrom(request);
    const route = new URL(request.url).pathname;
    const startedAt = Date.now();

    try {
      const response = await handler(request, context);
      response.headers.set(REQUEST_ID_HEADER, requestId);
      structuredLog(
        response.status >= 500 ? "error" : response.status >= 400 ? "warn" : "info",
        "http.request.completed",
        {
          requestId,
          route,
          method: request.method,
          status: response.status,
          durationMs: Date.now() - startedAt,
          operation,
        },
      );
      return response;
    } catch (error) {
      structuredLog("error", "http.request.failed", {
        requestId,
        route,
        method: request.method,
        status: 500,
        durationMs: Date.now() - startedAt,
        operation,
        errorCode: errorCodeFrom(error),
      });
      return Response.json(
        { error: "Beklenmeyen sunucu hatası.", request_id: requestId },
        {
          status: 500,
          headers: {
            [REQUEST_ID_HEADER]: requestId,
            "Cache-Control": "no-store",
          },
        },
      );
    }
  };
}
