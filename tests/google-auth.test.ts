import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("Google staff login security boundary", () => {
  it("uses the Supabase PKCE callback without requesting Calendar access", async () => {
    const [form, callback] = await Promise.all([
      readFile(path.join(root, "src/components/LoginForm.tsx"), "utf8"),
      readFile(path.join(root, "src/app/auth/callback/route.ts"), "utf8"),
    ]);
    assert.match(form, /signInWithOAuth/);
    assert.match(form, /provider: "google"/);
    assert.match(form, /\/auth\/callback/);
    assert.doesNotMatch(form, /calendar\.events/);
    assert.match(callback, /exchangeCodeForSession/);
  });

  it("rejects unlinked or inactive users and preserves the staff MFA policy", async () => {
    const callback = await readFile(
      path.join(root, "src/app/auth/callback/route.ts"),
      "utf8",
    );
    assert.match(callback, /\.eq\("user_id", authData\.user\.id\)/);
    assert.match(callback, /!staff\.is_active/);
    assert.match(callback, /await supabase\.auth\.signOut\(\)/);
    assert.match(callback, /admin_mfa_required, consultant_mfa_required/);
    assert.match(callback, /getAuthenticatorAssuranceLevel/);
    assert.match(callback, /redirectUrl\(request, "\/mfa"\)/);
  });
});
