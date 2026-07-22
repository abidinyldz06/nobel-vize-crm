export const APPLICATION_STATUSES = [
  "profil_analizi",
  "evrak_bekleniyor",
  "randevu_bekleniyor",
  "randevu_alindi",
  "evrak_hazirlaniyor",
  "basvuru_yapildi",
  "onaylandi",
  "reddedildi",
  "itiraz",
  "kapandi",
] as const;

export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const APPLICATION_STATUS_META: Record<ApplicationStatus, { label: string; color: string; column: string }> = {
  profil_analizi: { label: "Profil Analizi", color: "bg-slate-500/10 text-slate-600 dark:text-slate-300", column: "Profil" },
  evrak_bekleniyor: { label: "Evrak Bekleniyor", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400", column: "Evrak" },
  randevu_bekleniyor: { label: "Randevu Bekleniyor", color: "bg-orange-500/10 text-orange-600 dark:text-orange-400", column: "Randevu Bekliyor" },
  randevu_alindi: { label: "Randevu Alındı", color: "bg-blue-500/10 text-blue-600 dark:text-blue-400", column: "Randevu Alındı" },
  evrak_hazirlaniyor: { label: "Evrak Hazırlanıyor", color: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400", column: "Hazırlık" },
  basvuru_yapildi: { label: "Başvuru Yapıldı", color: "bg-purple-500/10 text-purple-600 dark:text-purple-400", column: "Sonuç Bekliyor" },
  onaylandi: { label: "Onaylandı", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400", column: "Onaylandı" },
  reddedildi: { label: "Reddedildi", color: "bg-red-500/10 text-red-600 dark:text-red-400", column: "Reddedildi" },
  itiraz: { label: "İtiraz", color: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-400", column: "İtiraz" },
  kapandi: { label: "Kapandı", color: "bg-slate-500/10 text-slate-500", column: "Kapandı" },
};

export const APPLICATION_TRANSITIONS: Record<ApplicationStatus, readonly ApplicationStatus[]> = {
  profil_analizi: ["evrak_bekleniyor", "randevu_alindi", "kapandi"],
  evrak_bekleniyor: ["profil_analizi", "randevu_bekleniyor", "randevu_alindi", "evrak_hazirlaniyor", "kapandi"],
  randevu_bekleniyor: ["evrak_bekleniyor", "randevu_alindi", "kapandi"],
  randevu_alindi: ["randevu_bekleniyor", "evrak_hazirlaniyor", "basvuru_yapildi", "kapandi"],
  evrak_hazirlaniyor: ["evrak_bekleniyor", "randevu_bekleniyor", "randevu_alindi", "basvuru_yapildi", "kapandi"],
  basvuru_yapildi: ["evrak_hazirlaniyor", "onaylandi", "reddedildi", "kapandi"],
  onaylandi: ["kapandi"],
  reddedildi: ["itiraz", "kapandi"],
  itiraz: ["onaylandi", "reddedildi", "kapandi"],
  kapandi: [],
};

export function isApplicationStatus(value: string): value is ApplicationStatus {
  return (APPLICATION_STATUSES as readonly string[]).includes(value);
}
