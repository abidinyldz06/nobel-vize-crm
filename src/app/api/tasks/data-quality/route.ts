import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/authz";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { readDataQualitySummary } from "@/lib/data-quality-reader";
import { observedRoute } from "@/lib/observability";

async function getSummary() {
  let context;
  try {
    context = await requireAdmin();
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  try {
    const summary = await readDataQualitySummary(context.supabase);
    return NextResponse.json({ summary }, { headers: { "Cache-Control": "private, no-store" } });
  } catch {
    return NextResponse.json({ error: "Veri kalite özeti tam olarak okunamadı. Yeniden deneyin." }, {
      status: 503, headers: { "Cache-Control": "private, no-store" },
    });
  }
}

export const GET = observedRoute("tasks.data_quality.summary", getSummary);
