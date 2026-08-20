import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, it } from "node:test";

const root = process.cwd();

describe("Google verification public and removal boundaries", () => {
  it("publishes an anonymous product homepage, privacy policy and terms while keeping staff pages protected", async () => {
    const [home, privacy, terms, proxy, publicChrome] = await Promise.all([
      readFile(path.join(root, "src/app/page.tsx"), "utf8"),
      readFile(path.join(root, "src/app/privacy-policy/page.tsx"), "utf8"),
      readFile(path.join(root, "src/app/terms/page.tsx"), "utf8"),
      readFile(path.join(root, "src/proxy.ts"), "utf8"),
      readFile(path.join(root, "src/components/PublicSiteChrome.tsx"), "utf8"),
    ]);
    assert.match(home, /Google veri kullanımı/);
    assert.match(home, /href="\/privacy-policy"/);
    assert.match(publicChrome, /href="\/terms"/);
    assert.match(privacy, /Limited Use gereklilikleri/);
    assert.match(privacy, /Google Takvim bağlantısını kaldırmak/);
    assert.match(terms, /Google Takvim bağlantısı isteğe bağlı/);
    assert.match(proxy, /loginUrl\.pathname = '\/login'/);
    assert.match(proxy, /pathname === '\/login'/);
  });

  it("keeps disconnect authenticated, staff-scoped and locally destructive even if remote revocation fails", async () => {
    const route = await readFile(
      path.join(root, "src/app/api/integrations/google-calendar/route.ts"),
      "utf8",
    );
    assert.match(route, /export async function DELETE/);
    assert.match(route, /requireStaff\(\)/);
    assert.match(route, /revokeGoogleOAuthToken/);
    assert.match(route, /\.delete\(\)[\s\S]*\.eq\("staff_id", staff\.id\)[\s\S]*\.eq\("provider", "google"\)/);
    assert.ok(route.indexOf("revokeGoogleOAuthToken") < route.indexOf(".delete()"));
  });
});
