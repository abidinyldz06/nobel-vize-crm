"use client";

import { useState } from "react";
import { Download, UploadCloud, AlertTriangle, Loader2, Database, FileJson, FileSpreadsheet, Check } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

export default function BackupPanel() {
  const [restoring, setRestoring] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const router = useRouter();

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!confirm("DİKKAT: Bu işlem mevcut tüm verileri SİLER ve yüklediğiniz dosyadaki verilerle değiştirir. Bu işlem GERİ ALINAMAZ. Onaylıyor musunuz?")) {
      e.target.value = '';
      return;
    }

    if (!confirm("Emin misiniz? Geri yükleme işlemi başlıyor...")) {
      e.target.value = '';
      return;
    }

    setRestoring(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const text = await file.text();
      const backupData = JSON.parse(text);

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(backupData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Geri yükleme başarısız oldu.");
      }

      setSuccessMsg("Veritabanı başarıyla geri yüklendi!");
      setTimeout(() => {
        router.refresh();
      }, 2000);
      
    } catch (err: any) {
      setErrorMsg(err.message || "Dosya işlenirken bir hata oluştu.");
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const handleExportCSV = async () => {
    setExportingCsv(true);
    setErrorMsg("");
    try {
      // JSON olarak tüm veriyi çek
      const response = await fetch('/api/backup');
      if (!response.ok) {
        throw new Error("Veri çekilemedi.");
      }
      const data = await response.json();
      
      if (!data.tables) throw new Error("Geçersiz veri formatı.");

      // Her tablo için CSV oluştur ve indir
      for (const [tableName, records] of Object.entries(data.tables)) {
        if (!Array.isArray(records) || records.length === 0) continue;

        const headers = Object.keys(records[0]);
        const csvRows = [
          headers.join(","),
          ...records.map(row => 
            headers.map(header => {
              let cell = row[header] === null ? '' : String(row[header]);
              cell = cell.replace(/"/g, '""');
              return `"${cell}"`;
            }).join(",")
          )
        ];

        const csvContent = csvRows.join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `nobel_vize_${tableName}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Tarayıcı indirmelerini yormamak için çok kısa bir bekleme
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      setSuccessMsg("Tüm CSV dosyaları indirildi!");
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: any) {
      setErrorMsg(err.message || "CSV dışa aktarılırken hata oluştu.");
    } finally {
      setExportingCsv(false);
    }
  };

  return (
    <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
      <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
          <Database className="w-5 h-5 text-blue-500" /> Veri Yedekleme ve Kurtarma
        </h2>
        <p className="text-xs text-slate-500 mt-1">Sistemdeki tüm kayıtları indirebilir veya daha önce aldığınız bir yedeği geri yükleyebilirsiniz.</p>
      </div>

      <div className="p-6 space-y-6">
        
        {errorMsg && (
          <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-start gap-3 text-red-500">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{errorMsg}</p>
          </div>
        )}
        
        {successMsg && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-start gap-3 text-emerald-500">
            <Check className="w-5 h-5 shrink-0" />
            <p className="text-sm font-medium">{successMsg}</p>
          </div>
        )}

        {/* Dışa Aktar Bölümü */}
        <div>
          <h3 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider mb-4">Dışa Aktar (Export)</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            
            {/* Tam JSON Yedek */}
            <div className="p-5 border border-slate-200 dark:border-[#1f2937] rounded-xl flex flex-col justify-between h-full bg-slate-50/50 dark:bg-[#060d1a]">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileJson className="w-5 h-5 text-blue-500" />
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">Tam Veritabanı Yedeği (JSON)</h4>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Sistemdeki tüm tabloları ve ilişkileri içeren, geri yükleme (restore) işlemi için uygun olan tek bir JSON dosyası indirir.
                </p>
              </div>
              <a 
                href="/api/backup"
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-blue-900/20"
              >
                <Download className="w-4 h-4" /> Yedeği İndir
              </a>
            </div>

            {/* CSV Dışa Aktar */}
            <div className="p-5 border border-slate-200 dark:border-[#1f2937] rounded-xl flex flex-col justify-between h-full bg-slate-50/50 dark:bg-[#060d1a]">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">CSV Formatında Dışa Aktar</h4>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Her bir tabloyu (Müşteriler, Başvurular vb.) ayrı ayrı CSV dosyaları olarak indirir. Excel'de incelemek için idealdir.
                </p>
              </div>
              <button 
                onClick={handleExportCSV}
                disabled={exportingCsv}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-emerald-900/20 disabled:opacity-50"
              >
                {exportingCsv ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} 
                {exportingCsv ? "İndiriliyor..." : "CSV Olarak İndir"}
              </button>
            </div>

          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-[#1f2937] my-6"></div>

        {/* Geri Yükle Bölümü */}
        <div>
          <h3 className="text-xs font-bold text-red-500 uppercase tracking-wider mb-4 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" /> Tehlikeli Bölge: Geri Yükle (Restore)
          </h3>
          <div className="p-6 border border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-500/5 rounded-xl">
            <p className="text-sm font-medium text-slate-900 dark:text-slate-200 mb-2">Yedekten Geri Yükle</p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mb-5 leading-relaxed">
              Daha önce aldığınız <span className="font-mono bg-slate-200 dark:bg-slate-800 px-1 rounded text-red-500">.json</span> uzantılı tam yedek dosyasını yükleyerek sistemi eski haline döndürebilirsiniz. 
              <strong> DİKKAT: Bu işlem mevcut tüm verilerinizi kalıcı olarak SİLER!</strong> Lütfen işlemden önce güncel bir yedek aldığınızdan emin olun.
            </p>
            
            <label className={`flex items-center justify-center gap-2 w-full py-3 border-2 border-dashed rounded-xl cursor-pointer transition-all ${
              restoring 
                ? "border-slate-300 dark:border-slate-700 bg-slate-100 dark:bg-slate-800/50 cursor-not-allowed opacity-70" 
                : "border-red-300 dark:border-red-500/30 hover:border-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400"
            }`}>
              {restoring ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span className="text-sm font-semibold text-slate-600 dark:text-slate-400">Geri Yükleniyor... Lütfen bekleyin...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  <span className="text-sm font-semibold">JSON Yedek Dosyasını Seçin ve Yükleyin</span>
                </>
              )}
              <input 
                type="file" 
                className="hidden" 
                accept=".json,application/json" 
                onChange={handleRestore}
                disabled={restoring}
              />
            </label>
          </div>
        </div>

      </div>
    </div>
  );
}
