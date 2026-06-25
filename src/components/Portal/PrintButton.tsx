"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 dark:bg-[#1a2232] dark:hover:bg-[#2d3f55] text-slate-700 dark:text-slate-300 text-sm font-bold rounded-xl transition-colors print:hidden"
    >
      <Printer className="w-4 h-4" />
      <span>Yazdır / PDF Kaydet</span>
    </button>
  );
}
