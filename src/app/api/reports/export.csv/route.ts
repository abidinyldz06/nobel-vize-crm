import { authorizationErrorResponse } from "@/lib/api-auth";
import { advancedReportCsv, loadAdvancedReport } from "@/lib/advanced-report-data";
import { observedRoute } from "@/lib/observability";

async function exportCsv(request: Request) {
  const url = new URL(request.url);
  try {
    const report = await loadAdvancedReport(url.searchParams.get("month") ?? undefined, url.searchParams.get("year") ?? undefined);
    return new Response(advancedReportCsv(report), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="nobel-vize-rapor-${report.period.year}-${String(report.period.month).padStart(2, "0")}.csv"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export const GET = observedRoute("reports.export_csv", exportCsv);
