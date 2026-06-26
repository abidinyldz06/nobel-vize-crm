import ImportCustomers from "@/components/ImportCustomers";
import { UploadCloud } from "lucide-react";

export const metadata = {
  title: 'Toplu Müşteri Aktarma | Nobel Vize CRM',
};

export default function ImportPage() {
  return (
    <div className="p-6 min-h-screen bg-slate-50 dark:bg-[#060d1a]">
      <div className="max-w-4xl mx-auto mb-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
          <UploadCloud className="w-6 h-6 text-blue-500" />
          Toplu Müşteri İçe Aktarma
        </h1>
        <p className="text-slate-500 mt-2">
          Excel (.xlsx) veya CSV dosyalarınızı kullanarak tek seferde onlarca müşteriyi sisteme kaydedebilir, profillerini güncelleyebilir ve vize başvurularını otomatik başlatabilirsiniz.
        </p>
      </div>

      <ImportCustomers />
    </div>
  );
}
