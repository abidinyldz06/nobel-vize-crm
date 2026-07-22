import { createSupabaseAdminClient } from "@/lib/supabase-admin";
import { VISA_TYPE_LABELS } from "@/lib/visa-types";
import { Check, Clock, AlertCircle, Calendar, FileText, CreditCard, MapPin, Phone, MessageCircle, CheckCircle2, Globe, Mail } from "lucide-react";
import PrintButton from "@/components/Portal/PrintButton";
import { APPLICATION_STATUS_META, isApplicationStatus } from "@/lib/application-status";

export const revalidate = 0;

const STATUS_STEPS = [
  { key: "profil_analizi",     label: "Profil Analizi",       short: "Profil" },
  { key: "evrak_bekleniyor",   label: "Evrak Bekleniyor",     short: "Evrak" },
  { key: "randevu_bekleniyor", label: "Randevu Bekleniyor",   short: "Randevu" },
  { key: "randevu_alindi",     label: "Randevu Alındı",       short: "Randevu" },
  { key: "evrak_hazirlaniyor", label: "Evrak Hazırlanıyor",   short: "Hazırlık" },
  { key: "basvuru_yapildi",    label: "Başvuru Yapıldı",      short: "Başvuru" },
];

interface PortalDocument {
  id: string;
  document_type: string | null;
  status: string | null;
  description: string | null;
}

interface PortalPayment {
  amount: number | string;
  status: string | null;
  method: string | null;
  created_at: string;
}

export default async function PortalPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  
  // Portal reads run only on the server. The public browser never receives a
  // Supabase session or direct anonymous table access.
  const supabase = createSupabaseAdminClient();
  const { data: customer } = await supabase
    .from('customers')
    .select('id, first_name, last_name, portal_access_enabled, portal_token_expires_at')
    .eq('portal_token', token)
    .eq('is_deleted', false)
    .eq('portal_access_enabled', true)
    .gt('portal_token_expires_at', new Date().toISOString())
    .single();
  
  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#060d1a] p-6 print:bg-white print:p-0">
        <div className="max-w-md w-full bg-white dark:bg-[#0d1420] p-8 rounded-3xl shadow-xl text-center border border-slate-200 dark:border-[#1f2937] print:border-none print:shadow-none">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-5 opacity-90" />
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Geçersiz Bağlantı</h1>
          <p className="text-slate-500 text-sm">Bu portal bağlantısı geçersiz veya süresi dolmuş olabilir. Lütfen danışmanınızla iletişime geçin.</p>
        </div>
      </div>
    );
  }

  await supabase.from('customers').update({ portal_last_accessed_at: new Date().toISOString() }).eq('id', customer.id);

  const { data: company } = await supabase
    .from('tenants')
    .select('company_name, email, phone')
    .single();
  
  // GÜVENLİK: Sadece gerekli başvuru bilgileri çekilir
  const { data: applications } = await supabase
    .from('applications')
    .select('id, country, visa_type, status, created_at, appointment_date, appointment_location, total_fee')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false });
    
  const activeApp = applications?.[0];
  const companyName = company?.company_name || 'Nobel Vize';
  const companyPhone = company?.phone || '';
  const companyEmail = company?.email || '';
  const phoneDigits = companyPhone.replace(/\D/g, '');
  const whatsappPhone = phoneDigits.startsWith('90') ? phoneDigits : phoneDigits.startsWith('0') ? `9${phoneDigits}` : `90${phoneDigits}`;

  let documents: PortalDocument[] | null = null;
  let payments: PortalPayment[] | null = null;

  if (activeApp) {
    const [{ data: docs }, { data: pays }] = await Promise.all([
      // GÜVENLİK: Sadece evrak tipi, durumu ve notu
      supabase.from('documents').select('id, document_type, status, description').eq('application_id', activeApp.id).order('created_at', { ascending: true }),
      // GÜVENLİK: Sadece miktar ve tarih. Başka hiçbir finansal kalem/konsolosluk harcı vs gösterilmez.
      supabase.from('payments').select('amount, status, method, created_at').eq('application_id', activeApp.id).order('created_at', { ascending: false })
    ]);
    documents = docs as PortalDocument[] | null;
    payments = pays as PortalPayment[] | null;
  }
  
  // Timeline calculations
  const currentStatus = activeApp?.status || 'profil_analizi';
  const isFinalState = ['onaylandi', 'reddedildi', 'itiraz', 'kapandi'].includes(currentStatus);
  const currentIndex = STATUS_STEPS.findIndex(s => s.key === currentStatus);
  const progress = isFinalState ? 100 : Math.max(0, Math.min(100, (currentIndex / (STATUS_STEPS.length - 1)) * 100));

  // Document calculations
  const totalDocs = documents?.length || 0;
  const completedDocs = documents?.filter(d => d.status === 'onaylandi').length || 0;
  const docProgress = totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0;

  // Payment calculations
  const totalFee = activeApp?.total_fee || 0;
  const totalPaid = payments?.filter(p => p.status === 'alindi').reduce((sum, p) => sum + Number(p.amount), 0) || 0;
  const remainingFee = Math.max(0, totalFee - totalPaid);
  const payProgress = totalFee > 0 ? (totalPaid / totalFee) * 100 : 0;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#060d1a] font-sans pb-20 selection:bg-blue-500/30 print:bg-white print:p-0 print:pb-0">
      
      {/* Header Area */}
      <div className="bg-gradient-to-b from-blue-600 to-blue-900 pt-10 pb-20 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden print:bg-none print:shadow-none print:text-black print:pb-10 print:pt-4 print:rounded-none">
        <div className="absolute top-0 left-0 w-64 h-64 bg-white/5 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2 pointer-events-none print:hidden" />
        <div className="absolute bottom-0 right-0 w-80 h-80 bg-blue-400/10 rounded-full blur-3xl translate-x-1/4 translate-y-1/4 pointer-events-none print:hidden" />

        <div className="max-w-2xl mx-auto relative z-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 bg-white/10 backdrop-blur-md rounded-xl flex items-center justify-center border border-white/20 shadow-sm print:border-slate-300 print:bg-slate-100 print:shadow-none">
                <Globe className="w-6 h-6 text-white print:text-blue-600" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white tracking-tight print:text-slate-900">{companyName}</h1>
                <p className="text-blue-200 text-[10px] font-semibold uppercase tracking-wider print:text-slate-500">Müşteri Portalı</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <PrintButton />
            </div>
          </div>
          
          <div className="text-white print:text-slate-900">
            <p className="text-blue-200 text-sm font-medium mb-1.5 opacity-90 print:text-slate-500">Hoş Geldiniz,</p>
            <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">{customer.first_name} {customer.last_name}</h2>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 sm:px-6 -mt-10 space-y-6 print:mt-0 print:space-y-8">
        
        {activeApp ? (
          <>
            {/* Status Card */}
            <div className="bg-white dark:bg-[#0d1420] p-6 md:p-8 rounded-[32px] shadow-xl shadow-blue-900/5 border border-slate-100 dark:border-[#1f2937] relative overflow-hidden print:border-2 print:border-slate-200 print:shadow-none print:rounded-2xl">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
                <div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    {activeApp.country} Vizesi
                  </h3>
                  <p className="text-sm font-medium text-slate-500 mt-1">{activeApp.visa_type ? VISA_TYPE_LABELS[activeApp.visa_type] || activeApp.visa_type : 'Turist'} Başvurusu</p>
                </div>
                
                {/* Status Badge */}
                {isFinalState ? (
                  <div className={`px-5 py-2.5 rounded-2xl border ${
                    currentStatus === 'onaylandi' ? 'bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/20 text-emerald-600 dark:text-emerald-400' :
                    currentStatus === 'reddedildi' ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-600 dark:text-red-400' :
                    currentStatus === 'itiraz' ? 'bg-amber-50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/20 text-amber-600 dark:text-amber-400' :
                    'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                  } print:bg-transparent`}>
                    <span className="font-bold text-sm capitalize">{currentStatus === 'onaylandi' ? '✓ Onaylandı' : currentStatus === 'reddedildi' ? '✗ Reddedildi' : currentStatus}</span>
                  </div>
                ) : (
                  <div className="px-5 py-2.5 rounded-2xl border bg-blue-50 dark:bg-blue-500/10 border-blue-200 dark:border-blue-500/20 text-blue-600 dark:text-blue-400 print:bg-transparent">
                    <span className="font-bold text-sm capitalize flex items-center gap-1.5"><Clock className="w-4 h-4" /> Devam Ediyor</span>
                  </div>
                )}
              </div>

              {/* Timeline */}
              <div className="relative pt-2 pb-4">
                <div className="absolute top-[20px] left-[5%] right-[5%] h-1.5 bg-slate-100 dark:bg-[#1f2937] rounded-full z-0 print:bg-slate-200" />
                <div
                  className={`absolute top-[20px] left-[5%] h-1.5 rounded-full z-0 transition-all duration-1000 ${
                    currentStatus === 'reddedildi' ? 'bg-red-500' :
                    currentStatus === 'itiraz' ? 'bg-amber-500' :
                    currentStatus === 'kapandi' ? 'bg-slate-500' :
                    'bg-blue-500'
                  }`}
                  style={{ width: `${progress * 0.9}%` }}
                />
                
                <div className="relative z-10 flex justify-between px-[2%]">
                  {STATUS_STEPS.map((step, i) => {
                    const isDone = isFinalState || currentIndex > i;
                    const isCurrent = !isFinalState && currentIndex === i;
                    
                    return (
                      <div key={step.key} className="flex flex-col items-center gap-2.5 w-14">
                        <div className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-500 border-[3px] bg-white dark:bg-[#0d1420] ${
                          isDone ? "border-blue-500" :
                          isCurrent ? "border-blue-500 shadow-[0_0_0_4px_rgba(59,130,246,0.15)] print:shadow-none" :
                          "border-slate-200 dark:border-[#2d3f55]"
                        }`}>
                          {isDone ? (
                            <div className="w-full h-full rounded-full bg-blue-500 flex items-center justify-center print:bg-white print:border-2 print:border-blue-500">
                              <Check className="w-4 h-4 text-white print:text-blue-600" />
                            </div>
                          ) : isCurrent ? (
                            <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                          ) : (
                            <div className="w-1.5 h-1.5 rounded-full bg-slate-200 dark:bg-[#2d3f55] print:bg-slate-300" />
                          )}
                        </div>
                        <p className={`text-[10px] sm:text-xs font-semibold text-center leading-tight ${
                          isCurrent ? "text-blue-600 dark:text-blue-400" : 
                          isDone ? "text-slate-800 dark:text-slate-200" : "text-slate-400"
                        }`}>{step.short}</p>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Evrak Listesi */}
            <div className="bg-white dark:bg-[#0d1420] p-6 md:p-8 rounded-[32px] shadow-sm border border-slate-200 dark:border-[#1f2937] print:border-2 print:border-slate-200 print:shadow-none print:rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 flex items-center justify-center print:bg-transparent">
                    <FileText className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  Evrak Listesi
                </h2>
                <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-slate-100 dark:bg-slate-800 px-4 py-1.5 rounded-full whitespace-nowrap border border-slate-200 dark:border-slate-700 print:border-none print:bg-transparent print:p-0">
                  <span className="text-blue-600 dark:text-blue-400">{completedDocs}</span> / {totalDocs} Tamamlandı
                </span>
              </div>
              
              {totalDocs > 0 && (
                <div className="w-full h-2.5 bg-slate-100 dark:bg-[#1f2937] rounded-full overflow-hidden mb-8 print:border print:border-slate-200">
                  <div className="h-full bg-blue-500 rounded-full transition-all duration-1000 relative overflow-hidden" style={{ width: `${docProgress}%` }} />
                </div>
              )}

              {(!documents || documents.length === 0) ? (
                <div className="text-center py-8 bg-slate-50 dark:bg-[#1a2232] rounded-2xl border border-dashed border-slate-200 dark:border-[#2d3f55]">
                  <FileText className="w-8 h-8 text-slate-300 dark:text-slate-600 mx-auto mb-3" />
                  <p className="text-slate-500 font-medium text-sm">Evrak listeniz danışmanınız tarafından hazırlanıyor.</p>
                </div>
              ) : (
                <div className="space-y-3 print:space-y-2">
                  {documents.map(doc => (
                    <div key={doc.id} className={`flex items-start justify-between p-4 rounded-2xl border transition-all ${
                      doc.status === 'onaylandi'
                        ? 'bg-white dark:bg-[#0d1420] border-slate-100 dark:border-[#1f2937] opacity-75 print:opacity-100' 
                        : 'bg-amber-50/50 dark:bg-amber-500/5 border-amber-200 dark:border-amber-500/20'
                    } print:rounded-lg print:p-3`}>
                      <div className="flex-1 pr-4">
                        <p className={`font-bold text-sm ${doc.status === 'onaylandi' ? 'text-slate-700 dark:text-slate-300' : 'text-amber-900 dark:text-amber-400'}`}>
                          {doc.document_type}
                        </p>
                        {doc.description && <p className={`text-xs mt-1 font-medium ${doc.status === 'onaylandi' ? 'text-slate-400' : 'text-amber-700/70 dark:text-amber-400/70'}`}>{doc.description}</p>}
                      </div>
                      <div className="shrink-0 mt-0.5">
                        {doc.status === 'onaylandi' ? (
                          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 print:bg-transparent print:w-auto">
                            <CheckCircle2 className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400 bg-white dark:bg-[#0d1420] shadow-sm border border-amber-200 dark:border-amber-500/20 px-3 py-1.5 rounded-xl text-xs font-bold print:border-none print:shadow-none print:bg-transparent print:p-0">
                            <Clock className="w-4 h-4" /> Bekliyor
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4">
              {/* Randevu Bilgisi */}
              <div className="bg-white dark:bg-[#0d1420] p-6 md:p-8 rounded-[32px] shadow-sm border border-slate-200 dark:border-[#1f2937] h-full print:border-2 print:border-slate-200 print:shadow-none print:rounded-2xl">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-purple-50 dark:bg-purple-500/10 flex items-center justify-center print:bg-transparent">
                    <Calendar className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  Randevu
                </h2>
                {activeApp.appointment_date ? (
                  <div className="bg-gradient-to-br from-purple-500 to-indigo-600 p-6 rounded-3xl text-white shadow-xl shadow-purple-500/20 relative overflow-hidden print:bg-none print:shadow-none print:text-black print:border print:border-slate-200 print:rounded-xl">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl translate-x-1/3 -translate-y-1/3 print:hidden" />
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-purple-100 text-xs font-semibold uppercase tracking-wider print:text-slate-500">Tarih</p>
                        <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-2xl border border-white/20 flex flex-col items-center justify-center shadow-inner print:border-slate-300 print:bg-slate-50 print:shadow-none">
                          <span className="text-base font-extrabold leading-none">{new Date(activeApp.appointment_date).getDate()}</span>
                          <span className="text-[10px] uppercase font-bold tracking-wide">{new Date(activeApp.appointment_date).toLocaleString('tr-TR', { month: 'short' })}</span>
                        </div>
                      </div>
                      <h3 className="text-xl sm:text-2xl font-black mb-1">{new Date(activeApp.appointment_date).toLocaleString('tr-TR', { dateStyle: 'full', timeStyle: 'short' })}</h3>
                      <div className="flex items-start gap-2 text-purple-50 text-sm mt-4 pt-4 border-t border-white/20 font-medium print:border-slate-200 print:text-slate-600">
                        <MapPin className="w-4 h-4 shrink-0 mt-0.5" />
                        <span className="leading-snug">{activeApp.appointment_location || 'Lokasyon belirtilmedi'}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50 dark:bg-[#1a2232] rounded-3xl border border-dashed border-slate-200 dark:border-[#2d3f55] h-[calc(100%-60px)] flex flex-col items-center justify-center print:border-solid">
                    <Calendar className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 font-medium text-sm">Randevunuz henüz alınmadı.</p>
                  </div>
                )}
              </div>

              {/* Ödeme Durumu */}
              <div className="bg-white dark:bg-[#0d1420] p-6 md:p-8 rounded-[32px] shadow-sm border border-slate-200 dark:border-[#1f2937] h-full print:border-2 print:border-slate-200 print:shadow-none print:rounded-2xl">
                <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center print:bg-transparent">
                    <CreditCard className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  Ödeme
                </h2>
                
                {totalFee > 0 ? (
                  <div className="flex flex-col h-[calc(100%-60px)]">
                    <div className="flex justify-between items-end mb-3">
                      <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Toplam</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white mt-0.5">₺{totalFee.toLocaleString('tr-TR')}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kalan</p>
                        <p className="text-lg font-bold text-amber-500 mt-0.5">₺{remainingFee.toLocaleString('tr-TR')}</p>
                      </div>
                    </div>
                    
                    <div className="w-full h-2.5 bg-slate-100 dark:bg-[#1f2937] rounded-full overflow-hidden mb-6 print:border print:border-slate-200">
                      <div className="h-full bg-emerald-500 rounded-full transition-all duration-1000 relative" style={{ width: `${payProgress}%` }} />
                    </div>
                    
                    {payments && payments.length > 0 && (
                      <div className="mt-auto">
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-3">Son İşlemler</p>
                        <div className="space-y-2.5">
                          {payments.filter(p => p.status === 'alindi').slice(0, 3).map((p, i) => (
                            <div key={i} className="flex justify-between items-center py-2.5 px-3 bg-slate-50 dark:bg-[#1a2232] rounded-xl border border-slate-100 dark:border-[#2d3f55] print:border-none print:p-0 print:bg-transparent print:border-b print:rounded-none">
                              <div className="flex items-center gap-3">
                                <div className="w-7 h-7 rounded-full bg-white dark:bg-[#0d1420] flex items-center justify-center shadow-sm print:hidden">
                                  <Check className="w-3.5 h-3.5 text-emerald-500" />
                                </div>
                                <div>
                                  <p className="text-xs font-bold text-slate-900 dark:text-white">{p.method || 'Nakit/Transfer'}</p>
                                  <p className="text-[10px] font-medium text-slate-500">{new Date(p.created_at).toLocaleDateString('tr-TR')}</p>
                                </div>
                              </div>
                              <span className="font-bold text-sm text-emerald-600 dark:text-emerald-400">₺{Number(p.amount).toLocaleString('tr-TR')}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-10 bg-slate-50 dark:bg-[#1a2232] rounded-3xl border border-dashed border-slate-200 dark:border-[#2d3f55] h-[calc(100%-60px)] flex flex-col items-center justify-center print:border-solid">
                    <CreditCard className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-3" />
                    <p className="text-slate-500 font-medium text-sm">Ödeme kaydı bulunmuyor.</p>
                  </div>
                )}
              </div>
            </div>

            {applications && applications.length > 1 && (
              <div className="rounded-[32px] border border-slate-200 bg-white p-6 shadow-sm dark:border-[#1f2937] dark:bg-[#0d1420] md:p-8" data-testid="portal-application-history">
                <h2 className="mb-5 text-lg font-bold text-slate-900 dark:text-white">Başvuru Geçmişi</h2>
                <div className="divide-y divide-slate-200 dark:divide-[#1f2937]">
                  {applications.map(application => (
                    <div key={application.id} className="flex items-center justify-between gap-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{application.country} · {VISA_TYPE_LABELS[application.visa_type] || application.visa_type}</p>
                        <p className="mt-0.5 text-xs text-slate-500">{new Date(application.created_at).toLocaleDateString('tr-TR')}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-semibold text-slate-600 dark:bg-[#1a2232] dark:text-slate-300">
                        {isApplicationStatus(application.status) ? APPLICATION_STATUS_META[application.status].label : application.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </>
        ) : (
          <div className="bg-white dark:bg-[#0d1420] p-12 rounded-[32px] shadow-sm border border-slate-200 dark:border-[#1f2937] text-center">
            <div className="w-20 h-20 bg-slate-50 dark:bg-[#1a2232] rounded-full flex items-center justify-center mx-auto mb-5 border border-slate-100 dark:border-[#2d3f55]">
              <FileText className="w-8 h-8 text-slate-400" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-3">Başvuru Bulunamadı</h2>
            <p className="text-slate-500 max-w-md mx-auto leading-relaxed">Henüz adınıza oluşturulmuş aktif bir vize başvurusu bulunmamaktadır. İşlemlerinizin başlatılması için danışmanınız ile iletişime geçebilirsiniz.</p>
          </div>
        )}

        {/* Footer / İletişim */}
        <div className="bg-slate-900 dark:bg-[#0a101a] p-8 md:p-10 rounded-[32px] text-white text-center mt-12 shadow-2xl relative overflow-hidden border border-slate-800 print:bg-transparent print:border-t print:border-slate-200 print:text-black print:rounded-none print:shadow-none print:p-4">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4 pointer-events-none print:hidden" />
          <div className="relative z-10">
            <Globe className="w-10 h-10 text-blue-400 mx-auto mb-5 opacity-75 print:hidden" />
            <h3 className="text-xl font-bold mb-3 tracking-tight print:hidden">Sorularınız için buradayız</h3>
            <p className="text-slate-400 text-sm font-medium mb-8 max-w-sm mx-auto leading-relaxed print:hidden">Vize sürecinizle ilgili aklınıza takılan her şey için bize doğrudan ulaşabilirsiniz.</p>
            
            <div className="flex flex-col sm:flex-row justify-center gap-4 max-w-md mx-auto print:hidden">
              {companyPhone && <a href={`tel:${companyPhone}`} className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-2xl transition-all text-sm font-bold w-full backdrop-blur-md">
                <Phone className="w-4 h-4 text-blue-400" /> Bizi Arayın
              </a>}
              {companyPhone && <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2.5 px-6 py-3.5 bg-[#25D366]/10 hover:bg-[#25D366]/20 border border-[#25D366]/20 text-[#25D366] rounded-2xl transition-all text-sm font-bold w-full backdrop-blur-md">
                <MessageCircle className="w-4 h-4" /> WhatsApp
              </a>}
            </div>

            <div className="mt-8 pt-8 border-t border-slate-800 print:border-none print:mt-0 print:pt-0 flex flex-col gap-2">
              <p className="text-xs text-slate-500 font-medium">Bu bilgiler {companyName} CRM tarafından sağlanmaktadır.</p>
              <div className="flex items-center justify-center gap-4 text-xs text-slate-400 print:text-slate-600">
                {companyEmail && <span className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {companyEmail}</span>}
                {companyPhone && <span className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {companyPhone}</span>}
              </div>
              <p className="text-[10px] text-slate-600 mt-2">&copy; {new Date().getFullYear()} {companyName}. Tüm hakları saklıdır.</p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
