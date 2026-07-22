"use client"
import { format, isSameDay } from "date-fns";
import { tr } from "date-fns/locale";
import { X, Clock, MapPin, User, Globe, CalendarPlus, AlertCircle } from "lucide-react";
import Link from "next/link";
import type { CalendarAppointment } from "@/types/calendar";
import { maskPhone } from "@/lib/masking";

export default function DaySidebar({ 
  selectedDate, 
  appointments, 
  onClose 
}: { 
  selectedDate: Date | null, 
  appointments: CalendarAppointment[],
  onClose: () => void 
}) {
  if (!selectedDate) return null;

  const dayApps = appointments.filter(app => isSameDay(new Date(app.appointment_date), selectedDate));
  dayApps.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

  const isPast = selectedDate < new Date(new Date().setHours(0,0,0,0));

  return (
    <>
      {/* Mobile Backdrop */}
      {selectedDate && (
        <div 
          className="fixed inset-0 bg-slate-900/50 dark:bg-black/60 z-40 lg:hidden backdrop-blur-sm transition-opacity"
          onClick={onClose}
        />
      )}

      {/* Sidebar Panel */}
      <div className={`
        fixed inset-y-0 right-0 z-50 w-full sm:w-80 bg-white dark:bg-[#0d1420] border-l border-slate-200 dark:border-[#1f2937] shadow-2xl
        transform transition-transform duration-300 ease-in-out flex flex-col
        lg:absolute lg:top-0 lg:bottom-0 lg:h-full lg:rounded-2xl lg:border
        translate-x-0
      `}>
        
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] flex items-center justify-between bg-slate-50 dark:bg-[#0a101a] lg:rounded-t-2xl">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white capitalize">
              {format(selectedDate, 'EEEE', { locale: tr })}
            </h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {format(selectedDate, 'd MMMM yyyy', { locale: tr })}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:bg-slate-200 dark:hover:bg-[#1a2232] rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 custom-scrollbar">
          {isPast && (
            <div className="mb-4 p-3 bg-slate-100 dark:bg-[#1a2232] border border-slate-200 dark:border-[#2d3f55] rounded-xl flex items-start gap-2 text-slate-600 dark:text-slate-400 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <p>Bu tarih geçmişte kaldı. Yeni randevu oluşturulamaz.</p>
            </div>
          )}

          {dayApps.length > 0 ? (
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Randevular ({dayApps.length})</h4>
              
              {dayApps.map(app => {
                const isAppCancelled = app.status === 'reddedildi' || app.status === 'iptal';
                const appDate = new Date(app.appointment_date);
                
                return (
                  <Link 
                    key={app.id} 
                    href={`/customers/${app.customers?.id}`}
                    className={`block p-4 rounded-xl border transition-all hover:-translate-y-0.5 hover:shadow-md
                      ${isAppCancelled ? 'bg-red-50/50 border-red-200 dark:bg-red-900/10 dark:border-red-900/30' : 
                        isPast ? 'bg-white border-slate-200 dark:bg-[#0a101a] dark:border-[#1f2937] opacity-70' : 
                        'bg-white border-blue-100 dark:bg-[#0a101a] dark:border-blue-900/30 shadow-sm'}
                    `}
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold">
                        <Clock className={`w-4 h-4 ${isAppCancelled ? 'text-red-500' : 'text-blue-500'}`} />
                        {format(appDate, 'HH:mm')}
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider
                        ${isAppCancelled ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' :
                          isPast ? 'bg-slate-100 text-slate-600 dark:bg-[#1f2937] dark:text-slate-400' :
                          'bg-blue-100 text-blue-600 dark:bg-blue-500/20 dark:text-blue-400'}
                      `}>
                        {isAppCancelled ? 'İptal' : isPast ? 'Geçmiş' : 'Yaklaşan'}
                      </span>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-start gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                        <div>
                          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                            {app.customers?.first_name} {app.customers?.last_name}
                          </p>
                          <p className="text-[11px] text-slate-500">{app.customers?.phone ? maskPhone(app.customers.phone) : "—"}</p>
                        </div>
                      </div>

                      <div className="flex items-start gap-2">
                        <Globe className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                        <p className="text-xs text-slate-600 dark:text-slate-300">
                          {app.country} Vizesi
                        </p>
                      </div>

                      {app.appointment_location && (
                        <div className="flex items-start gap-2">
                          <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5" />
                          <p className="text-xs text-slate-600 dark:text-slate-300 line-clamp-2">
                            {app.appointment_location}
                          </p>
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className="h-40 flex flex-col items-center justify-center text-center px-4">
              <div className="w-12 h-12 bg-slate-100 dark:bg-[#1a2232] rounded-full flex items-center justify-center mb-3">
                <CalendarPlus className="w-5 h-5 text-slate-400" />
              </div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Randevu Yok</p>
              <p className="text-xs text-slate-500 mt-1">Bu tarihte planlanmış bir vize randevusu bulunmuyor.</p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-5 border-t border-slate-200 dark:border-[#1f2937] bg-white dark:bg-[#0d1420] lg:rounded-b-2xl">
          <Link 
            href="/customers" // Müşteriler listesine atalım, oradan randevu verebilir
            className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-bold transition-all
              ${isPast 
                ? 'bg-slate-100 dark:bg-[#1a2232] text-slate-400 cursor-not-allowed pointer-events-none' 
                : 'bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/20 hover:shadow-blue-600/40'}
            `}
          >
            <CalendarPlus className="w-4 h-4" />
            Yeni Randevu Ekle
          </Link>
          {isPast && <p className="text-[10px] text-center text-slate-500 mt-2">Geçmiş tarihe randevu eklenemez.</p>}
        </div>
      </div>
    </>
  );
}
