import "server-only";

import { NextResponse } from "next/server";
import { AuthorizationError } from "@/lib/authz";

export function authorizationErrorResponse(error: unknown) {
  if (error instanceof AuthorizationError) {
    return NextResponse.json({ error: error.message }, { status: error.status });
  }

  console.error("Authorization check failed:", error);
  return NextResponse.json({ error: "Yetkilendirme kontrolü tamamlanamadı." }, { status: 500 });
}
