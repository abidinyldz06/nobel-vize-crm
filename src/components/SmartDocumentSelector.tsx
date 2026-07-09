"use client"
import { useState, useEffect, useMemo } from "react";
import { VISA_TYPE_LABELS, DOCUMENT_CATEGORIES } from "@/lib/visa-types";
import { AlertCircle, FileText, CheckCircle2 } from "lucide-react";

const TRAVEL_METHODS = { ucak: "Uçak", tur_paketi: "Tur Paketi", gemi: "Gemi", kendi_araci: "Kendi Aracı" };
const ACCOMMODATIONS = { otel: "Otel", aile_arkadas: "Aile/Arkadaş Yanı", diger: "Diğer" };
const OCCUPATIONS = { calisan: "Çalışan", memur: "Memur", emekli: "Emekli", ogrenci: "Öğrenci", issiz: "İşsiz", sirket_sahibi: "Şirket Sahibi" };
const WITH_CHILDREN = { "true": "Evet", "false": "Hayır" };
const NATIONALITIES = { tc: "TC Vatandaşı", diger: "Diğer" };

export default function SmartDocumentSelector({ 
  dbCountries, 
  allRules 
}: { 
  dbCountries: any[], 
  allRules: any[] 
}) {
  const [selectedCountry, setSelectedCountry] = useState<string>("");
  const [selectedVisaType, setSelectedVisaType] = useState<string>("turistik");
  const [travelMethod, setTravelMethod] = useState<string>("");
  const [accommodation, setAccommodation] = useState<string>("");
  const [occupation, setOccupation] = useState<string>("");
  const [withChildren, setWithChildren] = useState<string>("");
  const [nationality, setNationality] = useState<string>("");

  // Compute matching rule
  const matchingRule = useMemo(() => {
    if (!selectedCountry || !selectedVisaType) return null;

    const countryRules = allRules.filter(r => r.country_id === selectedCountry && r.visa_category === selectedVisaType);
    if (countryRules.length === 0) return null;

    // Scoring system to find the most specific rule
    // Exact match = 10 points
    // Null match = 1 point
    // Mismatch = -100 points
    let bestRule = null;
    let maxScore = -1;

    for (const rule of countryRules) {
      let score = 0;
      let isMatch = true;

      const checkField = (ruleVal: any, stateVal: string) => {
        if (ruleVal === null) return 1; // Generic matches anything, low points
        if (stateVal && ruleVal.toString() === stateVal) return 10; // Exact match, high points
        return -100; // Mismatch
      };

      score += checkField(rule.travel_method, travelMethod);
      score += checkField(rule.accommodation, accommodation);
      score += checkField(rule.occupation, occupation);
      score += checkField(rule.with_children, withChildren);
      score += checkField(rule.nationality, nationality);

      if (score >= 0 && score > maxScore) {
        maxScore = score;
        bestRule = rule;
      }
    }

    return bestRule;
  }, [selectedCountry, selectedVisaType, travelMethod, accommodation, occupation, withChildren, nationality, allRules]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 bg-slate-50 dark:bg-[#0a101a] p-4 rounded-xl border border-slate-200 dark:border-[#1f2937]">
        {matchingRule && <input type="hidden" name="matchedRuleId" value={matchingRule.id} />}
        <div className="space-y-1.5 md:col-span-2 lg:col-span-1">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Hedef Ülke *</label>
          <select name="countryId" required value={selectedCountry} onChange={e => setSelectedCountry(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
            <option value="">— Seçin —</option>
            {dbCountries.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Vize Türü</label>
          <select name="visaType" value={selectedVisaType} onChange={e => setSelectedVisaType(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
            {Object.keys(VISA_TYPE_LABELS).map(k => <option key={k} value={k}>{VISA_TYPE_LABELS[k as keyof typeof VISA_TYPE_LABELS]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Seyahat Aracı</label>
          <select name="travelMethod" value={travelMethod} onChange={e => setTravelMethod(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
            <option value="">— Seçin —</option>
            {Object.entries(TRAVEL_METHODS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Konaklama Tipi</label>
          <select name="accommodation" value={accommodation} onChange={e => setAccommodation(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
            <option value="">— Seçin —</option>
            {Object.entries(ACCOMMODATIONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Meslek</label>
          <select name="occupation" value={occupation} onChange={e => setOccupation(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
            <option value="">— Seçin —</option>
            {Object.entries(OCCUPATIONS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Çocuklu Mu?</label>
          <select name="withChildren" value={withChildren} onChange={e => setWithChildren(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
            <option value="">— Seçin —</option>
            {Object.entries(WITH_CHILDREN).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold text-slate-500 uppercase">Uyruk</label>
          <select name="nationality" value={nationality} onChange={e => setNationality(e.target.value)}
            className="w-full px-3 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-lg text-xs outline-none focus:border-blue-500">
            <option value="">— Seçin —</option>
            {Object.entries(NATIONALITIES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {/* Ücretlendirme */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Konsolosluk Harcı (₺/€)</label>
          <input name="consulateFee" type="number" min="0" step="50"
            className="w-full px-4 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            placeholder="Örn: 3000" />
        </div>
        <div className="space-y-1.5">
          <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ofis Hizmet Bedeli (₺/€)</label>
          <input name="serviceFee" type="number" min="0" step="50"
            className="w-full px-4 py-2 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500"
            placeholder="Örn: 2500" />
          <p className="text-[10px] text-slate-600">Boş bırakılırsa ülke baz ücretinden alır.</p>
        </div>
      </div>

      {/* Evrak Listesi Önizleme */}
      {selectedCountry && (
        <div className="bg-slate-50 dark:bg-[#0a101a] border border-slate-200 dark:border-[#1f2937] rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 dark:border-[#1f2937] flex items-center gap-2">
            <FileText className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Bu Seçimlere Göre Gerekli Evraklar</h3>
          </div>
          
          {!matchingRule ? (
            <div className="p-4 flex items-start gap-2 bg-amber-500/10 text-amber-600 dark:text-amber-400 text-xs">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <p>
                <strong>Uyarı:</strong> Seçtiğiniz kriterlere uygun veya genel (fallback) bir evrak listesi bulunamadı. Müşteri kaydedilebilir ancak evrak listesi boş olacaktır. Lütfen Admin panelinden kural ekleyin.
              </p>
            </div>
          ) : (
            <div className="p-4">
              <div className="mb-4 text-[10px] flex gap-2 flex-wrap text-slate-500">
                <span className="bg-slate-200 dark:bg-[#1f2937] px-2 py-0.5 rounded">Eşleşen Kural ID: {matchingRule.id?.split('-')[0]}</span>
                <span className="bg-slate-200 dark:bg-[#1f2937] px-2 py-0.5 rounded">{matchingRule.documents?.length || 0} Evrak Bulundu</span>
              </div>
              {(!matchingRule.documents || matchingRule.documents.length === 0) ? (
                <p className="text-xs text-slate-500">Bu kurala henüz evrak eklenmemiş.</p>
              ) : (
                <ul className="space-y-2">
                  {matchingRule.documents.map((doc: any, i: number) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      <CheckCircle2 className={`w-4 h-4 shrink-0 ${doc.required ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <div>
                        <span className={`font-semibold ${doc.required ? 'text-slate-700 dark:text-slate-200' : 'text-slate-500'}`}>{doc.name}</span>
                        {doc.description && <span className="text-slate-500 ml-1">- {doc.description}</span>}
                        {!doc.required && <span className="ml-1 text-[9px] bg-slate-200 dark:bg-[#1f2937] px-1.5 py-0.5 rounded text-slate-500">Opsiyonel</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
