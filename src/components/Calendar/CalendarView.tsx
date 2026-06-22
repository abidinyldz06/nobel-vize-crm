"use client"
import { useState } from "react";
import { format, addMonths, subMonths, isToday } from "date-fns";
import { tr } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List } from "lucide-react";
import MonthGrid from "./MonthGrid";
import DaySidebar from "./DaySidebar";

type ViewMode = "month" | "list";

export default function CalendarView({ appointments }: { appointments: any[] }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("month");

  const prevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const nextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const goToday = () => setCurrentMonth(new Date());

  return (
    <div className="flex flex-col h-[calc(100vh-120px)]">
      {/* Top Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-1 rounded-xl shadow-sm">
            <button onClick={prevMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1a2232] rounded-lg transition-colors">
              <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
            <h2 className="text-sm font-bold w-32 text-center text-slate-900 dark:text-white capitalize">
              {format(currentMonth, 'MMMM yyyy', { locale: tr })}
            </h2>
            <button onClick={nextMonth} className="p-1.5 hover:bg-slate-100 dark:hover:bg-[#1a2232] rounded-lg transition-colors">
              <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
            </button>
          </div>
          <button onClick={goToday} className="px-4 py-2 text-xs font-semibold bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-700 dark:text-slate-300 rounded-xl hover:bg-slate-50 dark:hover:bg-[#1a2232] transition-colors shadow-sm">
            Bugün
          </button>
        </div>

        <div className="flex items-center gap-4">
          {/* Legend */}
          <div className="hidden lg:flex items-center gap-3 text-[10px] font-medium px-4 py-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl shadow-sm">
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-blue-500"></div> Yaklaşan</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-emerald-500"></div> Bugün</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-slate-400"></div> Geçmiş</div>
            <div className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-red-500"></div> İptal/Red</div>
          </div>

          {/* View Toggle */}
          <div className="flex items-center bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] p-1 rounded-xl shadow-sm">
            <button 
              onClick={() => setViewMode("month")} 
              className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'month' ? 'bg-blue-500/10 text-blue-500' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a2232]'}`}
              title="Aylık Görünüm"
            >
              <CalendarIcon className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode("list")} 
              className={`p-1.5 rounded-lg flex items-center justify-center transition-colors ${viewMode === 'list' ? 'bg-blue-500/10 text-blue-500' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-[#1a2232]'}`}
              title="Liste Görünümü"
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex gap-6 overflow-hidden relative">
        <div className={`flex-1 transition-all duration-300 h-full overflow-y-auto ${selectedDate ? 'lg:pr-80' : ''}`}>
          {viewMode === "month" ? (
            <MonthGrid 
              currentMonth={currentMonth} 
              appointments={appointments} 
              selectedDate={selectedDate}
              onSelectDate={setSelectedDate} 
            />
          ) : (
            <div className="bg-white dark:bg-[#0d1420] rounded-2xl border border-slate-200 dark:border-[#1f2937] p-6 shadow-lg h-full overflow-y-auto">
              <h3 className="text-sm font-semibold mb-4 text-slate-900 dark:text-white">Liste Görünümü</h3>
              <p className="text-xs text-slate-500 mb-4">Aylık görünüme geçerek takvimi daha verimli kullanabilirsiniz.</p>
              
              <div className="space-y-2">
                {appointments.slice(0, 50).map(app => (
                  <div key={app.id} className="p-3 bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl flex justify-between items-center">
                    <div>
                      <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">{app.customers?.first_name} {app.customers?.last_name}</p>
                      <p className="text-xs text-slate-500">{app.country} - {app.appointment_location || 'Belirtilmedi'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200">{format(new Date(app.appointment_date), 'dd MMM yyyy', { locale: tr })}</p>
                      <p className="text-xs text-slate-500">{format(new Date(app.appointment_date), 'HH:mm')}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar overlay for selected day */}
        <DaySidebar 
          selectedDate={selectedDate} 
          appointments={appointments} 
          onClose={() => setSelectedDate(null)} 
        />
      </div>
    </div>
  );
}
