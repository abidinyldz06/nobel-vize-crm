# Kök ve supabase/ altındaki emekli edilmeyen SQL

- `supabase/schema.sql`: `Authenticated Write` politikası migration’larda yok; `Authenticated Read` yalnız storage DROP kaydı.
- `supabase/schema_full.sql`: `country_visa_requirements` reset sonrası tablo değil; eski policy adları yok ve dosya `DROP TABLE ... CASCADE` içeriyor.
- `supabase/apply_rls_policies.sql`: tanımladığı policy adlarının hiçbiri migration’larda ve reset şemasında yok.
- `supabase/fix_rls_and_countries.sql`: `payments.paid_at` reset şemasında yok; ülke INSERT satırlarının migration karşılığı doğrulanmadı.
