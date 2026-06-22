import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Calendar, MapPin, Clock, ArrowRight } from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

export default async function AppointmentsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: appointments } = await supabase
    .from('applications')
    .select(`
      id, 
      country, 
      appointment_date, 
      appointment_location,
      customers (id, first_name, last_name, phone)
    `)
    .not('appointment_date', 'is', null)
    .order('appointment_date', { ascending: true });

  const now = new Date();
  const upcoming = appointments?.filter(a => new Date(a.appointment_date) >= now) || [];
  const past = appointments?.filter(a => new Date(a.appointment_date) < now) || [];

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center gap-4 mb-7">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center">
            <Calendar className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Randevu Takvimi</h1>
            <p className="text-slate-500 text-xs mt-0.5">Müşterilerin yaklaşan ve geçmiş vize randevuları.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Upcoming */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-emerald-400" /> Yaklaşan Randevular
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#1f2937]">
              {upcoming.length > 0 ? upcoming.map((app: any) => (
                <div key={app.id} className="p-5 hover:bg-slate-100 dark:bg-[#1a2232] transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <Link href={`/customers/${app.customers?.id}`} className="font-semibold text-blue-400 hover:text-blue-300 text-sm">
                      {app.customers?.first_name} {app.customers?.last_name}
                    </Link>
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-emerald-500/10 text-emerald-400 rounded-md">Yaklaşan</span>
                  </div>
                  <div className="text-sm text-slate-700 dark:text-slate-300 mb-3">{app.country} Vizesi</div>
                  <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5 bg-white dark:bg-[#060d1a] px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-[#1f2937]">
                      <Calendar className="w-3.5 h-3.5 text-blue-400" />
                      {new Date(app.appointment_date).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    {app.appointment_location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[150px]">{app.appointment_location}</span>
                      </div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-slate-500 text-sm border border-dashed border-slate-200 dark:border-[#1f2937] m-4 rounded-xl">Yaklaşan randevu yok.</div>
              )}
            </div>
          </div>

          {/* Past */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg opacity-80">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-slate-500" /> Geçmiş Randevular
              </h2>
            </div>
            <div className="divide-y divide-slate-200 dark:divide-[#1f2937]">
              {past.length > 0 ? past.map((app: any) => (
                <div key={app.id} className="p-5 hover:bg-slate-100 dark:bg-[#1a2232] transition-colors">
                  <div className="flex justify-between items-start mb-2">
                    <Link href={`/customers/${app.customers?.id}`} className="font-semibold text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:text-white text-sm">
                      {app.customers?.first_name} {app.customers?.last_name}
                    </Link>
                    <span className="text-[10px] font-medium px-2 py-0.5 bg-slate-200 dark:bg-[#1f2937] text-slate-500 dark:text-slate-400 rounded-md">Geçmiş</span>
                  </div>
                  <div className="text-sm text-slate-500 dark:text-slate-400 mb-3">{app.country} Vizesi</div>
                  <div className="flex items-center gap-4 text-xs text-slate-500">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(app.appointment_date).toLocaleString('tr-TR', { dateStyle: 'medium', timeStyle: 'short' })}
                    </div>
                    {app.appointment_location && (
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5" />
                        <span className="truncate max-w-[150px]">{app.appointment_location}</span>
                      </div>
                    )}
                  </div>
                </div>
              )) : (
                <div className="p-8 text-center text-slate-500 text-sm">Geçmiş randevu yok.</div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
