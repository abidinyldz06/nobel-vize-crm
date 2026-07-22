import { Edit, AlertCircle } from "lucide-react";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase-server";
import StatusTimeline from "@/components/StatusTimeline";
import StatusUpdater from "@/components/StatusUpdater";
import DocumentItem from "@/components/DocumentItem";
import NotesPanel from "@/components/NotesPanel";
import PaymentsPanel from "@/components/PaymentsPanel";
import CustomerTimeline from "@/components/CustomerTimeline";
import CommunicationPanel from "@/components/CommunicationPanel";
import VisaHistoryPanel from "@/components/VisaHistoryPanel";
import ProfileAnalysisButton from "@/components/ProfileAnalysisButton";
import PdfExportButton from "@/components/PdfExportButton";
import FamilyMembersPanel from "@/components/FamilyMembersPanel";
import { VISA_TYPE_LABELS, DOCUMENT_CATEGORIES } from "@/lib/visa-types";
import MessageComposer from "@/components/MessageComposer";
import CustomerActionMenu from "@/components/CustomerActionMenu";
import PortalShareButton from "@/components/PortalShareButton";
import CustomerPrivacyPanel from "@/components/CustomerPrivacyPanel";
import SensitiveValue from "@/components/SensitiveValue";
import {
  ACCOMMODATION_OPTIONS,
  NATIONALITY_OPTIONS,
  OCCUPATION_OPTIONS,
  TRAVEL_METHOD_OPTIONS,
  optionLabel,
} from "@/lib/application-profile";

export const revalidate = 0;

export default async function CustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();

  const { data: { user } } = await supabase.auth.getUser();
  const { data: staffRecord } = await supabase.from('staff').select('id, role').eq('user_id', user?.id ?? '').single();
  const isAdmin = staffRecord?.role === 'admin';
  const staffId = staffRecord?.id;

  const { data: customer } = await supabase.from('customers').select('*').eq('id', id).eq('is_deleted', false).single();
  if (!customer) return <div className="p-6 text-slate-500 dark:text-slate-400">Müşteri bulunamadı.</div>;

  if (!isAdmin && staffId && customer.assigned_staff_id !== staffId) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center bg-white dark:bg-[#060d1a]">
        <div className="p-6 bg-red-500/10 border border-red-500/20 rounded-2xl text-center max-w-sm">
          <AlertCircle className="w-10 h-10 text-red-500 mx-auto mb-3" />
          <h2 className="text-red-500 font-bold text-lg mb-1">Erişim Engellendi</h2>
          <p className="text-red-400 text-sm">Bu müşteri size atanmamış.</p>
        </div>
      </div>
    );
  }

  const { data: applications } = await supabase
    .from('applications')
    .select('*')
    .eq('customer_id', id)
    .order('created_at', { ascending: false });

  const activeApp = applications?.[0];

  const [{ data: messageTemplates }, { data: company }, { data: privacyNotices }, { data: privacyDeliveries }, { data: customerConsents }, { data: dataRequests }] = await Promise.all([
    supabase.from('message_templates').select('*').eq('is_active', true).order('channel').order('name'),
    supabase.from('tenants').select('company_name').single(),
    supabase.from('privacy_notice_versions').select('*').order('effective_at', { ascending: false }),
    supabase.from('customer_privacy_notices').select('*').eq('customer_id', id).order('delivered_at', { ascending: false }),
    supabase.from('customer_consents').select('*').eq('customer_id', id).order('decision_at', { ascending: false }).order('created_at', { ascending: false }),
    supabase.from('data_subject_requests').select('*').eq('customer_id', id).order('requested_at', { ascending: false }),
  ]);

  let documents = null;
  let notes = null;
  let payments = null;
  let activityLogs = null;
  let communications = null;
  let visaHistory = null;
  let familyMembers = null;

  if (activeApp) {
    const [
      { data: docs },
      { data: notesData },
      { data: paymentsData },
      { data: logsData },
      { data: commsData },
      { data: visaData },
      { data: familyData },
    ] = await Promise.all([
      supabase.from('documents').select('*').eq('application_id', activeApp.id).order('created_at', { ascending: true }),
      supabase.from('notes').select('*').eq('application_id', activeApp.id).order('created_at', { ascending: false }),
      supabase.from('payments').select('*').eq('application_id', activeApp.id).order('created_at', { ascending: false }),
      supabase.from('activity_log').select('*').eq('application_id', activeApp.id).order('created_at', { ascending: false }).limit(30),
      supabase.from('communications').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('visa_history').select('*').eq('customer_id', id).order('created_at', { ascending: false }),
      supabase.from('family_members').select('*').eq('customer_id', id).order('created_at', { ascending: true }),
    ]);
    documents = docs;
    notes = notesData;
    payments = paymentsData;
    activityLogs = logsData;
    communications = commsData;
    visaHistory = visaData;
    familyMembers = familyData;
  }

  const completedDocs = documents?.filter(d => d.status === 'onaylandi').length || 0;
  const totalDocs = documents?.length || 0;
  const fee = activeApp?.total_fee || 0;

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6 font-sans print:p-0 print:bg-white">
      {/* Top Header */}
      <div className="flex items-center gap-4 mb-6 print:hidden">
        <h1 className="text-xl font-bold text-slate-900 dark:text-white">
          Müşteri:{" "}
          <span className="font-normal text-slate-700 dark:text-slate-300">
            {customer.first_name} {customer.last_name}
            {activeApp?.country ? ` / ${activeApp.country} Vizesi` : ""}
          </span>
        </h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* LEFT COLUMN */}
        <div className="lg:col-span-4 space-y-5">

          {/* Profile Card */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-5 shadow-lg">
            <div className="flex justify-between items-start mb-5">
              <h2 className="text-slate-900 dark:text-white font-semibold text-sm">Müşteri Profili</h2>
              <div className="flex items-center gap-2 print:hidden flex-wrap justify-end">
                <PortalShareButton customer={{
                  id: customer.id,
                  first_name: customer.first_name,
                  last_name: customer.last_name,
                  phone: customer.phone,
                  portal_token: customer.portal_token,
                  portal_token_expires_at: customer.portal_token_expires_at,
                  portal_access_enabled: customer.portal_access_enabled,
                }} />
                <PdfExportButton />
                <ProfileAnalysisButton customerId={customer.id} currentScore={customer.profile_score || 0} />
                <Link
                  href={`/customers/${customer.id}/edit`}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-xs font-semibold rounded-lg transition-all shrink-0"
                >
                  <Edit className="w-3.5 h-3.5" /> Düzenle
                </Link>
              </div>
            </div>

            <div className="flex items-center gap-4 mb-5">
              <div className="w-14 h-14 rounded-full bg-blue-600 flex items-center justify-center text-xl font-bold text-slate-900 dark:text-white shadow-lg shadow-blue-900/50 uppercase shrink-0">
                {customer.first_name?.[0]}{customer.last_name?.[0]}
              </div>
              <div>
                <h3 className="text-slate-900 dark:text-white font-bold text-base leading-tight">
                  {customer.first_name} {customer.last_name}
                </h3>
                {activeApp && (
                  <p className="text-slate-500 dark:text-slate-400 text-xs mt-0.5">
                    #{activeApp.id.split('-')[0].toUpperCase()} · {activeApp.country}
                  </p>
                )}
                {/* Profile Score */}
                {customer.profile_score && (
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="w-16 h-1.5 bg-slate-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${customer.profile_score >= 80 ? 'bg-emerald-500' : customer.profile_score >= 50 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${customer.profile_score}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-slate-500 dark:text-slate-400">{customer.profile_score}/100</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2 text-sm border-t border-slate-200 dark:border-[#1f2937] pt-4">
              {[
                { label: "Telefon", value: customer.phone ? <SensitiveValue value={customer.phone} kind="phone" /> : null },
                { label: "E-posta", value: customer.email ? <SensitiveValue value={customer.email} kind="email" /> : null },
                { label: "Pasaport", value: customer.passport_no ? <SensitiveValue value={customer.passport_no} kind="passport" /> : null },
                { label: "Geçerlilik", value: customer.passport_expiry ? new Date(customer.passport_expiry).toLocaleDateString('tr-TR') : null },
                { label: "Kayıt", value: new Date(customer.created_at).toLocaleDateString('tr-TR') },
                { label: "Finansal", value: customer.financial_status ? { dusuk: "Düşük", orta: "Orta", iyi: "İyi", yuksek: "Yüksek" }[customer.financial_status as string] || customer.financial_status : null },
              ].map(({ label, value }) => value ? (
                <div key={label} className="flex gap-2">
                  <span className="text-slate-500 w-20 shrink-0">{label}:</span>
                  <span className="text-slate-700 dark:text-slate-300 truncate">{value}</span>
                </div>
              ) : null)}
            </div>

            {/* Passport Warning */}
            {customer.passport_expiry && new Date(customer.passport_expiry) < new Date(new Date().setMonth(new Date().getMonth() + 6)) && (
              <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs">
                <p className="text-red-500 font-semibold flex items-center gap-1.5"><AlertCircle className="w-4 h-4" /> Pasaport Süresi Kritik!</p>
                <p className="text-red-400 mt-0.5">Pasaport bitiş tarihine 6 aydan az kalmış. Başvuru reddedilebilir.</p>
              </div>
            )}

            {/* Randevu bilgisi */}
            {activeApp?.appointment_date ? (
              <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20 text-xs">
                <p className="text-blue-400 font-semibold">Randevu</p>
                <p className="text-slate-700 dark:text-slate-300 mt-0.5">
                  {new Date(activeApp.appointment_date).toLocaleString('tr-TR')}
                  {activeApp.appointment_location && ` · ${activeApp.appointment_location}`}
                </p>
              </div>
            ) : (
              <Link
                href={`/customers/${customer.id}/appointment`}
                className="mt-4 flex items-center justify-center gap-2 w-full py-2 bg-slate-200 dark:bg-[#1f2937] hover:bg-[#2d3f55] text-slate-700 dark:text-slate-300 text-xs font-semibold rounded-xl transition-colors"
              >
                + Randevu Ekle
              </Link>
            )}
          </div>

          {/* Unified activity timeline */}
          {activeApp && (
            <CustomerTimeline
              logs={activityLogs ?? []}
              notes={notes ?? []}
              documents={documents ?? []}
              payments={payments ?? []}
              communications={communications ?? []}
            />
          )}

          {/* Notes */}
          {activeApp && <NotesPanel applicationId={activeApp.id} initialNotes={notes ?? []} />}

          {/* Communications */}
          {activeApp && <CommunicationPanel customerId={customer.id} applicationId={activeApp.id} initialComms={communications ?? []} />}

          <CustomerPrivacyPanel
            customerId={customer.id}
            notices={privacyNotices ?? []}
            deliveries={privacyDeliveries ?? []}
            consents={customerConsents ?? []}
            requests={dataRequests ?? []}
            isAdmin={isAdmin}
          />

          {/* Visa History */}
          <VisaHistoryPanel customerId={customer.id} initialHistory={visaHistory ?? []} />

          {/* Family Members */}
          <FamilyMembersPanel customerId={customer.id} initialMembers={familyMembers ?? []} />
        </div>

        {/* RIGHT COLUMN */}
        <div className="lg:col-span-8 space-y-5">

          {/* Application Details */}
          {activeApp && (
            <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
              <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
                <h2 className="text-slate-900 dark:text-white font-semibold">Başvuru Bilgileri</h2>
              </div>
              <dl className="grid grid-cols-1 gap-x-6 gap-y-4 px-6 py-5 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  { label: 'Ülke', value: activeApp.country },
                  { label: 'Vize Türü', value: VISA_TYPE_LABELS[activeApp.visa_type] || activeApp.visa_type },
                  { label: 'Seyahat Aracı', value: optionLabel(TRAVEL_METHOD_OPTIONS, activeApp.travel_method) },
                  { label: 'Konaklama', value: optionLabel(ACCOMMODATION_OPTIONS, activeApp.accommodation) },
                  { label: 'Meslek', value: optionLabel(OCCUPATION_OPTIONS, activeApp.occupation) },
                  { label: 'Çocuk', value: activeApp.with_children === null ? 'Belirtilmedi' : activeApp.with_children ? 'Var' : 'Yok' },
                  { label: 'Uyruk', value: optionLabel(NATIONALITY_OPTIONS, activeApp.nationality) },
                ].map(item => (
                  <div key={item.label}>
                    <dt className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.label}</dt>
                    <dd className="mt-1 text-sm font-medium text-slate-800 dark:text-slate-200">{item.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}

          {/* Timeline */}
          {activeApp && (
            <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl p-6 shadow-lg">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-slate-900 dark:text-white font-semibold">Başvuru Akışı</h2>
                  <p className="text-slate-500 text-xs">{activeApp.country} · {activeApp.visa_type ? VISA_TYPE_LABELS[activeApp.visa_type] || activeApp.visa_type : 'Turist'} Vizesi</p>
                </div>
                <CustomerActionMenu 
                  customerId={customer.id} 
                  isAdmin={isAdmin} 
                  currentStaffId={customer.assigned_staff_id ?? undefined}
                />
              </div>
              <div className="mb-4 flex justify-end">
                <StatusUpdater applicationId={activeApp.id} currentStatus={activeApp.status || 'profil_analizi'} />
              </div>
              <StatusTimeline currentStatus={activeApp.status || 'profil_analizi'} />
            </div>
          )}

          {/* Documents + Payments */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* Documents */}
            <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl shadow-lg flex flex-col">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a] rounded-t-2xl flex justify-between items-center">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Evrak Listesi</h3>
                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-slate-200 dark:bg-[#1f2937] text-slate-500 dark:text-slate-400">
                  {completedDocs}/{totalDocs}
                </span>
              </div>
              {totalDocs > 0 && (
                <div className="px-5 pt-3">
                  <div className="w-full h-1 bg-slate-200 dark:bg-[#1f2937] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500 rounded-full transition-all duration-500"
                      style={{ width: `${totalDocs > 0 ? (completedDocs / totalDocs) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              )}
              <div className="p-0 flex-1 overflow-y-auto max-h-96">
                {(!documents || documents.length === 0) ? (
                  <p className="text-center text-slate-600 text-xs py-6">Evrak listesi boş.</p>
                ) : (
                  <div className="space-y-4 p-3">
                    {Object.keys(DOCUMENT_CATEGORIES).map(catKey => {
                      const catDocs = documents.filter((document) => (document.category || 'diger') === catKey);
                      if (catDocs.length === 0) return null;
                      return (
                        <div key={catKey} className="bg-slate-50 dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl overflow-hidden">
                          <div className="px-3 py-2 bg-slate-100 dark:bg-[#1a2232] border-b border-slate-200 dark:border-[#1f2937]">
                            <h4 className="text-[11px] font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider">{DOCUMENT_CATEGORIES[catKey]}</h4>
                          </div>
                          <div className="divide-y divide-slate-100 dark:divide-[#1f2937]">
                            {catDocs.map((doc) => (
                              <DocumentItem key={doc.id} doc={doc} />
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Yönetilebilir WhatsApp / e-posta mesaj şablonları */}
              {activeApp && company && (
                <div className="px-4 py-3 border-t border-slate-200 dark:border-[#1f2937] flex flex-wrap gap-2">
                  <MessageComposer customer={customer} application={activeApp} documents={documents || []} payments={payments || []} templates={messageTemplates ?? []} company={company} />
                </div>
              )}
            </div>

            {/* Payments */}
            {activeApp && (
              <PaymentsPanel
                applicationId={activeApp.id}
                totalFee={fee}
                consulateFee={activeApp.consulate_fee || 0}
                serviceFee={activeApp.service_fee || 0}
                initialPayments={payments ?? []}
              />
            )}
          </div>

          {/* All Applications — if multiple */}
          {applications && applications.length > 1 && (
            <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden shadow-lg">
              <div className="px-5 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Tüm Başvurular</h3>
              </div>
              <div className="divide-y divide-slate-200 dark:divide-[#1f2937]">
                {applications.map((app) => (
                  <div key={app.id} className={`flex items-center justify-between px-5 py-3 ${app.id === activeApp?.id ? 'bg-blue-600/5' : ''}`}>
                    <div>
                      <p className="text-sm font-medium text-slate-900 dark:text-slate-200">{app.country}</p>
                      <p className="text-xs text-slate-500">{new Date(app.created_at).toLocaleDateString('tr-TR')}</p>
                    </div>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${app.id === activeApp?.id ? 'bg-blue-500/10 text-blue-400' : 'bg-slate-200 dark:bg-[#1f2937] text-slate-500 dark:text-slate-400'}`}>
                      {app.id === activeApp?.id ? 'Aktif' : app.status}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
