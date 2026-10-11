function fiveADayRequireAuth() {
    if (!supabaseClient || !user?.id) {
        throw new Error('Sign in to save and view your 5 A Day entries.');
    }
    return { client: supabaseClient, userId: user.id };
}

function fiveADayMapRecord(record) {
    return {
        ...record,
        date: dvFormatDate(new Date(record.consumed_at)),
    };
}

function createFiveADaySupabaseRepository() {
    return {
        async listEntries(date) {
            const { client, userId } = fiveADayRequireAuth();
            const start = dvDayStart(date).toISOString();
            const end = dvDayEnd(date).toISOString();
            const { data, error } = await client
                .from('five_a_day_entries')
                .select('*')
                .eq('user_id', userId)
                .gte('consumed_at', start)
                .lte('consumed_at', end)
                .order('consumed_at', { ascending: true });
            if (error) throw error;
            return (data || []).map(fiveADayMapRecord);
        },
        async addEntry(entry) {
            const { client, userId } = fiveADayRequireAuth();
            const { date, ...values } = entry;
            const { data, error } = await client
                .from('five_a_day_entries')
                .insert({ ...values, user_id: userId })
                .select('*')
                .single();
            if (error) throw error;
            return fiveADayMapRecord(data);
        },
        async updateEntry(id, changes) {
            const { client, userId } = fiveADayRequireAuth();
            const { date, ...values } = changes;
            const { data, error } = await client
                .from('five_a_day_entries')
                .update(values)
                .eq('id', id)
                .eq('user_id', userId)
                .select('*')
                .single();
            if (error) throw error;
            return fiveADayMapRecord(data);
        },
        async deleteEntry(id) {
            const { client, userId } = fiveADayRequireAuth();
            const { error } = await client
                .from('five_a_day_entries')
                .delete()
                .eq('id', id)
                .eq('user_id', userId);
            if (error) throw error;
        },
        async searchFoods(query) {
            return searchFiveADayCatalogue(query).map(food => ({ ...food }));
        },
    };
}

// A volatile adapter exists for isolated browser/unit tests only. Production
// always uses the Supabase repository below; there is no storage fallback.
function createFiveADayMemoryRepository() {
    let entries = [];
    let nextId = 1;
    return {
        async listEntries(date) {
            return entries.filter(entry => entry.date === date).map(entry => ({ ...entry }));
        },
        async addEntry(entry) {
            const created = {
                ...entry,
                id: `five-a-day-${nextId++}`,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            };
            entries.push(created);
            return { ...created };
        },
        async updateEntry(id, changes) {
            const index = entries.findIndex(entry => entry.id === id);
            if (index < 0) throw new Error('5 A Day entry not found.');
            entries[index] = {
                ...entries[index],
                ...changes,
                id,
                updated_at: new Date().toISOString(),
            };
            return { ...entries[index] };
        },
        async deleteEntry(id) {
            const index = entries.findIndex(entry => entry.id === id);
            if (index < 0) throw new Error('5 A Day entry not found.');
            entries.splice(index, 1);
        },
        async searchFoods(query) {
            return searchFiveADayCatalogue(query).map(food => ({ ...food }));
        },
    };
}

let fiveADayRepository = createFiveADaySupabaseRepository();
