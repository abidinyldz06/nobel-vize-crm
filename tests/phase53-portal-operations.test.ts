import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";
import { validatePortalUploadInput } from "../src/lib/portal-upload-policy.ts";

const root = process.cwd();

describe("phase 5.3 portal and operations", () => {
  it("allows only bounded private portal uploads", () => {
    assert.deepEqual(validatePortalUploadInput({
      fileName: "pasaport.pdf",
      contentType: "application/pdf",
      size: 1024,
    }), { ok: true, fileName: "pasaport.pdf", contentType: "application/pdf", size: 1024, extension: "pdf" });
    assert.equal(validatePortalUploadInput({ fileName: "../../secret.pdf", contentType: "application/pdf", size: 1024 }).ok, false);
    assert.equal(validatePortalUploadInput({ fileName: "makro.docm", contentType: "application/pdf", size: 1024 }).ok, false);
    assert.equal(validatePortalUploadInput({ fileName: "buyuk.pdf", contentType: "application/pdf", size: 10 * 1024 * 1024 + 1 }).ok, false);
  });

  it("keeps portal commit, due-payment automation and capacity alerts on controlled paths", async () => {
    const [portalMigration, operationsMigration, uploadRoute, calendarSync] = await Promise.all([
      readFile(path.join(root, "supabase/migrations/202608020003_phase53_portal_uploads.sql"), "utf8"),
      readFile(path.join(root, "supabase/migrations/202608020004_phase53_operations_capacity.sql"), "utf8"),
      readFile(path.join(root, "src/app/api/portal/[token]/commit-upload/route.ts"), "utf8"),
      readFile(path.join(root, "src/lib/google-calendar-sync.ts"), "utf8"),
    ]);
    assert.match(portalMigration, /record_portal_document_upload_v1/);
    assert.match(portalMigration, /service_role_required/);
    assert.match(portalMigration, /file_size_bytes BETWEEN 1 AND 10485760/);
    assert.match(uploadRoute, /createSupabaseAdminClient/);
    assert.match(uploadRoute, /metadata\.size !== input\.size/);
    assert.match(operationsMigration, /ADD COLUMN due_at/);
    assert.match(operationsMigration, /COALESCE\(payment\.due_at, payment\.created_at \+ interval '3 days'\)/);
    assert.match(operationsMigration, /sync_staff_capacity_alerts_v1/);
    assert.match(calendarSync, /encryptCalendarToken/);
    assert.match(calendarSync, /nobel_application_id/);
    assert.match(calendarSync, /Google Takvim değişikliği CRM'e işlendi/);
  });
});
