"use client"
import { Printer } from "lucide-react";

export default function PdfExportButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-lg transition-all print:hidden"
      title="Sayfayı Yazdır / PDF İndir"
    >
      <Printer className="w-3.5 h-3.5" /> PDF / Yazdır
    </button>
  );
}
