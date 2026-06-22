import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Globe } from "lucide-react";
import CountriesManager from "@/components/CountriesManager";

export const revalidate = 0;

export default async function CountriesPage() {
  const supabase = await createSupabaseServerClient();
  const { data: countries } = await supabase
    .from("countries")
    .select("*, documents:documents(count)")
    .order("name");

  // Get application count per country
  const { data: appStats } = await supabase
    .from("applications")
    .select("country");

  const countMap: Record<string, number> = {};
  appStats?.forEach((a: any) => {
    countMap[a.country] = (countMap[a.country] || 0) + 1;
  });

  const enriched = (countries ?? []).map((c: any) => ({
    ...c,
    appCount: countMap[c.name] || 0,
    docCount: Array.isArray(c.document_checklist) ? c.document_checklist.length : 0,
  }));

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-[#060d1a]">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-7">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Globe className="w-5 h-5 text-blue-400" /> Ülke ve Evrak Konfigürasyonu
          </h1>
          <p className="text-slate-500 text-xs mt-0.5">
            Sistemdeki ülkeleri ve istenen evrak listelerini yönetin.
          </p>
        </div>
      </div>

      <CountriesManager initialCountries={enriched} />
    </div>
  );
}
