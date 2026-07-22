export const TRAVEL_METHOD_OPTIONS = {
  ucak: "Uçak",
  tur_paketi: "Tur Paketi",
  gemi: "Gemi",
  kendi_araci: "Kendi Aracı",
  diger: "Diğer",
} as const;

export const ACCOMMODATION_OPTIONS = {
  otel: "Otel",
  aile_arkadas: "Aile / Arkadaş Yanı",
  diger: "Diğer",
} as const;

export const OCCUPATION_OPTIONS = {
  calisan: "Çalışan",
  memur: "Memur",
  emekli: "Emekli",
  ogrenci: "Öğrenci",
  issiz: "İşsiz",
  sirket_sahibi: "Şirket Sahibi",
  diger: "Diğer",
} as const;

export const NATIONALITY_OPTIONS = {
  tc: "TC Vatandaşı",
  diger: "Diğer",
} as const;

export function optionLabel(options: Record<string, string>, value: string | null | undefined) {
  if (!value) return "Belirtilmedi";
  return options[value] ?? value;
}
