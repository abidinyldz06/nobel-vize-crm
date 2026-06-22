"use client"
import { useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";
import { Check, MoreHorizontal, UploadCloud, File, Trash2, Loader2 } from "lucide-react";

export default function DocumentItem({ doc }: { doc: any }) {
  const [status, setStatus] = useState(doc.status);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const supabase = createSupabaseBrowserClient();
  const router = useRouter();

  const toggleStatus = async () => {
    setLoading(true);
    const newStatus = status === 'tamamlandi' ? 'bekleniyor' : 'tamamlandi';
    const { error } = await supabase
      .from('documents')
      .update({ status: newStatus })
      .eq('id', doc.id);

    if (!error) {
      setStatus(newStatus);
      
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("activity_log").insert([{
        application_id: doc.application_id,
        action: `Evrak güncellendi: "${doc.document_type}" -> ${newStatus === 'tamamlandi' ? 'Tamamlandı' : 'Bekliyor'}`,
        performed_by: user?.email || "Danışman"
      }]);

      // Profil skorunu otomatik güncelle — tamamlanan evrak sayısına göre
      if (doc.application_id) {
        const { data: allDocs } = await supabase
          .from('documents')
          .select('id, status')
          .eq('application_id', doc.application_id);

        if (allDocs) {
          const total = allDocs.length;
          const completed = allDocs.filter(d => d.id === doc.id ? newStatus === 'tamamlandi' : d.status === 'tamamlandi').length;
          const docProgress = total > 0 ? Math.round((completed / total) * 40) : 0; // evraklar max 40 puan

          // customer_id al
          const { data: app } = await supabase
            .from('applications')
            .select('customer_id')
            .eq('id', doc.application_id)
            .single();

          if (app) {
            // Mevcut base skoru al
            const { data: customer } = await supabase
              .from('customers')
              .select('profile_score, email, phone, financial_status')
              .eq('id', app.customer_id)
              .single();

            if (customer) {
              let base = 30;
              if (customer.email) base += 10;
              if (customer.phone) base += 10;
              if (customer.financial_status === 'iyi') base += 10;
              if (customer.financial_status === 'yuksek') base += 15;
              const newScore = Math.min(100, base + docProgress);

              await supabase
                .from('customers')
                .update({ profile_score: newScore })
                .eq('id', app.customer_id);
            }
          }
        }

      }

      router.refresh();
    }
    setLoading(false);
  };

  const isCompleted = status === 'tamamlandi';

  let overdueStatus = null;
  let overdueDays = 0;
  if (!isCompleted && doc.requested_at) {
    const requested = new Date(doc.requested_at);
    const now = new Date();
    overdueDays = Math.floor((now.getTime() - requested.getTime()) / (1000 * 60 * 60 * 24));
    
    if (overdueDays >= 7) {
      overdueStatus = 'critical';
    } else if (overdueDays >= 3) {
      overdueStatus = 'warning';
    }
  }

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${doc.id}-${Math.random()}.${fileExt}`;
    const filePath = `docs/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error(uploadError);
      alert('Dosya yüklenemedi: ' + uploadError.message);
      setUploading(false);
      return;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    await supabase
      .from('documents')
      .update({ file_url: publicUrl })
      .eq('id', doc.id);

    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("activity_log").insert([{
      application_id: doc.application_id,
      action: `Evrak dosyası yüklendi: "${doc.document_type}"`,
      performed_by: user?.email || "Danışman"
    }]);

    setUploading(false);
    router.refresh();
  };

  const handleDeleteFile = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Dosyayı silmek istediğinize emin misiniz?")) return;

    setUploading(true);
    // Remove file_url from db
    await supabase.from('documents').update({ file_url: null }).eq('id', doc.id);
    
    // (Optional: delete from storage using url extraction)
    
    setUploading(false);
    router.refresh();
  };

  return (
    <div className={`flex items-center justify-between p-3 mb-2 rounded-xl transition-colors cursor-pointer group ${
      isCompleted ? 'bg-slate-50 dark:bg-[#0a101a] border border-slate-200 dark:border-[#1f2937]' : 'bg-white dark:bg-[#0d1420] hover:bg-slate-100 dark:bg-[#1a2232] border border-slate-200 dark:border-[#1f2937]'
    }`} onClick={toggleStatus}>
      
      <div className="flex items-center gap-3">
        {/* Custom Checkbox */}
        <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${
          isCompleted ? 'bg-blue-600 border-blue-600 shadow-[0_0_8px_rgba(59,130,246,0.6)]' : 'bg-transparent border-[#4b5563]'
        }`}>
          {isCompleted && <Check className="w-3 h-3 text-slate-900 dark:text-white" />}
        </div>
        
        <span className={`text-sm ${isCompleted ? 'text-slate-700 dark:text-slate-300 line-through' : 'text-slate-500 dark:text-slate-400'}`}>
          {doc.document_type}
        </span>
      </div>

      <div className="flex items-center gap-4">
        {loading ? (
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-800 text-slate-500 dark:text-slate-400 animate-pulse">Kaydediliyor...</span>
        ) : (
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full uppercase tracking-wider ${
            isCompleted ? 'bg-emerald-500/10 text-emerald-400' : 
            status === 'eksik' ? 'bg-red-500/10 text-red-400' :
            'bg-amber-500/10 text-amber-500'
          }`}>
            {isCompleted ? 'Tamamlandı' : status === 'eksik' ? 'Eksik' : 'Bekleniyor'}
          </span>
        )}
        
        {!isCompleted && overdueStatus && (
          <div className="flex items-center">
            {overdueStatus === 'critical' ? (
               <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-red-600 text-white shadow-sm flex items-center gap-1">
                 ⚠️ {overdueDays} Gün Gecikti
               </span>
            ) : (
               <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-md bg-amber-500 text-white shadow-sm flex items-center gap-1">
                 ⏳ {overdueDays} Gün Oldu
               </span>
            )}
          </div>
        )}
        
        {/* Dosya Linki veya Yükleme Butonu */}
        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
          {doc.file_url ? (
            <div className="flex items-center gap-1">
              <a href={doc.file_url} target="_blank" rel="noopener noreferrer" className="p-1 text-blue-500 hover:text-blue-600 bg-blue-500/10 rounded-md" title="Dosyayı Görüntüle">
                <File className="w-4 h-4" />
              </a>
              <button onClick={handleDeleteFile} disabled={uploading} className="p-1 text-red-500 hover:text-red-600 bg-red-500/10 rounded-md disabled:opacity-50" title="Dosyayı Sil">
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              </button>
            </div>
          ) : (
            <label className="p-1.5 text-slate-500 hover:text-indigo-500 bg-slate-100 dark:bg-slate-800 hover:bg-indigo-50 dark:hover:bg-indigo-500/20 rounded-lg cursor-pointer transition-colors" title="Dosya Yükle">
              {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <UploadCloud className="w-4 h-4" />}
              <input type="file" className="hidden" onChange={handleUpload} accept=".pdf,.jpg,.jpeg,.png" disabled={uploading} />
            </label>
          )}
        </div>
      </div>
      
    </div>
  );
}
