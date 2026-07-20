-- Salt-okunur Faz 1 envanteri. Satir verisi veya secret yazdirmaz.
-- Supabase SQL Editor'da veya psql ile migration oncesi ve sonrasi calistirilir.

SELECT jsonb_pretty(jsonb_build_object(
  'generated_at', now(),
  'database_version', version(),
  'tables', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'name', table_info.relname,
      'relation_type', CASE table_info.relkind
        WHEN 'r' THEN 'table'
        WHEN 'p' THEN 'partitioned_table'
        WHEN 'v' THEN 'view'
        ELSE table_info.relkind::TEXT
      END,
      'estimated_rows', table_info.reltuples::BIGINT,
      'rls_enabled', table_info.relrowsecurity
    ) ORDER BY table_info.relname), '[]'::JSONB)
    FROM (
      SELECT class.relname, class.relkind, class.reltuples, class.relrowsecurity
      FROM pg_class AS class
      JOIN pg_namespace AS namespace ON namespace.oid = class.relnamespace
      WHERE namespace.nspname = 'public' AND class.relkind IN ('r', 'p', 'v')
    ) AS table_info
  ),
  'columns', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'table', columns.table_name,
      'column', columns.column_name,
      'type', columns.data_type,
      'nullable', columns.is_nullable,
      'default', columns.column_default
    ) ORDER BY columns.table_name, columns.ordinal_position), '[]'::JSONB)
    FROM information_schema.columns
    WHERE columns.table_schema = 'public'
  ),
  'constraints', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'table', relation.relname,
      'name', constraint_info.conname,
      'type', constraint_info.contype,
      'validated', constraint_info.convalidated,
      'definition', pg_get_constraintdef(constraint_info.oid, true)
    ) ORDER BY relation.relname, constraint_info.conname), '[]'::JSONB)
    FROM pg_constraint AS constraint_info
    JOIN pg_class AS relation ON relation.oid = constraint_info.conrelid
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE namespace.nspname = 'public'
  ),
  'indexes', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'table', indexes.tablename,
      'name', indexes.indexname,
      'definition', indexes.indexdef
    ) ORDER BY indexes.tablename, indexes.indexname), '[]'::JSONB)
    FROM pg_indexes AS indexes
    WHERE indexes.schemaname = 'public'
  ),
  'policies', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'table', policies.tablename,
      'name', policies.policyname,
      'command', policies.cmd,
      'roles', policies.roles,
      'using', policies.qual,
      'check', policies.with_check
    ) ORDER BY policies.tablename, policies.policyname), '[]'::JSONB)
    FROM pg_policies AS policies
    WHERE policies.schemaname = 'public'
  ),
  'migrations', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'version', migrations.version,
      'name', migrations.name
    ) ORDER BY migrations.version), '[]'::JSONB)
    FROM supabase_migrations.schema_migrations AS migrations
  ),
  'storage_buckets', (
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', bucket.id,
      'public', bucket.public,
      'file_size_limit', bucket.file_size_limit
    ) ORDER BY bucket.id), '[]'::JSONB)
    FROM storage.buckets AS bucket
  )
)) AS phase1_schema_inventory;
