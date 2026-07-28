import { NextResponse } from "next/server";
import { authorizationErrorResponse } from "@/lib/api-auth";
import { requireAdmin } from "@/lib/authz";
import { errorCodeFrom, observedRoute } from "@/lib/observability";
import { executeApprovedPrivacyAction } from "@/lib/privacy-lifecycle";

async function executeAction(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch (error) {
    return authorizationErrorResponse(error);
  }
  const { id } = await context.params;
  try {
    const result = await executeApprovedPrivacyAction(id);
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    const code = errorCodeFrom(error);
    const status = code === "verified_backup_after_approval_required" ? 409 : 400;
    return NextResponse.json({
      error: code === "verified_backup_after_approval_required"
        ? "Son onaydan sonra doğrulanmış yedek alınması gerekiyor."
        : "KVKK işlemi güvenli biçimde tamamlanamadı.",
      code,
    }, { status });
  }
}

export const POST = observedRoute("privacy.execute_action", executeAction);
