"use client";

import { useState } from "react";
import { Download, UploadCloud, AlertTriangle, Loader2, Database, FileJson, FileSpreadsheet, Check, ShieldCheck } from "lucide-react";
import { useRouter } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import type { Tables } from "@/types/database";

type BackupRun = Tables<"backup_runs">;

async function sha256Hex(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

export default function BackupPanel({ initialRuns }: { initialRuns: BackupRun[] }) {
  const supabase = createSupabaseBrowserClient();
  const [restoring, setRestoring] = useState(false);
  const [exportingJson, setExportingJson] = useState(false);
  const [exportingCsv, setExportingCsv] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const router = useRouter();

  const fetchVerifiedBackup = async () => {
    const response = await fetch("/api/backup", { cache: "no-store" });
    if (!response.ok) throw new Error("Yedek verisi alınamadı.");

    const text = await response.text();
    const runId = response.headers.get("x-backup-run-id");
    const expectedChecksum = response.headers.get("x-backup-sha256");
    if (!runId || !expectedChecksum) throw new Error("Yedek bütünlük başlıkları eksik.");

    const actualChecksum = await sha256Hex(text);
    if (actualChecksum !== expectedChecksum) {
      throw new Error("İndirilen yedeğin SHA-256 doğrulaması başarısız oldu.");
    }

    const data = JSON.parse(text) as {
      backup_run_id?: string;
      tables?: Record<string, unknown>;
    };
    if (data.backup_run_id !== runId) throw new Error("Yedek çalışma kimliği eşleşmiyor.");

    const { data: verified, error: verifyError } = await supabase.rpc(
      "verify_backup_run_v1",
      {
        p_run_id: runId,
        p_checksum_sha256: actualChecksum,
      },
    );
    if (verifyError || !verified) throw new Error("Yedek doğrulama kaydı tamamlanamadı.");

    const disposition = response.headers.get("content-disposition") ?? "";
    const fileName = disposition.match(/filename="([^"]+)"/)?.[1]
      ?? `nobel-vize-backup-v2-${new Date().toISOString().slice(0, 10)}.json`;
    return { text, data, fileName };
  };

  const handleExportJSON = async () => {
    setExportingJson(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const { text, fileName } = await fetchVerifiedBackup();
      const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
      const link = document.createElement("a");
      link.href = url;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setSuccessMsg("JSON yedeği indirildi ve SHA-256 bütünlüğü doğrulandı.");
      router.refresh();
    } catch (error) {
      setErrorMsg(error instanceof Error ? error.message : "JSON yedeği oluşturulamadı.");
    } finally {
      setExportingJson(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 25 * 1024 * 1024) {
      setErrorMsg("Yedek dosyası 25 MB sınırını aşıyor.");
      e.target.value = '';
      return;
    }

    if (!confirm("DİKKAT: Bu işlem mevcut verileri v2 yedekteki kayıtlarla atomik olarak değiştirir. Başarısız olursa tüm işlem geri alınır. Devam edilsin mi?")) {
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
      const backupData = JSON.parse(text) as Record<string, unknown>;
      if (backupData.format !== "nobel-vize-crm-backup" || backupData.version !== "2.0") {
        throw new Error("Yalnızca Nobel Vize CRM v2 yedekleri geri yüklenebilir.");
      }

      const response = await fetch('/api/backup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-confirm-restore': 'RESTORE_BACKUP_V2',
        },
        body: text,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Geri yükleme başarısız oldu.");
      }

      setSuccessMsg("Veritabanı başarıyla geri yüklendi!");
      setTimeout(() => {
        router.refresh();
      }, 2000);
      
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Dosya işlenirken bir hata oluştu.");
    } finally {
      setRestoring(false);
      e.target.value = '';
    }
  };

  const handleExportCSV = async () => {
    setExportingCsv(true);
    setErrorMsg("");
    try {
      const { data } = await fetchVerifiedBackup();
      
      if (!data.tables) throw new Error("Geçersiz veri formatı.");

      // Her tablo için CSV oluştur ve indir
      for (const [tableName, records] of Object.entries(data.tables)) {
        if (!Array.isArray(records) || records.length === 0) continue;
        const typedRecords = records.filter(
          (record): record is Record<string, unknown> => Boolean(record) && typeof record === 'object' && !Array.isArray(record),
        );
        if (typedRecords.length === 0) continue;

        const headers = Object.keys(typedRecords[0]);
        const csvRows = [
          headers.join(","),
          ...typedRecords.map(row =>
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
        URL.revokeObjectURL(url);
        
        // Tarayıcı indirmelerini yormamak için çok kısa bir bekleme
        await new Promise(resolve => setTimeout(resolve, 300));
      }
      
      setSuccessMsg("Tüm CSV dosyaları indirildi!");
      router.refresh();
      setTimeout(() => setSuccessMsg(""), 3000);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "CSV dışa aktarılırken hata oluştu.");
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
                  Veritabanı kayıtlarını ve private Storage envanterini içerir. Dosya bütünlüğü SHA-256 ile doğrulanır; Storage binary&apos;leri ayrı arşivlenmelidir.
                </p>
              </div>
              <button
                type="button"
                onClick={handleExportJSON}
                disabled={exportingJson}
                className="flex items-center justify-center gap-2 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-blue-900/20"
              >
                {exportingJson ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {exportingJson ? "Hazırlanıyor..." : "Yedeği İndir ve Doğrula"}
              </button>
            </div>

            {/* CSV Dışa Aktar */}
            <div className="p-5 border border-slate-200 dark:border-[#1f2937] rounded-xl flex flex-col justify-between h-full bg-slate-50/50 dark:bg-[#060d1a]">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <FileSpreadsheet className="w-5 h-5 text-emerald-500" />
                  <h4 className="font-semibold text-slate-900 dark:text-white text-sm">CSV Formatında Dışa Aktar</h4>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  Her bir tabloyu (Müşteriler, Başvurular vb.) ayrı ayrı CSV dosyaları olarak indirir. Excel&apos;de incelemek için idealdir.
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

        <div>
          <h3 className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-slate-900 dark:text-white">
            <ShieldCheck className="h-4 w-4 text-emerald-500" /> Son Yedek Çalışmaları
          </h3>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-[#1f2937]">
            {initialRuns.length === 0 ? (
              <p className="px-5 py-8 text-center text-xs text-slate-500">Henüz takip edilen bir yedek çalışması yok.</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-[#1f2937]">
                {initialRuns.map(run => (
                  <div key={run.id} className="grid gap-2 px-4 py-3 text-xs sm:grid-cols-[1fr_auto]">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{run.artifact_label}</span>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                          run.status === "verified"
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                            : run.status === "failed"
                              ? "bg-red-500/10 text-red-600 dark:text-red-300"
                              : "bg-amber-500/10 text-amber-600 dark:text-amber-300"
                        }`}>
                          {run.status === "verified" ? "Doğrulandı" : run.status === "failed" ? "Başarısız" : run.status === "completed" ? "Doğrulama bekliyor" : "Çalışıyor"}
                        </span>
                      </div>
                      <p className="mt-1 text-slate-500">
                        {run.database_table_count ?? 0} tablo · {run.database_row_count ?? 0} satır · {run.storage_object_count ?? 0} Storage nesnesi · {run.storage_bytes ?? 0} bayt
                      </p>
                      {run.checksum_sha256 && (
                        <p className="mt-1 font-mono text-[10px] text-slate-400">SHA-256: {run.checksum_sha256.slice(0, 16)}…</p>
                      )}
                    </div>
                    <div className="text-slate-500 sm:text-right">
                      <p>{formatDate(run.started_at)}</p>
                      {run.verified_at && <p className="mt-1 text-emerald-600 dark:text-emerald-300">Kontrol: {formatDate(run.verified_at)}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-amber-600 dark:text-amber-300">
            JSON yedeği Storage dosyalarının yol, boyut ve tarih envanterini taşır; belge binary&apos;leri için ayrıca şifreli Storage arşivi alınmalıdır.
          </p>
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
