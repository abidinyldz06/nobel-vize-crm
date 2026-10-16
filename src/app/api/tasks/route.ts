import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireStaff } from "@/lib/authz";
import {
  errorCodeFrom,
  observedRoute,
  requestIdFrom,
  structuredLog,
} from "@/lib/observability";
import { taskCreateSchema, taskUpdateSchema } from "@/lib/api-input";
import { recordOperationalEvent } from "@/lib/operational-events";
import { readValidJson } from "@/lib/request-json";
import type { Json } from "@/types/database";

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

  const parsed = await readValidJson(request, taskCreateSchema);
  if (!parsed.ok) return parsed.response;
  const payload = parsed.data;
  if ("action" in payload) {
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

  const parsed = await readValidJson(request, taskUpdateSchema);
  if (!parsed.ok) return parsed.response;
  const { id } = parsed.data;
  if ("assigned_staff_id" in parsed.data) {
    const assignedStaffId = parsed.data.assigned_staff_id;
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

  const status = parsed.data.status;
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
