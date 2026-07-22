import { createSupabaseServerClient } from "@/lib/supabase-server";
import { updateCustomer } from "@/app/actions/update-customer";
import { Edit2, Save, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { VISA_TYPE_LABELS } from "@/lib/visa-types";
import {
  ACCOMMODATION_OPTIONS,
  NATIONALITY_OPTIONS,
  OCCUPATION_OPTIONS,
  TRAVEL_METHOD_OPTIONS,
} from "@/lib/application-profile";
import {
  APPLICATION_STATUS_META,
  APPLICATION_TRANSITIONS,
  isApplicationStatus,
} from "@/lib/application-status";

export const revalidate = 0;

export default async function EditCustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createSupabaseServerClient();
  const [{ data: customer }, { data: staffList }, { data: activeApp }, { data: countries }, { data: tags }, { data: customerTags }] = await Promise.all([
    supabase.from('customers').select('*').eq('id', id).eq('is_deleted', false).single(),
    supabase.from('staff').select('id, full_name, role').eq('is_active', true).order('full_name'),
    supabase.from('applications').select('*').eq('customer_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('countries').select('id, name').eq('active', true).order('name'),
    supabase.from('tags').select('id, name, color').order('name'),
    supabase.from('customer_tags').select('tag_id').eq('customer_id', id),
  ]);

  if (!customer) return <div className="p-6 text-slate-500 dark:text-slate-400">Müşteri bulunamadı.</div>;
  if (!activeApp) return <div className="p-6 text-slate-500 dark:text-slate-400">Bu müşteriye ait düzenlenebilir bir başvuru bulunamadı.</div>;

  const currentStatus = isApplicationStatus(activeApp.status) ? activeApp.status : 'profil_analizi';
  const availableStatuses = [currentStatus, ...APPLICATION_TRANSITIONS[currentStatus]];
  const selectedTagIds = new Set((customerTags ?? []).map(item => item.tag_id));

  return (
    <div className="min-h-screen bg-white dark:bg-[#060d1a] p-6">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-4 mb-7">
          <Link href={`/customers/${id}`} className="p-2 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-xl hover:bg-slate-100 dark:bg-[#1a2232] transition-colors text-slate-500 dark:text-slate-400">
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Edit2 className="w-5 h-5 text-blue-400" /> Müşteri Düzenle
            </h1>
            <p className="text-slate-500 text-xs mt-0.5">{customer.first_name} {customer.last_name} bilgilerini düzenleyin.</p>
          </div>
        </div>

        <form action={updateCustomer} className="space-y-5">
          <input type="hidden" name="id" value={customer.id} />
          <input type="hidden" name="applicationId" value={activeApp.id} />

          {/* Kişisel Bilgiler */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Kişisel Bilgiler</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ad</label>
                <input required name="firstName" type="text" defaultValue={customer.first_name}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Soyad</label>
                <input required name="lastName" type="text" defaultValue={customer.last_name}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Telefon</label>
                <input required name="phone" type="tel" defaultValue={customer.phone || ''}
                  pattern="0[0-9]{10}" maxLength={11}
                  title="Telefon 0 ile başlamalı ve 11 haneli olmalı (örn: 05551234567)"
                  placeholder="0XXXXXXXXXX"
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">E-posta</label>
                <input name="email" type="email" defaultValue={customer.email || ''}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
            </div>
          </div>

          {/* Başvuru Bilgileri */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Başvuru Bilgileri</h2>
              <p className="mt-1 text-[10px] text-slate-500">Yalnız izin verilen sonraki durumlar gösterilir; ret seçiminde açıklama zorunludur.</p>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ülke</label>
                <select required aria-label="Ülke" name="countryId" defaultValue={activeApp.country_id || ''} className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="">— Ülke Seçin —</option>
                  {countries?.map(country => <option key={country.id} value={country.id}>{country.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Vize Türü</label>
                <select required aria-label="Vize Türü" name="visaType" defaultValue={activeApp.visa_type} className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                  {Object.entries(VISA_TYPE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Başvuru Durumu</label>
                <select required aria-label="Başvuru Durumu" name="applicationStatus" defaultValue={currentStatus} className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                  {availableStatuses.map(status => <option key={status} value={status}>{APPLICATION_STATUS_META[status].label}</option>)}
                </select>
              </div>
              {availableStatuses.includes('reddedildi') && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Ret Sebebi</label>
                  <input name="rejectionReason" type="text" maxLength={2000} defaultValue={activeApp.rejection_reason || ''} placeholder="Reddedildi seçilirse zorunlu" className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-red-500" />
                </div>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Seyahat Aracı</label>
                <select aria-label="Seyahat Aracı" name="travelMethod" defaultValue={activeApp.travel_method || ''} className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="">— Belirtilmedi —</option>
                  {Object.entries(TRAVEL_METHOD_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Konaklama</label>
                <select aria-label="Konaklama" name="accommodation" defaultValue={activeApp.accommodation || ''} className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="">— Belirtilmedi —</option>
                  {Object.entries(ACCOMMODATION_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Meslek</label>
                <select aria-label="Meslek" name="occupation" defaultValue={activeApp.occupation || ''} className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="">— Belirtilmedi —</option>
                  {Object.entries(OCCUPATION_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Çocuk Durumu</label>
                <select aria-label="Çocuk Durumu" name="withChildren" defaultValue={activeApp.with_children === null ? '' : String(activeApp.with_children)} className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="">— Belirtilmedi —</option>
                  <option value="false">Yok</option>
                  <option value="true">Var</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Uyruk</label>
                <select aria-label="Uyruk" name="nationality" defaultValue={activeApp.nationality || ''} className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500">
                  <option value="">— Belirtilmedi —</option>
                  {Object.entries(NATIONALITY_OPTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Müşteri Etiketleri */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Müşteri Etiketleri</h2>
            </div>
            <div className="flex flex-wrap gap-3 px-6 py-5">
              {tags?.map(tag => (
                <label key={tag.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm dark:border-[#1f2937]">
                  <input type="checkbox" name="tagIds" value={tag.id} defaultChecked={selectedTagIds.has(tag.id)} className="h-4 w-4 rounded" />
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: tag.color }} />
                  <span className="font-medium text-slate-700 dark:text-slate-200">{tag.name}</span>
                </label>
              ))}
              {(!tags || tags.length === 0) && <p className="text-sm text-slate-500">Tanımlı etiket bulunamadı.</p>}
            </div>
          </div>

          {/* Finansal Bilgiler */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Finansal & Profil Bilgileri</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Finansal Durum</label>
                <select name="financialStatus" defaultValue={customer.financial_status || 'orta'}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all appearance-none">
                  <option value="dusuk">Düşük</option>
                  <option value="orta">Orta</option>
                  <option value="iyi">İyi</option>
                  <option value="yuksek">Yüksek</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Aylık Gelir (₺)</label>
                <input name="monthlyIncome" type="number" min="0" step="1000" defaultValue={customer.monthly_income || ''}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                  placeholder="Örn: 30000" />
              </div>
            </div>
          </div>

          {/* Pasaport Bilgileri */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pasaport Bilgileri</h2>
            </div>
            <div className="px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Pasaport No</label>
                <input name="passportNo" type="text" defaultValue={customer.passport_no || ''}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all uppercase"
                  placeholder="Örnek: U1234567" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Bitiş Tarihi</label>
                <input name="passportExpiry" type="date" defaultValue={customer.passport_expiry || ''}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Verildiği Ülke</label>
                <input name="passportIssuingCountry" type="text" defaultValue={customer.passport_issuing_country || 'Türkiye'}
                  className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all" />
              </div>
            </div>
          </div>

          {/* Danışman Ataması */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Danışman Ataması</h2>
            </div>
            <div className="px-6 py-5">
              <select name="assignedStaffId" defaultValue={customer.assigned_staff_id || ''}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 focus:outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer">
                <option value="">— Danışman Seçin —</option>
                {staffList?.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.full_name} {s.role === 'admin' ? '(Yönetici)' : '(Danışman)'}
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-slate-600 mt-1.5">Seçilen danışman bu müşterinin sorumlusu olur.</p>
            </div>
          </div>

          {/* Danışman Notu */}
          <div className="bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] rounded-2xl overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-200 dark:border-[#1f2937] bg-slate-50 dark:bg-[#0a101a]">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Danışman Notu</h2>
            </div>
            <div className="px-6 py-5">
              <textarea name="notes" rows={3} defaultValue={customer.notes || ''}
                className="w-full px-4 py-2.5 bg-white dark:bg-[#060d1a] border border-slate-200 dark:border-[#1f2937] rounded-xl text-sm text-slate-900 dark:text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-blue-500 transition-all resize-none"
                placeholder="Müşteri hakkında not..." />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Link href={`/customers/${id}`} className="px-5 py-2.5 bg-white dark:bg-[#0d1420] border border-slate-200 dark:border-[#1f2937] text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:text-slate-200 text-sm font-medium rounded-xl transition-colors">
              İptal
            </Link>
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-slate-900 dark:text-white text-sm font-semibold rounded-xl transition-all shadow-lg shadow-blue-900/30">
              <Save className="w-4 h-4" />
              Değişiklikleri Kaydet
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
