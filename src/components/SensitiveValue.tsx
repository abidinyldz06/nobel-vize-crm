"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { maskSensitive } from "@/lib/masking";

export default function SensitiveValue({ value, kind }: { value: string; kind: "phone" | "email" | "passport" }) {
  const [visible, setVisible] = useState(false);
  return <span className="inline-flex items-center gap-1.5"><span>{visible ? value : maskSensitive(value, kind)}</span><button type="button" onClick={() => setVisible(current => !current)} className="print:hidden text-slate-400 hover:text-blue-500" aria-label={visible ? "Hassas bilgiyi gizle" : "Hassas bilgiyi göster"}>{visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}</button></span>;
}
