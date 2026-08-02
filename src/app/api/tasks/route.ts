import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import {
  errorCodeFrom,
  observedRoute,
  requestIdFrom,
  structuredLog,
} from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";
import type { Json } from "@/types/database";

const TASK_STATUSES = new Set(["pending", "in_progress", "completed", "cancelled"]);
const TASK_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);

async function listTasks(request: Request) {
  let context;
  try {
    context = await requireStaff();
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const { supabase } = context;
  const { error: syncError } = await supabase.rpc("sync_operational_tasks_v1");
  if (syncError) {
    const requestId = requestIdFrom(request);
    const errorCode = errorCodeFrom(syncError);
    structuredLog("error", "tasks.operational_sync.failed", {
      requestId,
      operation: "tasks.operational_sync",
      errorCode,
    });
    await recordOperationalEvent({
      eventKey: "tasks.operational_sync.failed",
      severity: "error",
      source: "system",
      requestId,
      route: "/api/tasks",
      errorCode,
    });
  }

  const { data, error } = await supabase
    .from("tasks")
    .select(`
      id, title, description, task_type, source_type, status, priority, due_at,
      assigned_staff_id, customer_id, application_id, completed_at, created_at,
      customers(first_name, last_name),
      staff!tasks_assigned_staff_fk(full_name)
    `)
    .neq("status", "cancelled")
    .order("due_at", { ascending: true })
    .limit(250);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ tasks: data ?? [] });
}

async function createTask(request: Request) {
  let context;
  try {
    context = await requireStaff();
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Geçersiz görev bilgisi." }, { status: 400 });
  }

  const payload = body as Record<string, unknown>;
  if (payload.action === "sync_data_quality") {
    if (context.staff.role !== "admin") {
      return NextResponse.json({ error: "Veri kontrolünü yalnız yöneticiler çalıştırabilir." }, { status: 403 });
    }

    const { data, error } = await context.supabase.rpc("sync_data_quality_tasks_v1");
    if (error) {
      const status = error.code === "42501" ? 403 : 400;
      return NextResponse.json({ error: error.message }, { status });
    }

    return NextResponse.json({ summary: data ?? { open_tasks: 0 } });
  }

  if (typeof payload.title !== "string" || payload.title.trim().length === 0 || payload.title.length > 160) {
    return NextResponse.json({ error: "Görev başlığı 1-160 karakter olmalıdır." }, { status: 400 });
  }
  if (typeof payload.due_at !== "string" || Number.isNaN(Date.parse(payload.due_at))) {
    return NextResponse.json({ error: "Geçerli bir görev tarihi gereklidir." }, { status: 400 });
  }
  if (payload.priority !== undefined && (typeof payload.priority !== "string" || !TASK_PRIORITIES.has(payload.priority))) {
    return NextResponse.json({ error: "Geçersiz görev önceliği." }, { status: 400 });
  }
  if (
    payload.description !== undefined
    && payload.description !== null
    && (typeof payload.description !== "string" || payload.description.length > 2000)
  ) {
    return NextResponse.json({ error: "Geçersiz görev açıklaması." }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("create_task_v1", {
    p_payload: payload as Json,
  });
  if (error) {
    const status = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status });
  }

  return NextResponse.json({ id: data }, { status: 201 });
}

async function updateTask(request: Request) {
  let context;
  try {
    context = await requireStaff();
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz JSON gövdesi." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Geçersiz görev güncellemesi." }, { status: 400 });
  }

  const { id, status, assigned_staff_id: assignedStaffId } = body as {
    id?: unknown;
    status?: unknown;
    assigned_staff_id?: unknown;
  };
  if (typeof id !== "string") {
    return NextResponse.json({ error: "Geçersiz görev bilgisi." }, { status: 400 });
  }

  if (assignedStaffId !== undefined) {
    if (typeof assignedStaffId !== "string" || assignedStaffId.length === 0) {
      return NextResponse.json({ error: "Geçerli bir personel seçmelisiniz." }, { status: 400 });
    }
    if (context.staff.role !== "admin") {
      return NextResponse.json({ error: "Görev devretme yetkiniz yok." }, { status: 403 });
    }

    const { data, error } = await context.supabase.rpc("set_task_assignee_v1", {
      p_task_id: id,
      p_assigned_staff_id: assignedStaffId,
    });
    if (error) {
      const responseStatus = error.code === "42501" ? 403 : 400;
      return NextResponse.json({ error: error.message }, { status: responseStatus });
    }
    if (!data) {
      return NextResponse.json({ error: "Görev bulunamadı." }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  }

  if (typeof status !== "string" || !TASK_STATUSES.has(status)) {
    return NextResponse.json({ error: "Geçersiz görev durumu." }, { status: 400 });
  }

  const { data, error } = await context.supabase.rpc("set_task_status_v1", {
    p_task_id: id,
    p_status: status,
  });
  if (error) {
    const responseStatus = error.code === "42501" ? 403 : 400;
    return NextResponse.json({ error: error.message }, { status: responseStatus });
  }
  if (!data) {
    return NextResponse.json({ error: "Görev bulunamadı veya işlem yetkiniz yok." }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}

export const GET = observedRoute("tasks.list", listTasks);
export const POST = observedRoute("tasks.create", createTask);
export const PATCH = observedRoute("tasks.update", updateTask);
