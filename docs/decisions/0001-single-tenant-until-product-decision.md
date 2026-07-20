# ADR 0001 — Ürün kararı verilene kadar tek kiracılı mimari

- Durum: Kabul edildi
- Tarih: 20 Temmuz 2026
- Kapsam: Faz 1 veritabanı standardizasyonu

## Bağlam

Nobel Vize CRM bugün tek şirketin iç operasyon uygulamasıdır. Yol haritasının
Faz 3 adımı, ürünün aynı biçimde mi kalacağını yoksa çok kiracılı SaaS'a mı
dönüşeceğini henüz kesinleştirmemiştir.

Yalnızca bazı tablolara `tenant_id` eklemek güvenli çok kiracılılık sağlamaz.
JWT bağlamı, bütün iş tabloları, ilişkiler, RLS politikaları, Storage yolları,
yedekleme ve yönetim işlemleri birlikte tenant farkında olmadığında çapraz
tenant veri erişimi riski oluşur.

## Karar

Faz 1'de mevcut kurulum tek kiracılı tutulacaktır. Kanonik şema tenant
genişlemesini engellemeyecek UUID anahtarlar ve merkezi RLS yardımcılarıyla
standardize edilir; ancak sahte veya eksik bir `tenant_id` katmanı eklenmez.

## Sonuçlar

- Faz 1 veri bütünlüğü çalışması mevcut Nobel Vize operasyonuna odaklanır.
- Çok kiracılılık uygulanmış gibi bir güvenlik iddiasında bulunulmaz.
- Faz 3 ürün kararı SaaS yönünde olursa tenant izolasyonu ayrı migration ve
  regresyon paketi olarak ele alınır.

SaaS kararı sonrası paket en az şunları birlikte kapsamalıdır:

- Tüm iş tablolarında zorunlu `tenant_id` ve tenant uyumlu unique/FK yapısı
- Auth/JWT tenant bağlamı ve merkezi üyelik/rol modeli
- Her tablo için tenant sınırını kapalı varsayımla uygulayan RLS
- Tenant bazlı Storage yolları ve yetki politikaları
- Tenant farkında RPC, webhook, rapor, yedekleme ve geri yükleme
- Çapraz tenant erişimini deneyen otomatik güvenlik testleri
- Mevcut tek kiracılı veriyi varsayılan tenant'a taşıyan kontrollü migration

## Yeniden değerlendirme tetikleyicisi

İkinci bağımsız şirketin verisi aynı Supabase projesinde tutulmadan veya ücretli
SaaS onboarding'i başlamadan önce bu karar yeniden ele alınmalıdır.
