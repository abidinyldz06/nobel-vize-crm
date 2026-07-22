import { Check, Clock, Edit2, AlertCircle } from "lucide-react";

// Full 8-step status flow as per spec
export const STATUS_STEPS = [
  { key: "profil_analizi",     label: "Profil\nAnalizi",       short: "Profil" },
  { key: "evrak_bekleniyor",   label: "Evrak\nBekleniyor",     short: "Evrak" },
  { key: "randevu_bekleniyor", label: "Randevu\nBekleniyor",   short: "Randevu Bekle" },
  { key: "randevu_alindi",     label: "Randevu\nAlındı",       short: "Randevu" },
  { key: "evrak_hazirlaniyor", label: "Evrak\nHazırlanıyor",   short: "Hazırlık" },
  { key: "basvuru_yapildi",    label: "Başvuru\nYapıldı",      short: "Başvuru" },
  { key: "onaylandi",          label: "Onaylandı",             short: "Onay" },
  { key: "reddedildi",         label: "Reddedildi",            short: "Red" },
];

export const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  profil_analizi:     { label: "Profil Analizi",      color: "text-slate-500 dark:text-slate-400",   bg: "bg-slate-700" },
  evrak_bekleniyor:   { label: "Evrak Bekleniyor",    color: "text-amber-400",   bg: "bg-amber-500/20" },
  randevu_bekleniyor: { label: "Randevu Bekleniyor",  color: "text-orange-400",  bg: "bg-orange-500/20" },
  randevu_alindi:     { label: "Randevu Alındı",      color: "text-blue-400",    bg: "bg-blue-500/20" },
  evrak_hazirlaniyor: { label: "Evrak Hazırlanıyor",  color: "text-indigo-400",  bg: "bg-indigo-500/20" },
  basvuru_yapildi:    { label: "Başvuru Yapıldı",     color: "text-purple-400",  bg: "bg-purple-500/20" },
  onaylandi:          { label: "Onaylandı ✓",          color: "text-emerald-400", bg: "bg-emerald-500/20" },
  reddedildi:         { label: "Reddedildi ✗",         color: "text-red-400",     bg: "bg-red-500/20" },
  itiraz:             { label: "İtiraz",              color: "text-yellow-400",  bg: "bg-yellow-500/20" },
  kapandi:            { label: "Kapandı",             color: "text-slate-500",   bg: "bg-slate-800" },
};

export default function StatusTimeline({
  currentStatus,
}: {
  currentStatus: string;
}) {
  // Only show first 6 main steps in the timeline bar (onaylandi/reddedildi shown separately)
  const mainSteps = STATUS_STEPS.slice(0, 6);
  
  const isFinalState = ['onaylandi', 'reddedildi', 'itiraz', 'kapandi'].includes(currentStatus);
  const currentIndex = mainSteps.findIndex(s => s.key === currentStatus);
  const progress = isFinalState ? 100 : Math.max(0, Math.min(100, (currentIndex / (mainSteps.length - 1)) * 100));

  // Determine track color based on final state
  const trackColor = currentStatus === "reddedildi" ? "bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.5)]" :
                     currentStatus === "itiraz" ? "bg-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]" :
                     currentStatus === "kapandi" ? "bg-slate-500 shadow-[0_0_12px_rgba(100,116,139,0.5)]" :
                     "bg-blue-500 shadow-[0_0_12px_rgba(59,130,246,0.5)]";

  return (
    <div className="w-full">
      {/* Main Progress Bar — first 6 steps */}
      <div className="relative pt-4 pb-10">
        {/* Track */}
        <div className="absolute top-[34px] left-[5%] right-[5%] h-1 bg-slate-200 dark:bg-[#1f2937] rounded-full z-0" />
        {/* Active progress */}
        <div
          className={`absolute top-[34px] left-[5%] h-1 rounded-full z-0 transition-all duration-700 ${trackColor}`}
          style={{ width: `${progress * 0.9}%` }}
        />

        {/* Steps */}
        <div className="relative z-10 flex justify-between px-[5%]">
          {mainSteps.map((step, i) => {
            const isDone = isFinalState || currentIndex > i;
            const isCurrent = !isFinalState && currentIndex === i;
            
            let circleColor = "bg-white dark:bg-[#0d1420] border-slate-300 dark:border-[#2d3f55] group-hover:border-blue-500/60";
            let textColor = "text-slate-500";
            let badgeBg = "bg-slate-200 dark:bg-[#1f2937] text-slate-600";
            let badgeText = "Bekliyor";
            let Icon = Clock;

            if (isCurrent) {
              circleColor = "bg-blue-500 border-blue-400 ring-4 ring-blue-500/20 shadow-[0_0_16px_rgba(59,130,246,0.6)]";
              textColor = "text-slate-900 dark:text-white";
              badgeBg = "bg-blue-500/10 text-blue-400";
              badgeText = "Aktif";
              Icon = Edit2;
            } else if (isDone) {
              if (currentStatus === "reddedildi") {
                circleColor = "bg-red-600 border-red-600 shadow-[0_0_12px_rgba(220,38,38,0.5)]";
                textColor = "text-red-400";
                badgeBg = "bg-red-500/10 text-red-400";
                badgeText = "İptal/Red";
                Icon = AlertCircle;
              } else if (currentStatus === "itiraz") {
                circleColor = "bg-amber-500 border-amber-500 shadow-[0_0_12px_rgba(245,158,11,0.5)]";
                textColor = "text-amber-400";
                badgeBg = "bg-amber-500/10 text-amber-500";
                badgeText = "İtiraz";
                Icon = AlertCircle;
              } else if (currentStatus === "kapandi") {
                circleColor = "bg-slate-600 border-slate-600 shadow-[0_0_12px_rgba(71,85,105,0.5)]";
                textColor = "text-slate-400";
                badgeBg = "bg-slate-500/20 text-slate-400";
                badgeText = "Kapandı";
                Icon = Check;
              } else {
                circleColor = "bg-blue-600 border-blue-600 shadow-[0_0_12px_rgba(59,130,246,0.5)]";
                textColor = "text-blue-400";
                badgeBg = "bg-emerald-500/10 text-emerald-400";
                badgeText = "Tamamlandı";
                Icon = Check;
              }
            }

            return (
              <div
                key={step.key}
                className="flex flex-col items-center gap-2"
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${circleColor}`}>
                  <Icon className={`w-3.5 h-3.5 ${isCurrent ? "text-slate-900 dark:text-white" : isDone ? "text-white" : "text-slate-600 group-hover:text-blue-400"}`} />
                </div>
                <div className="text-center">
                  <p className={`text-[10px] font-semibold leading-tight whitespace-pre-line text-center ${textColor}`}>
                    {step.label}
                  </p>
                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full mt-0.5 inline-block ${badgeBg}`}>
                    {badgeText}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {/* Progress % */}
        <div className="absolute bottom-0 left-[5%] right-[5%] flex justify-between text-[10px] text-slate-600">
          <span>0%</span>
          <span className="text-blue-400 font-medium">{Math.round(progress)}% tamamlandı</span>
          <span>100%</span>
        </div>
      </div>

      {/* Final outcome indicators — Onaylandı / Reddedildi / İtiraz / Kapandı */}
      <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-200 dark:border-[#1f2937]">
        <p className="text-[10px] text-slate-500 w-full mb-1">Sonuç:</p>
        {[
          { key: "onaylandi",  label: "✓ Onaylandı",  cls: "bg-emerald-500/10 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/20" },
          { key: "reddedildi", label: "✗ Reddedildi", cls: "bg-red-500/10 border-red-500/30 text-red-400 hover:bg-red-500/20" },
          { key: "itiraz",     label: "⚠ İtiraz",      cls: "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20" },
          { key: "kapandi",    label: "— Kapandı",     cls: "bg-slate-800/50 border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-700" },
        ].map(btn => (
          <span
            key={btn.key}
            className={`px-3 py-1 rounded-lg border text-[11px] font-semibold ${btn.cls} ${
              currentStatus === btn.key ? "ring-2 ring-white/20 scale-105" : ""
            }`}
          >
            {btn.label}
          </span>
        ))}
      </div>
    </div>
  );
}
