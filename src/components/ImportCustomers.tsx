"use client";

import { useState, useRef } from "react";
import { UploadCloud, CheckCircle2, AlertCircle, RefreshCw, Download } from "lucide-react";
import Papa from "papaparse";
import { readSheet } from "read-excel-file/browser";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface ParsedRow {
  first_name: string;
  last_name: string;
  phone: string;
  email: string;
  country: string;
  passport_no: string;
  _original?: RawRow;
}

type RawRow = Record<string, unknown>;

export default function ImportCustomers() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [parsedData, setParsedData] = useState<ParsedRow[]>([]);
  const [resolutionMode, setResolutionMode] = useState<'skip' | 'update'>('update');
  
  const [isImporting, setIsImporting] = useState(false);
  const [results, setResults] = useState<{ success: number; skipped: number; updated: number; failed: number; errors: string[] } | null>(null);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;
    void parseFile(selectedFile);
  };

  const parseFile = async (file: File) => {
    const extension = file.name.toLowerCase();
    const isCSV = extension.endsWith('.csv');
    const isExcel = extension.endsWith('.xlsx');

    if (isCSV) {
      Papa.parse<RawRow>(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          mapData(results.data);
        },
        error: (err) => toast.error(`CSV Okuma Hatası: ${err.message}`)
      });
      return;
    }

    if (isExcel) {
      try {
        const [headerRow = [], ...dataRows] = await readSheet(file);
        const headers = headerRow.map((cell) => String(cell ?? "").trim());
        const rows = dataRows.map((row) => Object.fromEntries(
          headers.map((header, index) => [header, row[index] ?? ""]),
        ));
        mapData(rows);
      } catch (error) {
        toast.error(`Excel Okuma Hatası: ${error instanceof Error ? error.message : "Dosya okunamadı."}`);
      }
      return;
    }

    toast.error("Lütfen .csv veya .xlsx formatında bir dosya yükleyin.");
  };

  const mapData = (rawRows: RawRow[]) => {
    const mapped: ParsedRow[] = rawRows.map((row) => {
      // Çok temel bir otomatik eşleştirme (Kolon adlarını tahmin etme)
      const getVal = (keys: string[]) => {
        const key = Object.keys(row).find(k => keys.some(searchKey => k.toLowerCase().includes(searchKey.toLowerCase())));
        return key ? String(row[key] ?? "").trim() : "";
      };

      return {
        first_name: getVal(['ad', 'isim', 'first', 'name']),
        last_name: getVal(['soyad', 'last', 'surname']),
        phone: getVal(['tel', 'phone', 'cep']),
        email: getVal(['mail', 'e-posta', 'eposta']),
        country: getVal(['ülke', 'ulke', 'country', 'hedef']),
        passport_no: getVal(['pasaport', 'passport']),
        _original: row
      };
    }).filter(r => r.first_name || r.last_name || r.phone); // Tamamen boş satırları atla

    if (mapped.length === 0) {
      toast.error("Dosyadan veri okunamadı veya kolon adları anlaşılamadı. Lütfen şablona uygun yükleyin.");
      return;
    }

    setParsedData(mapped);
    setStep(2);
  };

  const handleImport = async () => {
    setIsImporting(true);
    try {
      const res = await fetch('/api/customers/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedData, resolutionMode })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "İçe aktarma başarısız oldu.");

      setResults(data);
      setStep(3);
      toast.success("İçe aktarma işlemi tamamlandı!");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "İçe aktarma başarısız oldu.");
    } finally {
      setIsImporting(false);
    }
  };

  const handleDownloadTemplate = () => {
    const csvContent = "Ad,Soyad,Telefon,E-posta,Ülke,PasaportNo\nAhmet,Yılmaz,05551234567,ahmet@email.com,Fransa,U12345678\nAyşe,Demir,05337654321,ayse@email.com,Almanya,U87654321";
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "musteri_sablonu.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="max-w-4xl mx-auto">
      {/* STEPS HEADER */}
      <div className="flex items-center justify-between mb-8">
        {[
          { num: 1, title: "Dosya Yükle" },
          { num: 2, title: "Önizleme & Ayarlar" },
          { num: 3, title: "Sonuç" }
        ].map((s, i) => (
          <div key={i} className={`flex items-center gap-3 ${step >= s.num ? 'opacity-100' : 'opacity-40'}`}>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm border-2 ${
              step >= s.num 
                ? 'bg-blue-600 border-blue-600 text-white' 
                : 'border-slate-300 dark:border-slate-700 text-slate-400'
            }`}>
              {step > s.num ? <CheckCircle2 className="w-4 h-4" /> : s.num}
            </div>
            <span className={`font-semibold ${step >= s.num ? 'text-slate-900 dark:text-white' : 'text-slate-500'}`}>
              {s.title}
            </span>
            {i < 2 && <div className="hidden sm:block w-16 md:w-32 h-px bg-slate-200 dark:bg-slate-700 mx-4" />}
          </div>
        ))}
      </div>

      {/* STEP 1: UPLOAD */}
      {step === 1 && (
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-3xl p-8 sm:p-12 text-center shadow-lg shadow-black/5 animate-in fade-in duration-300">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <UploadCloud className="w-10 h-10 text-blue-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-3">Excel veya CSV Yükleyin</h2>
          <p className="text-slate-500 dark:text-slate-400 max-w-md mx-auto mb-8">
            Müşteri listenizi sisteme saniyeler içinde aktarın. Şablona uygun doldurulmuş dosyaları doğrudan yükleyebilirsiniz.
          </p>

          <input
            type="file"
            accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="hidden"
            ref={fileInputRef}
            onChange={handleFileUpload}
          />
          
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all w-full sm:w-auto"
            >
              Dosya Seç (.csv, .xlsx)
            </button>
            <button
              onClick={handleDownloadTemplate}
              className="px-8 py-3.5 bg-white dark:bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700 font-semibold rounded-xl transition-all w-full sm:w-auto flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4" /> Örnek Şablon İndir
            </button>
          </div>
        </div>
      )}

      {/* STEP 2: PREVIEW */}
      {step === 2 && (
        <div className="space-y-6 animate-in slide-in-from-right-8 fade-in duration-300">
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-3xl p-6 shadow-lg shadow-black/5">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold text-slate-900 dark:text-white">Veri Önizleme</h2>
                <p className="text-sm text-slate-500">Toplam {parsedData.length} satır algılandı. İlk 5 satır gösteriliyor.</p>
              </div>
              <button onClick={() => setStep(1)} className="text-sm font-semibold text-blue-500 hover:text-blue-600 transition-colors">
                Geri Dön / Başka Dosya Seç
              </button>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800 mb-6">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
                  <tr>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Ad</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Soyad</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Telefon</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Ülke</th>
                    <th className="px-4 py-3 font-semibold text-slate-600 dark:text-slate-300">Pasaport No</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {parsedData.slice(0, 5).map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className={`px-4 py-3 ${!row.first_name ? 'text-red-500 italic' : 'text-slate-700 dark:text-slate-300'}`}>{row.first_name || 'Eksik'}</td>
                      <td className={`px-4 py-3 ${!row.last_name ? 'text-red-500 italic' : 'text-slate-700 dark:text-slate-300'}`}>{row.last_name || 'Eksik'}</td>
                      <td className={`px-4 py-3 ${!row.phone ? 'text-red-500 italic' : 'text-slate-700 dark:text-slate-300'}`}>{row.phone || 'Eksik'}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.country || '-'}</td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300">{row.passport_no || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="bg-blue-50 dark:bg-blue-500/10 border border-blue-100 dark:border-blue-500/20 rounded-xl p-5">
              <h3 className="font-bold text-blue-800 dark:text-blue-400 mb-3 flex items-center gap-2">
                <AlertCircle className="w-5 h-5" /> Çakışma Kontrolü (Aynı Telefon/E-posta)
              </h3>
              <p className="text-sm text-blue-600 dark:text-blue-300 mb-4">
                Sistemde önceden kayıtlı müşteriler dosyada tekrar tespit edilirse nasıl bir aksiyon alınsın?
              </p>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <label className={`flex-1 flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${resolutionMode === 'update' ? 'border-blue-500 bg-white dark:bg-slate-800' : 'border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800'}`}>
                  <input type="radio" name="resMode" className="mt-1 w-4 h-4 text-blue-600" checked={resolutionMode === 'update'} onChange={() => setResolutionMode('update')} />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Bilgilerini Güncelle (Önerilen)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Eski müşterinin adı, soyadı ve pasaportu bu dosyadakilerle değişir. Yeni bir vize başvurusu açılmaz.</p>
                  </div>
                </label>
                
                <label className={`flex-1 flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${resolutionMode === 'skip' ? 'border-blue-500 bg-white dark:bg-slate-800' : 'border-transparent bg-white/50 dark:bg-slate-800/50 hover:bg-white dark:hover:bg-slate-800'}`}>
                  <input type="radio" name="resMode" className="mt-1 w-4 h-4 text-blue-600" checked={resolutionMode === 'skip'} onChange={() => setResolutionMode('skip')} />
                  <div>
                    <p className="font-bold text-slate-900 dark:text-white">Atla (Değiştirme)</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Eski müşteriler tamamen atlanır. Sadece veritabanında hiç olmayan yeni numaralar kaydedilir.</p>
                  </div>
                </label>
              </div>
            </div>

            <div className="mt-8 flex justify-end">
              <button
                onClick={handleImport}
                disabled={isImporting}
                className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed text-white font-semibold rounded-xl shadow-lg shadow-blue-500/30 transition-all flex items-center gap-2"
              >
                {isImporting ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                {isImporting ? "İçe Aktarılıyor..." : `${parsedData.length} Kaydı İçe Aktar`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 3: RESULTS */}
      {step === 3 && results && (
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-3xl p-8 shadow-lg shadow-black/5 text-center animate-in zoom-in-95 fade-in duration-300">
          <div className="w-24 h-24 bg-emerald-100 dark:bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle2 className="w-12 h-12 text-emerald-500" />
          </div>
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">İçe Aktarma Tamamlandı!</h2>
          <p className="text-slate-500 dark:text-slate-400 mb-8">İşlem sonuçlarınız aşağıda özetlenmiştir.</p>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
            <div className="bg-emerald-50 dark:bg-emerald-500/5 p-4 rounded-2xl border border-emerald-100 dark:border-emerald-500/10">
              <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400 mb-1">{results.success}</p>
              <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-500 uppercase tracking-wider">Yeni Kayıt</p>
            </div>
            <div className="bg-blue-50 dark:bg-blue-500/5 p-4 rounded-2xl border border-blue-100 dark:border-blue-500/10">
              <p className="text-3xl font-bold text-blue-600 dark:text-blue-400 mb-1">{results.updated}</p>
              <p className="text-xs font-semibold text-blue-800 dark:text-blue-500 uppercase tracking-wider">Güncellendi</p>
            </div>
            <div className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-2xl border border-slate-200 dark:border-slate-700">
              <p className="text-3xl font-bold text-slate-600 dark:text-slate-400 mb-1">{results.skipped}</p>
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-500 uppercase tracking-wider">Atlandı</p>
            </div>
            <div className="bg-red-50 dark:bg-red-500/5 p-4 rounded-2xl border border-red-100 dark:border-red-500/10">
              <p className="text-3xl font-bold text-red-600 dark:text-red-400 mb-1">{results.failed}</p>
              <p className="text-xs font-semibold text-red-800 dark:text-red-500 uppercase tracking-wider">Hata</p>
            </div>
          </div>

          {results.errors && results.errors.length > 0 && (
            <div className="text-left bg-red-50 dark:bg-red-500/10 p-5 rounded-2xl border border-red-200 dark:border-red-500/20 mb-8 max-h-48 overflow-y-auto">
              <h4 className="font-bold text-red-700 dark:text-red-400 mb-2">Hata Detayları:</h4>
              <ul className="list-disc list-inside text-sm text-red-600 dark:text-red-300 space-y-1">
                {results.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <Link
            href="/customers"
            className="inline-flex px-8 py-3.5 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:hover:bg-slate-200 text-white dark:text-slate-900 font-bold rounded-xl transition-all"
          >
            Müşteri Listesine Dön
          </Link>
        </div>
      )}
    </div>
  );
}
