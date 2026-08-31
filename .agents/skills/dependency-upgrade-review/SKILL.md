---
name: dependency-upgrade-review
description: Nobel Vize CRM dependency veya Dependabot değişikliklerinde package/lock diff, uyumluluk ve güvenlik riskini incele. Genel kod review veya kendiliğinden sürüm yükseltme için kullanma.
---

# Bağımlılık yükseltme incelemesi

1. `AGENTS.md`, `package.json`, `package-lock.json`, `.github/workflows/quality.yml` ve `.github/workflows/dependency-audit.yml` oku. Gerçek base/head diff'inde doğrudan/geçişli paketleri, overrides, install scriptlerini ve beklenmeyen lockfile değişikliklerini ayır; npm/lockfile düzenini koru.
2. Eski ve yeni kesin sürümlere ait resmi release notes, migration rehberi, breaking change ve güvenlik duyurularını incele. Next/React/Supabase, auth ve build tooling için runtime/Node, peer dependency, App Router, session/cookie ve build uyumluluğunu mevcut kullanım noktalarıyla karşılaştır. Kaynak bağlantılarını rapora ekle; erişilemeyen kaynağı doğrulanmış sayma.
3. Otomatik major upgrade, toplu yükseltme, audit fix --force veya kapsam dışı paket ekleme yapma. Review talebi yalnız inceleme yetkisidir; uygulama istenirse hedefli değişiklik yap. Audit/test/güvenlik kapısını zayıflatarak yeşile çevirme.
4. Betik ve kurulum yan etkilerini inceledikten sonra `npm run lint`, `npm run typecheck`, `npm test`, `npm run audit:production`, `npm run build` çalıştır. Next/auth/UI değişiminde ilgili Playwright akışlarını; şema/RLS etkisinde AGENTS'taki izole DB kapılarını ekle. Build ve typecheck'i sırala.
5. Düşük/orta/yüksek risk derecesini somut uyumluluk, güvenlik ve müşteri akışı kanıtlarıyla gerekçelendir. Değişen paketler/dosyalar, test sonuçları, belirsizlikler ve manuel adımları bildir; push/merge/deploy yapıldığını varsayma.
