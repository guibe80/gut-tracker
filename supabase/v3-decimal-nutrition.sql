-- Preserve fractional nutrition and glucose values in existing V3 databases.
-- Run once in the Supabase SQL Editor. Missing legacy columns are ignored.

do $$
declare
    column_spec record;
begin
    for column_spec in
        select *
        from (values
            ('meals', 'estimated_carbohydrate_g'),
            ('meals', 'protein_estimate_g'),
            ('glucose_readings', 'glucose_mmol_l'),
            ('glucose_readings', 'estimated_meal_carbs_g')
        ) as columns(table_name, column_name)
    loop
        if exists (
            select 1
            from information_schema.columns
            where table_schema = 'public'
              and table_name = column_spec.table_name
              and column_name = column_spec.column_name
        ) then
            execute format(
                'alter table public.%I alter column %I type numeric using %I::numeric',
                column_spec.table_name,
                column_spec.column_name,
                column_spec.column_name
            );
        end if;
    end loop;
end
$$;