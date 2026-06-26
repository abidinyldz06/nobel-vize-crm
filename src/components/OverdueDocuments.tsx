import { createSupabaseServerClient } from "@/lib/supabase-server";
import { AlertCircle, Clock } from "lucide-react";
import Link from "next/link";
import BulkWhatsAppReminder from "./BulkWhatsAppReminder";

export default async function OverdueDocuments({ isAdmin, staffId }: { isAdmin: boolean, staffId?: string }) {
  const supabase = await createSupabaseServerClient();
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

  let query = supabase
    .from('documents')
    .select('id, document_type, requested_at, application_id, applications!inner(id, country, customer_id, customers(id, first_name, last_name, phone))')
    .eq('status', 'bekleniyor')
    .lt('requested_at', threeDaysAgo)
    .order('requested_at', { ascending: true });

  if (!isAdmin && staffId) {
    // Danışmanın müşterilerinin application ID'lerini bul
    const { data: staffApps } = await supabase.from('applications').select('id, customers!inner(id)').eq('customers.assigned_staff_id', staffId);
    const appIds = staffApps?.map(a => a.id) || [];
    if (appIds.length === 0) return null;
    query = query.in('application_id', appIds);
  }

  const { data: overdueDocs } = await query.limit(20);

  if (!overdueDocs || overdueDocs.length === 0) return null;

  // Grup listesi oluştur (WhatsApp toplu hatırlatma için)
  const customersMap = new Map();
  overdueDocs.forEach((doc: any) => {
    const customer = doc.applications?.customers;
    const country = doc.applications?.country;
    if (!customer?.id) return;
    
    if (!customersMap.has(customer.id)) {
      customersMap.set(customer.id, {
        customer: customer,
        country: country || "",
        docs: []
      });
    }
    customersMap.get(customer.id).docs.push(doc.document_type);
  });
  
  const customersList = Array.from(customersMap.values());

  return (
    <div className="bg-white dark:bg-[#0d1420] border border-red-200 dark:border-red-900/30 rounded-2xl overflow-hidden shadow-lg mb-5">
      <div className="px-5 py-4 border-b border-red-100 dark:border-red-900/30 bg-red-50 dark:bg-red-500/10 flex justify-between items-center">
        <h2 className="text-sm font-bold text-red-700 dark:text-red-400 flex items-center gap-2">
          <AlertCircle className="w-4 h-4" /> Geciken Evraklar
        </h2>
        <BulkWhatsAppReminder customersList={customersList} />
      </div>
      <div className="divide-y divide-slate-100 dark:divide-[#1f2937]">
        {overdueDocs.map((doc: any) => {
          const daysOverdue = Math.floor((Date.now() - new Date(doc.requested_at).getTime()) / (1000 * 60 * 60 * 24));
          const isCritical = daysOverdue >= 7;
          const customer = doc.applications?.customers;
          
          return (
            <Link key={doc.id} href={`/customers/${customer?.id}`} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-200">{customer?.first_name} {customer?.last_name}</p>
                <p className="text-xs font-medium text-slate-500 mt-0.5 truncate max-w-[200px] sm:max-w-[250px]">{doc.document_type}</p>
              </div>
              <div className="text-right flex flex-col items-end gap-1">
                <span className={`text-[10px] font-bold px-2 py-1 rounded-lg flex items-center gap-1 ${
                  isCritical 
                    ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400' 
                    : 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                }`}>
                  <Clock className="w-3 h-3" /> {daysOverdue} gün gecikti
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
