import "server-only";

import { NextResponse } from "next/server";
import { flattenError, type ZodType } from "zod";

export function invalidRequest(details: unknown) {
  return NextResponse.json(
    { error: "Geçersiz istek verisi", details },
    { status: 400 },
  );
}

export async function readValidJson<T extends ZodType>(request: Request, schema: T) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return {
      ok: false as const,
      response: invalidRequest({ formErrors: ["JSON ayrıştırılamadı"], fieldErrors: {} }),
    };
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return { ok: false as const, response: invalidRequest(flattenError(parsed.error)) };
  }
  return { ok: true as const, data: parsed.data };
}
