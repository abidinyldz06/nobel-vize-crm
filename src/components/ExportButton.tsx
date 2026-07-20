"use client"
import { Download } from "lucide-react";

type ExportCustomer = {
  id: string;
  first_name: string;
  last_name: string;
  phone: string | null;
  email: string | null;
  created_at: string;
  country?: string | null;
  status?: string | null;
  profile_score: number | null;
};

export default function ExportButton({ data }: { data: ExportCustomer[] }) {
  const handleExport = () => {
    // CSV Header
    const headers = ["ID", "Ad", "Soyad", "Telefon", "E-posta", "Kayıt Tarihi", "Ülke", "Durum", "Profil Skoru"];
    
    // Map data
    const rows = data.map(c => [
      c.id,
      c.first_name || '',
      c.last_name || '',
      c.phone || '',
      c.email || '',
      new Date(c.created_at).toLocaleDateString('tr-TR'),
      c.country || '',
      c.status || '',
      c.profile_score || ''
    ]);

    // Construct CSV String
    let csvContent = "\uFEFF"; // BOM for UTF-8
    csvContent += headers.join(";") + "\n";
    rows.forEach(row => {
      // Escape strings containing semicolons or quotes
      const escapedRow = row.map(val => {
        const strVal = String(val);
        if (strVal.includes(";") || strVal.includes("\"") || strVal.includes("\n")) {
          return `"${strVal.replace(/"/g, '""')}"`;
        }
        return strVal;
      });
      csvContent += escapedRow.join(";") + "\n";
    });

    // Create Blob and trigger download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `musteriler_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <button
      onClick={handleExport}
      className="flex items-center gap-2 px-4 py-2.5 bg-slate-200 dark:bg-[#1f2937] hover:bg-slate-300 dark:hover:bg-[#2d3f55] text-slate-700 dark:text-slate-300 text-sm font-semibold rounded-xl transition-all"
    >
      <Download className="w-4 h-4" />
      Dışa Aktar (CSV)
    </button>
  );
}
