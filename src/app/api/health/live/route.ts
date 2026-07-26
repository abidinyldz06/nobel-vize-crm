import { NextResponse } from "next/server";
import { observedRoute } from "@/lib/observability";

export const dynamic = "force-dynamic";

async function liveness() {
  return NextResponse.json(
    {
      status: "ok",
      service: "nobel-vize-crm",
      checked_at: new Date().toISOString(),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

export const GET = observedRoute("health.live", liveness);
