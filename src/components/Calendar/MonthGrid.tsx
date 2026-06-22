"use client"
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, eachDayOfInterval, isSameMonth, isSameDay, isToday, format } from "date-fns";
import { tr } from "date-fns/locale";
import { Clock } from "lucide-react";

export default function MonthGrid({ 
  currentMonth, 
  appointments, 
  selectedDate,
  onSelectDate 
}: { 
  currentMonth: Date, 
  appointments: any[], 
  selectedDate: Date | null,
  onSelectDate: (date: Date) => void 
}) {
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(monthStart);
  // weekStartsOn: 1 means Monday
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const weekDays = ['Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt', 'Paz'];

  return (
    <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl shadow-lg overflow-hidden flex flex-col h-full">
      {/* Weekday Headers */}
      <div className="grid grid-cols-7 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
        {weekDays.map(day => (
          <div key={day} className="py-3 text-center text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
            {day}
          </div>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 grid grid-cols-7 auto-rows-fr bg-slate-200 dark:bg-[#1f2937] gap-px">
        {days.map((day, idx) => {
          const isCurrentMonth = isSameMonth(day, monthStart);
          const isSelected = selectedDate && isSameDay(day, selectedDate);
          const isDayToday = isToday(day);

          // Get appointments for this day
          const dayApps = appointments.filter(app => isSameDay(new Date(app.appointment_date), day));
          // Sort by time
          dayApps.sort((a, b) => new Date(a.appointment_date).getTime() - new Date(b.appointment_date).getTime());

          return (
            <div 
              key={day.toString()} 
              onClick={() => onSelectDate(day)}
              className={`min-h-[100px] p-2 transition-colors cursor-pointer flex flex-col relative group
                ${isCurrentMonth ? 'bg-white dark:bg-[#0d1420]' : 'bg-slate-50/50 dark:bg-[#0a101a]/50 text-slate-400'}
                ${isSelected ? 'ring-2 ring-inset ring-blue-500 bg-blue-50/30 dark:bg-blue-900/10' : 'hover:bg-slate-50 dark:hover:bg-[#1a2232]'}
              `}
            >
              {/* Date Number */}
              <div className="flex justify-between items-start mb-1">
                <span className={`text-xs font-semibold w-6 h-6 flex items-center justify-center rounded-full
                  ${isDayToday ? 'bg-blue-600 text-white shadow-md shadow-blue-500/30' : isCurrentMonth ? 'text-slate-700 dark:text-slate-300' : 'text-slate-400 dark:text-slate-600'}
                `}>
                  {format(day, 'd')}
                </span>
                
                {/* Small indicator dot if mobile or just styling */}
                {dayApps.length > 0 && (
                  <span className="lg:hidden w-1.5 h-1.5 rounded-full bg-blue-500 mt-2.5"></span>
                )}
              </div>

              {/* Appointments List (Desktop) */}
              <div className="hidden lg:flex flex-col gap-1 overflow-y-auto custom-scrollbar flex-1">
                {dayApps.slice(0, 2).map(app => {
                  const isPast = new Date(app.appointment_date) < new Date();
                  const isCancelled = app.status === 'reddedildi' || app.status === 'iptal';
                  
                  let bgColor = "bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/10 dark:hover:bg-blue-500/20 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-500/20";
                  if (isCancelled) bgColor = "bg-red-50 hover:bg-red-100 dark:bg-red-500/10 dark:hover:bg-red-500/20 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20";
                  else if (isPast) bgColor = "bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700";
                  else if (isDayToday) bgColor = "bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20";

                  return (
                    <div key={app.id} className={`text-[10px] px-1.5 py-1 rounded border transition-colors truncate flex items-center gap-1 ${bgColor}`} title={`${app.customers?.first_name} ${app.customers?.last_name} - ${format(new Date(app.appointment_date), 'HH:mm')}`}>
                      <span className="font-semibold">{format(new Date(app.appointment_date), 'HH:mm')}</span>
                      <span className="truncate">{app.customers?.first_name}</span>
                    </div>
                  );
                })}

                {dayApps.length > 2 && (
                  <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 text-center py-0.5 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                    +{dayApps.length - 2} randevu
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
