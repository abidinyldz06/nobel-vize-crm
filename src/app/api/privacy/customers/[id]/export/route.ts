import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/authz";
import { createSupabaseAdminClient } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  let supabase;
  try {
    ({ supabase } = await requireAdmin());
  } catch (error) {
    return authorizationErrorResponse(error);
  }

  const { id } = await params;
  const admin = createSupabaseAdminClient();
  const { data: customer, error: customerError } = await admin.from("customers").select("*").eq("id", id).single();
  if (customerError || !customer) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });

  try {
    const { data: applications, error: applicationsError } = await admin.from("applications").select("*").eq("customer_id", id).order("created_at");
    if (applicationsError) throw applicationsError;
    const applicationIds = (applications ?? []).map(application => application.id);
    const byApplications = async (table: "documents" | "notes" | "payments") => {
      if (applicationIds.length === 0) return [];
      const { data, error } = await admin.from(table).select("*").in("application_id", applicationIds).order("created_at");
      if (error) throw error;
      return data ?? [];
    };
    const [documents, notes, payments, activity, communications, visaHistory, familyMembers, tags, notices, consents, requests, tasks] = await Promise.all([
      byApplications("documents"), byApplications("notes"), byApplications("payments"),
      admin.from("activity_log").select("id, application_id, customer_id, action, performed_by, type, created_at").or(`customer_id.eq.${id}${applicationIds.length ? `,application_id.in.(${applicationIds.join(",")})` : ""}`).order("created_at"),
      admin.from("communications").select("*").eq("customer_id", id).order("created_at"),
      admin.from("visa_history").select("*").eq("customer_id", id).order("created_at"),
      admin.from("family_members").select("*").eq("customer_id", id).order("created_at"),
      admin.from("customer_tags").select("created_at, tags(name, color)").eq("customer_id", id),
      admin.from("customer_privacy_notices").select("*, privacy_notice_versions(version, title, effective_at)").eq("customer_id", id).order("delivered_at"),
      admin.from("customer_consents").select("*, privacy_notice_versions(version, title)").eq("customer_id", id).order("decision_at"),
      admin.from("data_subject_requests").select("*").eq("customer_id", id).order("requested_at"),
      admin.from("tasks").select("id, title, description, task_type, status, priority, due_at, completed_at, created_at").eq("customer_id", id).order("created_at"),
    ]);
    for (const result of [activity, communications, visaHistory, familyMembers, tags, notices, consents, requests, tasks]) if (result.error) throw result.error;

    const { error: auditError } = await supabase.rpc("record_customer_export_v1", { p_customer_id: id });
    if (auditError) throw auditError;

    const payload = {
      format: "nobel-vize-customer-data-export",
      version: "1.0",
      exported_at: new Date().toISOString(),
      customer,
      applications: applications ?? [],
      documents: { records: documents, binary_files_included: false },
      notes,
      payments,
      activity: activity.data ?? [],
      communications: communications.data ?? [],
      visa_history: visaHistory.data ?? [],
      family_members: familyMembers.data ?? [],
      tags: tags.data ?? [],
      privacy_notice_deliveries: notices.data ?? [],
      consent_decisions: consents.data ?? [],
      data_subject_requests: requests.data ?? [],
      tasks: tasks.data ?? [],
    };
    const safeName = `${customer.first_name}-${customer.last_name}`.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "musteri";
    return new NextResponse(JSON.stringify(payload, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="kvkk-${safeName}-${new Date().toISOString().slice(0, 10)}.json"`,
        "Cache-Control": "no-store, private",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Customer privacy export failed:", error);
    return NextResponse.json({ error: "Müşteri veri paketi oluşturulamadı." }, { status: 500 });
  }
}
