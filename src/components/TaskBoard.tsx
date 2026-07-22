"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  CirclePlay,
  Clock3,
  Loader2,
  Plus,
  RefreshCw,
  X,
} from "lucide-react";
import { toast } from "sonner";

type TaskStatus = "pending" | "in_progress" | "completed" | "cancelled";
type TaskPriority = "low" | "normal" | "high" | "urgent";
type TaskTab = "today" | "overdue" | "upcoming" | "completed";

type TaskItem = {
  id: string;
  title: string;
  description: string | null;
  task_type: string;
  source_type: string;
  status: TaskStatus;
  priority: TaskPriority;
  due_at: string;
  assigned_staff_id: string;
  customer_id: string | null;
  application_id: string | null;
  completed_at: string | null;
  created_at: string;
  customers: { first_name: string; last_name: string } | null;
  staff: { full_name: string } | null;
};

type StaffOption = { id: string; full_name: string; role: string };
type CustomerOption = { id: string; first_name: string; last_name: string; assigned_staff_id: string | null };

const tabs: Array<{ id: TaskTab; label: string }> = [
  { id: "today", label: "Bugün" },
  { id: "overdue", label: "Geciken" },
  { id: "upcoming", label: "Yaklaşan" },
  { id: "completed", label: "Tamamlanan" },
];

const priorityConfig: Record<TaskPriority, { label: string; className: string }> = {
  low: { label: "Düşük", className: "bg-slate-500/10 text-slate-500" },
  normal: { label: "Normal", className: "bg-blue-500/10 text-blue-500" },
  high: { label: "Yüksek", className: "bg-amber-500/10 text-amber-500" },
  urgent: { label: "Acil", className: "bg-red-500/10 text-red-500" },
};

function dayBounds() {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function classifyTask(task: TaskItem): TaskTab {
  if (task.status === "completed") return "completed";
  const due = new Date(task.due_at);
  const { start, end } = dayBounds();
  if (due < start) return "overdue";
  if (due < end) return "today";
  return "upcoming";
}

export default function TaskBoard({
  isAdmin,
  currentStaffId,
  staffOptions,
  customerOptions,
}: {
  isAdmin: boolean;
  currentStaffId: string;
  staffOptions: StaffOption[];
  customerOptions: CustomerOption[];
}) {
  const [tasks, setTasks] = useState<TaskItem[]>([]);
  const [activeTab, setActiveTab] = useState<TaskTab>("today");
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    due_at: "",
    priority: "normal" as TaskPriority,
    assigned_staff_id: currentStaffId,
    customer_id: "",
  });

  const loadTasks = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/tasks", { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Görevler yüklenemedi.");
      setTasks(payload.tasks ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görevler yüklenemedi.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadTasks();
  }, [loadTasks]);

  const grouped = useMemo(() => {
    const result: Record<TaskTab, TaskItem[]> = { today: [], overdue: [], upcoming: [], completed: [] };
    tasks.forEach(task => result[classifyTask(task)].push(task));
    return result;
  }, [tasks]);

  const selectedStaff = staffOptions.find(option => option.id === form.assigned_staff_id);
  const availableCustomers = selectedStaff?.role === "admin"
    ? customerOptions
    : customerOptions.filter(option => option.assigned_staff_id === form.assigned_staff_id);

  const updateStatus = async (task: TaskItem, status: TaskStatus) => {
    setProcessingId(task.id);
    try {
      const response = await fetch("/api/tasks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: task.id, status }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Görev güncellenemedi.");
      toast.success(status === "completed" ? "Görev tamamlandı." : "Görev başlatıldı.");
      await loadTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görev güncellenemedi.");
    } finally {
      setProcessingId(null);
    }
  };

  const createTask = async () => {
    setCreating(true);
    try {
      const dueAt = new Date(form.due_at);
      if (!form.title.trim() || Number.isNaN(dueAt.getTime())) {
        throw new Error("Başlık ve görev tarihi gereklidir.");
      }
      const response = await fetch("/api/tasks", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title.trim(),
          description: form.description.trim() || null,
          due_at: dueAt.toISOString(),
          priority: form.priority,
          assigned_staff_id: form.assigned_staff_id,
          customer_id: form.customer_id || null,
        }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Görev oluşturulamadı.");
      toast.success("Görev oluşturuldu ve personele bildirildi.");
      setShowCreate(false);
      setForm({
        title: "",
        description: "",
        due_at: "",
        priority: "normal",
        assigned_staff_id: currentStaffId,
        customer_id: "",
      });
      await loadTasks();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Görev oluşturulamadı.");
    } finally {
      setCreating(false);
    }
  };

  const visibleTasks = grouped[activeTab];

  return (
    <div className="min-h-screen bg-white p-6 dark:bg-[#060d1a]">
      <div className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900 dark:text-white">
            <CalendarClock className="h-5 w-5 text-blue-500" /> Görevler
          </h1>
          <p className="mt-0.5 text-xs text-slate-500">Randevu, evrak, ödeme ve takip işlerinizi tek ekrandan yönetin.</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadTasks()} disabled={loading} className="rounded-xl border border-slate-200 p-2.5 text-slate-500 hover:bg-slate-50 disabled:opacity-50 dark:border-[#1f2937] dark:hover:bg-[#1a2232]" aria-label="Görevleri yenile">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button type="button" onClick={() => setShowCreate(true)} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">
            <Plus className="h-4 w-4" /> Yeni Görev
          </button>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tabs.map(tab => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`rounded-2xl border p-4 text-left transition-colors ${activeTab === tab.id ? "border-blue-500 bg-blue-500/10" : "border-slate-200 bg-white hover:bg-slate-50 dark:border-[#1f2937] dark:bg-[#0d1420] dark:hover:bg-[#1a2232]"}`}
          >
            <p className="text-xs font-medium text-slate-500">{tab.label}</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{grouped[tab.id].length}</p>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg dark:border-[#1f2937] dark:bg-[#0d1420]">
        {loading ? (
          <div className="flex items-center justify-center gap-2 p-16 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin" /> Görevler hazırlanıyor...</div>
        ) : visibleTasks.length === 0 ? (
          <div className="p-16 text-center">
            <CheckCircle2 className="mx-auto mb-3 h-9 w-9 text-emerald-500" />
            <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Bu bölümde görev yok.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100 dark:divide-[#1f2937]">
            {visibleTasks.map(task => {
              const config = priorityConfig[task.priority] ?? priorityConfig.normal;
              return (
                <article key={task.id} data-testid={`task-${task.id}`} className="p-4 sm:p-5">
                  <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                    <div className="min-w-0">
                      <div className="mb-1.5 flex flex-wrap items-center gap-2">
                        {activeTab === "overdue" && <AlertTriangle className="h-4 w-4 text-red-500" />}
                        <h2 className="font-semibold text-slate-900 dark:text-white">{task.title}</h2>
                        <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${config.className}`}>{config.label}</span>
                        {task.status === "in_progress" && <span className="rounded-full bg-purple-500/10 px-2 py-0.5 text-[10px] font-bold text-purple-500">Devam Ediyor</span>}
                      </div>
                      {task.description && <p className="text-xs text-slate-500">{task.description}</p>}
                      <div className="mt-2 flex flex-wrap items-center gap-3 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" /> {new Date(task.due_at).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short" })}</span>
                        <span>{task.staff?.full_name || "Atanmamış"}</span>
                        {task.customer_id && task.customers && (
                          <Link href={`/customers/${task.customer_id}`} className="font-semibold text-blue-500 hover:underline">
                            {task.customers.first_name} {task.customers.last_name}
                          </Link>
                        )}
                      </div>
                    </div>
                    {task.status !== "completed" && (
                      <div className="flex shrink-0 gap-2">
                        {task.status === "pending" && (
                          <button type="button" onClick={() => void updateStatus(task, "in_progress")} disabled={processingId === task.id} className="inline-flex items-center gap-1.5 rounded-lg bg-purple-500/10 px-3 py-2 text-xs font-semibold text-purple-500 hover:bg-purple-500/20 disabled:opacity-50">
                            <CirclePlay className="h-4 w-4" /> Başla
                          </button>
                        )}
                        <button type="button" onClick={() => void updateStatus(task, "completed")} disabled={processingId === task.id} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500 hover:bg-emerald-500/20 disabled:opacity-50">
                          {processingId === task.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Tamamla
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-[#1f2937] dark:bg-[#0d1420]">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="font-bold text-slate-900 dark:text-white">Yeni Görev</h2>
                <p className="text-xs text-slate-500">Atanan personele kişisel bildirim gönderilir.</p>
              </div>
              <button type="button" onClick={() => setShowCreate(false)} disabled={creating} className="text-slate-500" aria-label="Görev penceresini kapat"><X className="h-5 w-5" /></button>
            </div>
            <div className="space-y-4">
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Başlık
                <input value={form.title} onChange={event => setForm(current => ({ ...current, title: event.target.value }))} maxLength={160} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-white" />
              </label>
              <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Açıklama
                <textarea value={form.description} onChange={event => setForm(current => ({ ...current, description: event.target.value }))} maxLength={2000} rows={3} className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-white" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Tarih ve saat
                  <input type="datetime-local" value={form.due_at} onChange={event => setForm(current => ({ ...current, due_at: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-white" />
                </label>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Öncelik
                  <select value={form.priority} onChange={event => setForm(current => ({ ...current, priority: event.target.value as TaskPriority }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-[#1f2937] dark:bg-[#060c18] dark:text-white">
                    {Object.entries(priorityConfig).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Atanan personel
                  <select value={form.assigned_staff_id} onChange={event => setForm(current => ({ ...current, assigned_staff_id: event.target.value, customer_id: "" }))} disabled={!isAdmin} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none disabled:opacity-60 dark:border-[#1f2937] dark:bg-[#060c18] dark:text-white">
                    {staffOptions.map(option => <option key={option.id} value={option.id}>{option.full_name}</option>)}
                  </select>
                </label>
                <label className="block text-xs font-semibold text-slate-600 dark:text-slate-300">Müşteri (isteğe bağlı)
                  <select value={form.customer_id} onChange={event => setForm(current => ({ ...current, customer_id: event.target.value }))} className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none dark:border-[#1f2937] dark:bg-[#060c18] dark:text-white">
                    <option value="">Müşteri seçilmedi</option>
                    {availableCustomers.map(option => <option key={option.id} value={option.id}>{option.first_name} {option.last_name}</option>)}
                  </select>
                </label>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreate(false)} disabled={creating} className="rounded-xl px-4 py-2 text-sm font-semibold text-slate-500">İptal</button>
              <button type="button" data-testid="create-task-submit" onClick={() => void createTask()} disabled={creating} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {creating && <Loader2 className="h-4 w-4 animate-spin" />} Görevi Oluştur
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
