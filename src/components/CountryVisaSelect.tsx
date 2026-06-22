"use client"
import { useState, useEffect } from "react";
import { VISA_TYPE_LABELS } from "@/lib/visa-types";
import { AlertCircle } from "lucide-react";

export default function CountryVisaSelect({ 
  dbCountries, 
  allRequirements 
}: { 
  dbCountries: any[], 
  allRequirements: any[] 
}) {
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedVisaType, setSelectedVisaType] = useState<string>("turistik");
  const [hasRequirements, setHasRequirements] = useState<boolean>(true);

  useEffect(() => {
    if (selectedCountry && selectedVisaType) {
      const found = allRequirements.some(
        r => r.country_id === selectedCountry && r.visa_type === selectedVisaType
      );
      setHasRequirements(found);
    } else {
      setHasRequirements(true); // Don't show warning if nothing is selected yet
    }
  }, [selectedCountry, selectedVisaType, allRequirements]);

  return (
    <>
      <div className="space-y-1.5">
        <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Hedef Ülke <span className="text-red-400">*</span></label>
        <select 
          name="countryId" 
          required
          value={selectedCountry}
          onChange={(e) => setSelectedCountry(e.target.value)}
          className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all appearance-none cursor-pointer"
        >
          <option value="">— Ülke Seçin —</option>
          {dbCountries.map(c => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vize Türü</label>
          <select 
            name="visaType"
            value={selectedVisaType}
            onChange={(e) => setSelectedVisaType(e.target.value)}
            className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
          >
            {Object.keys(VISA_TYPE_LABELS).map(key => (
              <option key={key} value={key}>{VISA_TYPE_LABELS[key]}</option>
            ))}
          </select>
        </div>

        {/* Ücretlendirme */}
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Konsolosluk Harcı (₺/€)</label>
          <input name="consulateFee" type="number" min="0" step="50"
            className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            placeholder="Örn: 3000" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ofis Hizmet Bedeli (₺/€)</label>
          <input name="serviceFee" type="number" min="0" step="50"
            className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
            placeholder="Örn: 2500" />
          <p className="text-[10px] text-slate-600">Boş bırakılırsa ülke baz ücretinden alır.</p>
        </div>
      </div>

      {!hasRequirements && selectedCountry && (
        <div className="flex items-start gap-2 p-3 bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 rounded-lg text-xs mt-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <p>
            <strong>Uyarı:</strong> Seçtiğiniz Ülke + Vize Türü kombinasyonu için sistemde tanımlı bir evrak listesi bulunamadı. 
            Müşteri oluşturulur ancak evrak listesi boş olur. Lütfen <strong>Ülke & Evraklar</strong> sayfasından bu kombinasyonu tanımlayın.
          </p>
        </div>
      )}
    </>
  );
}
