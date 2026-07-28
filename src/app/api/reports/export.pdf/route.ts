import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { loadAdvancedReport } from "@/lib/advanced-report-data";
import { observedRoute } from "@/lib/observability";

function ascii(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^\x20-\x7E]/g, "?");
}

async function exportPdf(request: Request) {
  const url = new URL(request.url);
  try {
    const report = await loadAdvancedReport(url.searchParams.get("month") ?? undefined, url.searchParams.get("year") ?? undefined);
    const pdf = await PDFDocument.create();
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    let page = pdf.addPage([595, 842]);
    let y = 800;

    const line = (text: string, options: { bold?: boolean; size?: number; color?: ReturnType<typeof rgb> } = {}) => {
      if (y < 55) {
        page = pdf.addPage([595, 842]);
        y = 800;
      }
      page.drawText(ascii(text), {
        x: 45,
        y,
        size: options.size ?? 10,
        font: options.bold ? bold : font,
        color: options.color ?? rgb(0.15, 0.2, 0.3),
        maxWidth: 505,
      });
      y -= (options.size ?? 10) + 7;
    };
    const space = () => { y -= 10; };

    line("Nobel Vize CRM - Gelismis Operasyon Raporu", { bold: true, size: 18, color: rgb(0.1, 0.35, 0.75) });
    line(report.period.label, { size: 11 });
    space();
    line(`Lead SLA: ${report.leadSla.open} acik, ${report.leadSla.overdue} geciken, ${report.leadSla.dueSoon} yaklasan`, { bold: true });
    space();
    line("Ulke / Vize Sonuclari", { bold: true, size: 13 });
    for (const row of report.resultRows) line(`${row.country} / ${row.visaType} | Onay ${row.approved} | Red ${row.rejected} | Bekleyen ${row.pending}`);
    if (report.resultRows.length === 0) line("Secili donemde sonuc verisi yok.");
    space();
    line("Bekleyen Tahsilat Yasi", { bold: true, size: 13 });
    for (const row of report.aging) line(`${row.label} | ${row.count} kayit | ${row.amount.toLocaleString("tr-TR")} TRY`);
    space();
    line("Danisman Is Yuku", { bold: true, size: 13 });
    for (const row of report.workload) line(`${row.staff} | ${row.applications} basvuru | ${row.leads} lead | ${row.tasks} gorev`);

    const bytes = await pdf.save();
    return new Response(Buffer.from(bytes), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="nobel-vize-rapor-${report.period.year}-${String(report.period.month).padStart(2, "0")}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return authorizationErrorResponse(error);
  }
}

export const GET = observedRoute("reports.export_pdf", exportPdf);
