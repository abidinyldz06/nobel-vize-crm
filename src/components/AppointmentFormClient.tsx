"use client"
import { useState, useEffect } from "react";
import { Save, AlertTriangle, Info, MapPin, Calendar, Clock } from "lucide-react";
import { checkAppointmentDensity } from "@/app/actions/update-customer";
import { addAppointment } from "@/app/actions/update-customer";

interface DensityApp {
  id: string;
  time: string;
  customerName: string;
}

export default function AppointmentFormClient({
  customerId,
  applicationId,
}: {
  customerId: string;
  applicationId: string;
}) {
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [existingApps, setExistingApps] = useState<DensityApp[]>([]);
  const [isChecking, setIsChecking] = useState(false);
  const canCheckDensity = Boolean(date && location.length > 2);

  useEffect(() => {
    if (canCheckDensity) {
      const timer = setTimeout(async () => {
        setIsChecking(true);
        try {
          const apps = await checkAppointmentDensity(date, location);
          setExistingApps(apps);
        } catch (error) {
          console.error("Density check error", error);
        } finally {
          setIsChecking(false);
        }
      }, 500); // debounce

      return () => clearTimeout(timer);
    }
  }, [date, location, canCheckDensity]);

  const visibleExistingApps = canCheckDensity ? existingApps : [];
  const densityCount = visibleExistingApps.length;
  const isBusy = densityCount >= 3 && densityCount < 5;
  const isVeryBusy = densityCount >= 5;

  return (
    <form action={addAppointment} className="space-y-5">
      <input type="hidden" name="customerId" value={customerId} />
      <input type="hidden" name="applicationId" value={applicationId} />

      {/* Density Warning Banner */}
      {densityCount >= 3 && (
        <div className={`p-4 rounded-xl border flex gap-3 animate-in fade-in slide-in-from-top-4 duration-300 ${
          isVeryBusy 
            ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/30 text-red-800 dark:text-red-300' 
            : 'bg-orange-50 dark:bg-orange-500/10 border-orange-200 dark:border-orange-500/30 text-orange-800 dark:text-orange-300'
        }`}>
          <AlertTriangle className={`w-5 h-5 shrink-0 ${isVeryBusy ? 'text-red-500' : 'text-orange-500'}`} />
          <div className="flex-1">
            <h4 className="font-bold text-sm mb-1">
              Dikkat! Bu tarih ve lokasyon {isVeryBusy ? 'çok yoğun' : 'yoğun'}.
            </h4>
            <p className="text-xs opacity-90 mb-2">
              Seçtiğiniz lokasyonda ({location}) aynı gün için <strong>{densityCount} adet</strong> kayıtlı randevunuz bulunmaktadır.
            </p>
            <div className={`text-xs rounded-lg p-2.5 space-y-1.5 ${isVeryBusy ? 'bg-red-100/50 dark:bg-red-900/20' : 'bg-orange-100/50 dark:bg-orange-900/20'}`}>
              <div className="font-semibold opacity-70 mb-1 flex items-center gap-1.5"><Clock className="w-3 h-3"/> Mevcut Randevular:</div>
              {visibleExistingApps.map(app => (
                <div key={app.id} className="flex items-center gap-2">
                  <span className="font-mono bg-white/50 dark:bg-black/20 px-1 rounded">{app.time}</span>
                  <span className="truncate">{app.customerName}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {densityCount > 0 && densityCount < 3 && (
        <div className="p-3 rounded-xl border bg-blue-50 dark:bg-blue-500/5 border-blue-200 dark:border-blue-500/20 text-blue-800 dark:text-blue-300 flex items-start gap-2 text-xs">
          <Info className="w-4 h-4 shrink-0 mt-0.5 text-blue-500" />
          <p>
            Seçtiğiniz konumda bu tarihte <strong>{densityCount} adet</strong> randevu bulunmaktadır. Müsaitlik var.
          </p>
        </div>
      )}

      <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Randevu Detayları</h2>
          <p className="text-xs text-slate-500 mt-0.5">Başvuru sistemi, tarih ve konum bilgilerini girin.</p>
        </div>
        <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">

          {/* System Selection */}
          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Başvuru Sistemi *</label>
            <div className="grid grid-cols-3 gap-3">
              {[
                { value: "VFS", label: "VFS Global", desc: "Schengen, UK, ABD" },
                { value: "iDATA", label: "iDATA", desc: "Almanya, Fransa vb." },
                { value: "Konsolosluk", label: "Konsolosluk", desc: "Diğer ülkeler" },
              ].map(sys => (
                <label key={sys.value} className="flex flex-col items-center p-3 rounded-xl border border-slate-200 dark:border-[#1f2937] cursor-pointer hover:border-blue-500/40 has-[:checked]:border-blue-500 has-[:checked]:bg-blue-500/10 transition-all">
                  <input type="radio" name="appointmentSystem" value={sys.value} defaultChecked={sys.value === "VFS"} className="sr-only" />
                  <span className="text-sm font-semibold text-slate-900 dark:text-slate-200">{sys.label}</span>
                  <span className="text-[10px] text-slate-500 mt-0.5">{sys.desc}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"><Calendar className="w-3.5 h-3.5"/> Tarih *</label>
            <input
              required name="date" type="date"
              value={date} onChange={(e) => setDate(e.target.value)}
              className={`w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:ring-2 transition-all [color-scheme:dark] ${
                isVeryBusy ? 'border-red-300 dark:border-red-800 focus:border-red-500 focus:ring-red-500/20' : 
                isBusy ? 'border-orange-300 dark:border-orange-800 focus:border-orange-500 focus:ring-orange-500/20' : 
                'border-slate-200 dark:border-[#1f2937] focus:border-blue-500 focus:ring-blue-500/20'
              }`}
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"><Clock className="w-3.5 h-3.5"/> Saat *</label>
            <input
              required name="time" type="time"
              className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all [color-scheme:dark]"
            />
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1"><MapPin className="w-3.5 h-3.5"/> Merkez / Konum *</label>
            <div className="relative">
              <input
                required name="location" type="text"
                value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="Örn: VFS Global Altunizade, iDATA Harbiye, Fransız Konsolosluğu"
                className={`w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:ring-2 transition-all ${
                  isVeryBusy ? 'border-red-300 dark:border-red-800 focus:border-red-500 focus:ring-red-500/20' : 
                  isBusy ? 'border-orange-300 dark:border-orange-800 focus:border-orange-500 focus:ring-orange-500/20' : 
                  'border-slate-200 dark:border-[#1f2937] focus:border-blue-500 focus:ring-blue-500/20'
                }`}
              />
              {isChecking && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <div className="w-4 h-4 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin"></div>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-1.5 md:col-span-2">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Not (isteğe bağlı)</label>
            <textarea
              name="appointmentNote" rows={2}
              placeholder="Randevu ile ilgili eklemek istediğiniz bilgiler..."
              className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all resize-none"
            />
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-[#1f2937]">
        <button type="submit" className={`flex items-center gap-2 px-6 py-2.5 font-semibold rounded-xl transition-all shadow-lg text-sm text-white ${
          isVeryBusy ? 'bg-red-600 hover:bg-red-700 shadow-red-900/30' : 
          isBusy ? 'bg-orange-600 hover:bg-orange-700 shadow-orange-900/30' : 
          'bg-blue-600 hover:bg-blue-700 shadow-blue-900/30'
        }`}>
          <Save className="w-4 h-4" /> Yine de Kaydet
        </button>
      </div>
    </form>
  );
}
