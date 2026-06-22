import { createSupabaseServerClient } from "@/lib/supabase-server";
import { Users, Plus, Shield, User, Phone, Mail, MoreHorizontal } from "lucide-react";
import Link from "next/link";

export const revalidate = 0;

export default async function StaffPage() {
  const supabase = await createSupabaseServerClient();
  
  // Role Check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const { redirect } = await import("next/navigation");
    redirect("/");
  }
  
  const { data: currentUserStaff } = await supabase.from('staff').select('role').eq('user_id', user?.id).single();
  // Staff tablosu boşsa veya kayıt yoksa admin olarak davran (dashboard ile aynı mantık)
  if (currentUserStaff && currentUserStaff.role !== 'admin') {
    const { redirect } = await import("next/navigation");
    redirect("/dashboard");
  }

  const { data: staff } = await supabase
    .from('staff')
    .select('*')
    .order('created_at', { ascending: false });

  // Get customer count per staff
  const { data: customerCounts } = await supabase
    .from('customers')
    .select('assigned_staff_id');

  const countMap: Record<string, number> = {};
  customerCounts?.forEach((c: any) => {
    if (c.assigned_staff_id) {
      countMap[c.assigned_staff_id] = (countMap[c.assigned_staff_id] || 0) + 1;
    }
  });

  const adminCount = staff?.filter(s => s.role === 'admin').length || 0;
  const consultantCount = staff?.filter(s => s.role === 'consultant').length || 0;

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-7">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-400" /> Personel Yönetimi
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">
              {staff?.length || 0} personel · {adminCount} yönetici · {consultantCount} danışman
            </p>
          </div>
          <Link
            href="/staff/new"
            className="flex items-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30"
          >
            <Plus className="w-4 h-4" /> Yeni Personel
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Toplam Personel", value: staff?.length || 0, icon: Users, color: "border-t-blue-500" },
            { label: "Yönetici (Admin)", value: adminCount, icon: Shield, color: "border-t-purple-500" },
            { label: "Danışman", value: consultantCount, icon: User, color: "border-t-emerald-500" },
          ].map((s, i) => (
            <div key={i} className={`bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] border-t-2 ${s.color} rounded-2xl p-4`}>
              <s.icon className="w-4 h-4 text-slate-500 mb-2" />
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
              <p className="text-xs text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Staff Table */}
        <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
          <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Personel Listesi</h2>
          </div>

          {!staff || staff.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <Users className="w-12 h-12 mx-auto mb-3 text-slate-700" />
              <p className="text-slate-500 text-sm">Henüz personel eklenmedi.</p>
              <Link href="/staff/new" className="mt-3 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all">
                <Plus className="w-4 h-4" /> İlk Personeli Ekle
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 dark:border-[#1f2937]">
                  <tr>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Personel</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Rol</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">İletişim</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Müşteri</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Durum</th>
                    <th className="px-6 py-4 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider text-right">İşlem</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-[#1f2937]">
                  {staff.map((member: any) => (
                    <tr key={member.id} className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-800 to-purple-900 flex items-center justify-center font-bold text-xs text-blue-300 uppercase border border-blue-800/50 shrink-0">
                            {member.full_name?.[0]}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900 dark:text-slate-200">{member.full_name}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${
                          member.role === 'admin'
                            ? 'bg-purple-500/10 text-purple-400 border border-purple-500/20'
                            : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                        }`}>
                          {member.role === 'admin' ? <Shield className="w-3 h-3" /> : <User className="w-3 h-3" />}
                          {member.role === 'admin' ? 'Yönetici' : 'Danışman'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 dark:text-slate-400">
                        <div>
                          <p className="text-slate-700 dark:text-slate-300 text-xs flex items-center gap-1"><Mail className="w-3 h-3" />{member.email}</p>
                          {member.phone && <p className="text-slate-500 text-xs flex items-center gap-1 mt-0.5"><Phone className="w-3 h-3" />{member.phone}</p>}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">
                          {countMap[member.id] || 0}
                          <span className="text-slate-600 font-normal text-xs ml-1">müşteri</span>
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${
                          member.is_active
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-slate-800 text-slate-500'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${member.is_active ? 'bg-emerald-500' : 'bg-slate-600'}`} />
                          {member.is_active ? 'Aktif' : 'Pasif'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <Link
                          href={`/staff/${member.id}/edit`}
                          className="p-2 text-slate-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors inline-flex"
                        >
                          <MoreHorizontal className="w-4 h-4" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
