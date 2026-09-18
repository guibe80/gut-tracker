-- ============================================================
-- SUPABASE SCHEMA SNAPSHOT
-- Read-only schema definitions + privileges
-- Works in Supabase SQL Editor
-- ============================================================


-- ============================================================
-- 1. COLUMNS
-- ============================================================

SELECT
    'COLUMNS' AS section,
    table_name,
    column_name,
    data_type,
    is_nullable,
    column_default,
    numeric_precision,
    numeric_scale,
    character_maximum_length
FROM information_schema.columns
WHERE table_schema = 'public'
ORDER BY table_name, ordinal_position;


-- ============================================================
-- 2. PRIMARY KEYS
-- ============================================================

SELECT
    'PRIMARY_KEYS' AS section,
    tc.table_name,
    tc.constraint_name,
    string_agg(
        kcu.column_name,
        ', ' ORDER BY kcu.ordinal_position
    ) AS column_list
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
WHERE tc.constraint_type = 'PRIMARY KEY'
    AND tc.table_schema = 'public'
GROUP BY
    tc.constraint_schema,
    tc.table_schema,
    tc.table_name,
    tc.constraint_name
ORDER BY tc.table_name;


-- ============================================================
-- 3. FOREIGN KEYS
-- ============================================================

SELECT
    'FOREIGN_KEYS' AS section,
    tc.table_name,
    tc.constraint_name,

    string_agg(
        kcu.column_name,
        ', ' ORDER BY kcu.ordinal_position
    ) AS source_columns,

    ccu.table_schema || '.' || ccu.table_name AS references_table,

    string_agg(
        ccu.column_name,
        ', ' ORDER BY kcu.ordinal_position
    ) AS target_columns,

    rc.delete_rule,
    rc.update_rule

FROM information_schema.table_constraints tc

JOIN information_schema.key_column_usage kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema

JOIN information_schema.referential_constraints rc
    ON tc.constraint_name = rc.constraint_name
    AND tc.table_schema = rc.constraint_schema

JOIN information_schema.constraint_column_usage ccu
    ON rc.unique_constraint_name = ccu.constraint_name
    AND rc.unique_constraint_schema = ccu.constraint_schema

WHERE tc.constraint_type = 'FOREIGN KEY'
    AND tc.table_schema = 'public'

GROUP BY
    tc.constraint_schema,
    tc.table_schema,
    tc.table_name,
    tc.constraint_name,
    rc.delete_rule,
    rc.update_rule,
    ccu.table_schema,
    ccu.table_name,
    ccu.constraint_name

ORDER BY tc.table_name;


-- ============================================================
-- 4. RLS POLICIES
-- ============================================================

SELECT
    'RLS_POLICIES' AS section,

    n.nspname || '.' || c.relname AS table_name,

    p.polname AS policy_name,

    CASE p.polcmd
        WHEN 'r' THEN 'SELECT'
        WHEN 'a' THEN 'INSERT'
        WHEN 'w' THEN 'UPDATE'
        WHEN 'd' THEN 'DELETE'
        WHEN '*' THEN 'ALL'
        ELSE p.polcmd::text
    END AS command,

    string_agg(
        rol.rolname,
        ', ' ORDER BY rol.rolname
    ) AS roles,

    CASE
        WHEN p.polpermissive = false
        THEN 'restrictive'
        ELSE 'permissive'
    END AS policy_type,

    pg_get_expr(
        p.polqual,
        p.polrelid
    ) AS using_expression,

    pg_get_expr(
        p.polwithcheck,
        p.polrelid
    ) AS with_check_expression

FROM pg_catalog.pg_policy p

JOIN pg_catalog.pg_class c
    ON p.polrelid = c.oid

JOIN pg_catalog.pg_namespace n
    ON c.relnamespace = n.oid

CROSS JOIN LATERAL
    unnest(p.polroles) AS ur(oid)

JOIN pg_catalog.pg_roles rol
    ON ur.oid = rol.oid

WHERE n.nspname = 'public'

GROUP BY
    n.nspname,
    c.relname,
    p.polname,
    p.polpermissive,
    p.polcmd,
    p.polqual,
    p.polwithcheck,
    p.polrelid

ORDER BY
    n.nspname,
    c.relname,
    p.polname;


-- ============================================================
-- 5. ROLE GRANTS
-- ============================================================

SELECT
    'ROLE_GRANTS' AS section,

    table_schema || '.' || table_name AS target,

    grantee,

    string_agg(
        privilege_type,
        ', ' ORDER BY privilege_type
    ) AS privileges

FROM information_schema.role_table_grants

WHERE table_schema = 'public'
    AND grantee IN (
        'anon',
        'authenticated'
    )

GROUP BY
    table_schema,
    table_name,
    grantee

ORDER BY
    table_schema,
    table_name,
    grantee;