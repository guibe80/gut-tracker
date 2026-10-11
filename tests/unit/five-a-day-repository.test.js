const { test, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const read = file => fs.readFileSync(path.resolve(__dirname, file), 'utf8');
const sandbox = {};
vm.createContext(sandbox);
vm.runInContext([
    read('../../utils/datetime.js'),
    read('../../services/five-a-day-catalogue.js'),
    read('../../services/five-a-day-repository.js'),
    'globalThis.testRepository = createFiveADaySupabaseRepository();',
].join('\n'), sandbox);

function createSupabaseMock(seed = [], queryError = null) {
    const records = seed.map(record => ({ ...record }));
    const calls = [];
    const client = {
        from(table) {
            assert.equal(table, 'five_a_day_entries');
            const query = {
                operation: 'select',
                filters: [],
                async execute(single = false) {
                    calls.push({ operation: query.operation, filters: query.filters, payload: query.payload });
                    let matching = records.filter(record => query.filters.every(filter => {
                        if (filter.operator === 'eq') return record[filter.column] === filter.value;
                        const value = new Date(record[filter.column]).getTime();
                        const target = new Date(filter.value).getTime();
                        return filter.operator === 'gte' ? value >= target : value <= target;
                    }));

                    if (query.operation === 'insert') {
                        const record = {
                            ...query.payload,
                            id: 'record-new',
                            created_at: '2026-06-01T12:00:00.000Z',
                            updated_at: '2026-06-01T12:00:00.000Z',
                        };
                        records.push(record);
                        matching = [record];
                    } else if (query.operation === 'update') {
                        matching.forEach(record => Object.assign(record, query.payload));
                    } else if (query.operation === 'delete') {
                        matching.forEach(record => records.splice(records.indexOf(record), 1));
                        matching = [];
                    }

                    const data = single ? matching[0] || null : matching;
                    return {
                        data: single ? data && { ...data } : data.map(record => ({ ...record })),
                        error: queryError,
                    };
                },
                eq(column, value) {
                    query.filters.push({ operator: 'eq', column, value });
                    return query;
                },
                gte(column, value) {
                    query.filters.push({ operator: 'gte', column, value });
                    return query;
                },
                lte(column, value) {
                    query.filters.push({ operator: 'lte', column, value });
                    return query;
                },
                order() { return query; },
                select() { return query; },
                insert(payload) {
                    query.operation = 'insert';
                    query.payload = payload;
                    return query;
                },
                update(payload) {
                    query.operation = 'update';
                    query.payload = payload;
                    return query;
                },
                delete() {
                    query.operation = 'delete';
                    return query;
                },
                single() {
                    return query.execute(true);
                },
                then(resolve, reject) {
                    return query.execute().then(resolve, reject);
                },
            };
            return query;
        },
    };
    return { client, records, calls };
}

const baseRecord = {
    id: 'record-1',
    user_id: 'user-1',
    consumed_at: '2026-06-01T12:00:00.000Z',
    food_name: 'Apple',
    category: 'fruit',
    quantity: 80,
    unit: 'g',
    qualifying_weight_g: null,
    source: 'catalogue',
    confirmed: false,
    created_at: '2026-06-01T12:00:00.000Z',
    updated_at: '2026-06-01T12:00:00.000Z',
};

beforeEach(() => {
    sandbox.user = { id: 'user-1' };
});

test('lists only the authenticated user records in a selected local date and maps their date', async () => {
    const mock = createSupabaseMock([
        baseRecord,
        { ...baseRecord, id: 'other-user', user_id: 'user-2' },
        { ...baseRecord, id: 'other-day', consumed_at: '2026-06-02T00:00:00.000Z' },
    ]);
    sandbox.supabaseClient = mock.client;

    const entries = await sandbox.testRepository.listEntries('2026-06-01');

    assert.equal(entries.length, 1);
    assert.equal(entries[0].date, '2026-06-01');
    assert.equal(mock.calls[0].filters.find(filter => filter.column === 'user_id').value, 'user-1');
    assert.equal(mock.calls[0].filters.find(filter => filter.operator === 'gte').value, sandbox.dvDayStart('2026-06-01').toISOString());
    assert.equal(mock.calls[0].filters.find(filter => filter.operator === 'lte').value, sandbox.dvDayEnd('2026-06-01').toISOString());
});

test('inserts entries with authenticated ownership and persists returned row', async () => {
    const mock = createSupabaseMock();
    sandbox.supabaseClient = mock.client;
    const created = await sandbox.testRepository.addEntry({
        date: '2026-06-01',
        consumed_at: '2026-06-01T12:00:00.000Z',
        food_name: 'Apple',
        category: 'fruit',
        quantity: 80,
        unit: 'g',
        qualifying_weight_g: null,
        source: 'catalogue',
        confirmed: false,
    });

    assert.equal(created.id, 'record-new');
    assert.equal(created.user_id, 'user-1');
    assert.equal(created.date, '2026-06-01');
    assert.equal('date' in mock.calls[0].payload, false);
    assert.equal(mock.calls[0].payload.user_id, 'user-1');
});

test('updates and deletes are scoped to both entry and authenticated owner', async () => {
    const mock = createSupabaseMock([baseRecord]);
    sandbox.supabaseClient = mock.client;
    const updated = await sandbox.testRepository.updateEntry('record-1', { confirmed: true });
    await sandbox.testRepository.deleteEntry('record-1');

    assert.equal(updated.confirmed, true);
    assert.deepEqual(
        mock.calls[0].filters.map(filter => [filter.column, filter.value]),
        [['id', 'record-1'], ['user_id', 'user-1']]
    );
    assert.deepEqual(
        mock.calls[1].filters.map(filter => [filter.column, filter.value]),
        [['id', 'record-1'], ['user_id', 'user-1']]
    );
});

test('requires authenticated Supabase session instead of silently using volatile storage', async () => {
    sandbox.supabaseClient = null;
    await assert.rejects(sandbox.testRepository.listEntries('2026-06-01'), /Sign in/);
    await assert.rejects(sandbox.testRepository.addEntry({}), /Sign in/);
});

test('propagates Supabase errors to the caller', async () => {
    const databaseError = new Error('permission denied');
    const mock = createSupabaseMock([], databaseError);
    sandbox.supabaseClient = mock.client;

    await assert.rejects(sandbox.testRepository.listEntries('2026-06-01'), error => error === databaseError);
});

test('catalogue search stays available without a database query', async () => {
    const foods = await sandbox.testRepository.searchFoods('broc');
    assert.deepEqual(Array.from(foods, food => food.name), ['Broccoli']);
});
