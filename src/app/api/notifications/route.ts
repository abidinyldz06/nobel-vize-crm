import { NextResponse } from "next/server";
import { requireStaff } from "@/lib/authz";
import { authorizationErrorResponse } from "@/lib/api-auth";
import {
  errorCodeFrom,
  observedRoute,
  requestIdFrom,
  structuredLog,
} from "@/lib/observability";
import { recordOperationalEvent } from "@/lib/operational-events";

async function listNotifications(request: Request) {
  let supabase;
  try {
    ({ supabase } = await requireStaff());
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  
  const { error: syncError } = await supabase.rpc('sync_operational_tasks_v1');
  if (syncError) {
    const requestId = requestIdFrom(request);
    const errorCode = errorCodeFrom(syncError);
    structuredLog("error", "notifications.task_sync.failed", {
      requestId,
      operation: "notifications.task_sync",
      errorCode,
    });
    await recordOperationalEvent({
      eventKey: "notifications.task_sync.failed",
      severity: "error",
      source: "system",
      requestId,
      route: "/api/notifications",
      errorCode,
    });
  }

  const { data: notifications, error } = await supabase
    .from('notifications')
    .select('id, title, message, type, href, created_at, application_id, customer_id, task_id, is_read, read_at')
    .order('created_at', { ascending: false })
    .limit(20);
    
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  
  return NextResponse.json(notifications);
}

async function updateNotifications(request: Request) {
  let supabase;
  try {
    ({ supabase } = await requireStaff());
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  const all = searchParams.get('all');
  
  if (id) {
    const { error } = await supabase
      .rpc('mark_notification_read_v1', { p_notification_id: id });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else if (all === 'true') {
    const { error } = await supabase
      .rpc('mark_all_notifications_read_v1');
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  } else {
    return NextResponse.json({ error: 'Bildirim kimliği veya all=true gereklidir.' }, { status: 400 });
  }
  
  return NextResponse.json({ success: true });
}

export const GET = observedRoute("notifications.list", listNotifications);
export const PATCH = observedRoute("notifications.mark_read", updateNotifications);
