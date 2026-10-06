// Unit tests for services/data-service.js
// Run: node --test tests/unit/data-service.test.js
//
// Tests the extractable pure logic in insertWithSchemaFallback and
// updateWithSchemaFallback by mocking supabaseClient and the global
// helpers (isNetworkError, wait, missingColumn).

const { test, describe, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Load all dependency scripts into the VM context so globals are available
const filesToLoad = [
    path.resolve(__dirname, '../../utils/supabase-helpers.js'),
    path.resolve(__dirname, '../../utils/validation.js'),
    path.resolve(__dirname, '../../utils/html.js'),
    path.resolve(__dirname, '../../utils/data-mapping.js'),
    path.resolve(__dirname, '../../services/data-service.js'),
];

const code = filesToLoad.map(f => fs.readFileSync(f, 'utf8')).join('\n');

const sandbox = {
    // DOM stub
    confirm: () => true,
    // Globals that data-service.js expects to find on the global scope
    page: {},
    pageSize: {},
    totals: {},
    setSync: () => {},
    setMsg: () => {},
    render: () => {},
    editState: null,
    setFormMode: () => {},
    // These will be populated per-test
    supabaseClient: null,
    user: { id: 'test-user-id' },
    meals: [], glucose: [], symptoms: [], bowels: [], weights: [], mealFoods: [],
    // isNetworkError, wait, missingColumn come from supabase-helpers.js
    console,
};

vm.createContext(sandbox);
vm.runInContext(code, sandbox);

describe('insertWithSchemaFallback', () => {
    let supabaseClient;

    beforeEach(() => {
        supabaseClient = {
            from: () => ({
                insert: () => ({ select: () => ({ single: async () => { throw new Error('not mocked'); } }) }),
            }),
        };
        sandbox.supabaseClient = supabaseClient;
        sandbox.page = { meals: 0, glucose: 0, symptoms: 0, bowels: 0, weights: 0 };
        sandbox.pageSize = { meals: 10, glucose: 10, symptoms: 10, bowels: 10, weights: 10 };
        sandbox.totals = { meals: 0, glucose: 0, symptoms: 0, bowels: 0, weights: 0 };
    });

    test('returns data on successful insert', async () => {
        const mockData = { id: 1, meal_time: '2025-01-01', meal_type: 'breakfast' };
        sandbox.supabaseClient = {
            from: () => ({
                insert: () => ({
                    select: () => ({
                        single: async () => ({ data: mockData, error: null }),
                    }),
                }),
            }),
        };

        const result = await sandbox.insertWithSchemaFallback('meals', {
            meal_time: '2025-01-01', meal_type: 'breakfast'
        });
        assert.strictEqual(result, mockData);
    });

    test('falls back meal_type to other on check constraint error', async () => {
        let callCount = 0;
        const fallbackError = {
            message: 'invalid input value for enum "meals_meal_type_check"...',
        };
        sandbox.supabaseClient = {
            from: () => ({
                insert: (payload) => ({
                    select: () => ({
                        single: async () => {
                            callCount++;
                            if (callCount === 1) {
                                return { data: null, error: fallbackError };
                            }
                            // Return data reflecting what the function built
                            return { data: { id: 1, meal_type: payload.meal_type, notes: payload.notes }, error: null };
                        },
                    }),
                }),
            }),
        };

        const result = await sandbox.insertWithSchemaFallback('meals', {
            meal_time: '2025-01-01', meal_type: 'bad_type', notes: 'original notes'
        });
        assert.strictEqual(result.meal_type, 'other');
        assert.ok(result.notes.includes('Original meal type: bad_type'));
        assert.ok(result.notes.includes('original notes'));
    });

    test('strips unknown column on missing column error', async () => {
        let callCount = 0;
        const fallbackError = {
            message: "Could not find the 'unknown_col' column of 'meals' in the schema cache"
        };
        sandbox.supabaseClient = {
            from: () => ({
                insert: (payload) => ({
                    select: () => ({
                        single: async () => {
                            callCount++;
                            if (callCount === 1) {
                                return { data: null, error: fallbackError };
                            }
                            return { data: { id: 1 }, error: null };
                        },
                    }),
                }),
            }),
        };

        const result = await sandbox.insertWithSchemaFallback('meals', {
            meal_time: '2025-01-01', unknown_col: 'should-be-stripped'
        });
        assert.strictEqual(result.id, 1);
    });

    test('throws after exhausting all fallback attempts', async () => {
        const missingColError = {
            message: "Could not find the 'col1' column of 'meals' in the schema cache"
        };
        const persistentError = {
            message: 'some other persistent error'
        };
        let callCount = 0;
        sandbox.supabaseClient = {
            from: () => ({
                insert: () => ({
                    select: () => ({
                        single: async () => {
                            callCount++;
                            if (callCount === 1) {
                                return { data: null, error: missingColError };
                            }
                            return { data: null, error: persistentError };
                        },
                    }),
                }),
            }),
        };

        await assert.rejects(
            () => sandbox.insertWithSchemaFallback('meals', { col1: 1, col2: 2 }),
            (err) => {
                const msg = err?.message || String(err);
                return msg.includes('some other persistent error');
            }
        );
    });

    test('retries on network errors then succeeds', async () => {
        let callCount = 0;
        const networkError = new Error('network request failed');
        // Override isNetworkError to return true for our error
        const originalIsNetworkError = sandbox.isNetworkError;
        sandbox.isNetworkError = () => true;
        // Override wait to be instant
        sandbox.wait = async () => {};

        try {
            sandbox.supabaseClient = {
                from: () => ({
                    insert: () => ({
                        select: () => ({
                            single: async () => {
                                callCount++;
                                if (callCount < 3) {
                                    throw networkError;
                                }
                                return { data: { id: 1 }, error: null };
                            },
                        }),
                    }),
                }),
            };

            const result = await sandbox.insertWithSchemaFallback('meals', { meal_time: '2025-01-01' });
            assert.strictEqual(result.id, 1);
            assert.strictEqual(callCount, 3);
        } finally {
            sandbox.isNetworkError = originalIsNetworkError;
            sandbox.wait = (ms) => new Promise(r => setTimeout(r, ms));
        }
    });

    test('propagates non-network errors immediately', async () => {
        const realError = new Error('real database constraint violation');
        sandbox.supabaseClient = {
            from: () => ({
                insert: () => ({
                    select: () => ({
                        single: async () => { throw realError; },
                    }),
                }),
            }),
        };

        await assert.rejects(
            () => sandbox.insertWithSchemaFallback('meals', { meal_time: '2025-01-01' }),
            /real database constraint violation/
        );
    });
});

describe('updateWithSchemaFallback', () => {
    beforeEach(() => {
        sandbox.page = { meals: 0, glucose: 0, symptoms: 0, bowels: 0, weights: 0 };
        sandbox.pageSize = { meals: 10, glucose: 10, symptoms: 10, bowels: 10, weights: 10 };
        sandbox.totals = { meals: 0, glucose: 0, symptoms: 0, bowels: 0, weights: 0 };
        sandbox.user = { id: 'test-user-id' };
    });

    test('returns data on successful update', async () => {
        const mockData = { id: 1, meal_type: 'updated_type' };
        sandbox.supabaseClient = {
            from: () => ({
                update: () => ({
                    eq: () => ({
                        eq: () => ({
                            select: () => ({
                                single: async () => ({ data: mockData, error: null }),
                            }),
                        }),
                    }),
                }),
            }),
        };

        const result = await sandbox.updateWithSchemaFallback('meals', 1, { meal_type: 'updated_type' });
        assert.strictEqual(result, mockData);
    });

    test('strips unknown column on missing column error', async () => {
        let callCount = 0;
        const fallbackError = {
            message: "Could not find the 'unknown_col' column of 'meals' in the schema cache"
        };
        sandbox.supabaseClient = {
            from: () => ({
                update: (payload) => ({
                    eq: () => ({
                        eq: () => ({
                            select: () => ({
                                single: async () => {
                                    callCount++;
                                    if (callCount === 1) {
                                        return { data: null, error: fallbackError };
                                    }
                                    return { data: { id: 1 }, error: null };
                                },
                            }),
                        }),
                    }),
                }),
            }),
        };

        const result = await sandbox.updateWithSchemaFallback('meals', 1, {
            meal_type: 'breakfast', unknown_col: 'should-be-stripped'
        });
        assert.strictEqual(result.id, 1);
    });

    test('throws after exhausting all fallback attempts', async () => {
        const missingColError = {
            message: "Could not find the 'col1' column of 'meals' in the schema cache"
        };
        const persistentError = {
            message: 'some other persistent error'
        };
        let callCount = 0;
        sandbox.supabaseClient = {
            from: () => ({
                update: () => ({
                    eq: () => ({
                        eq: () => ({
                            select: () => ({
                                single: async () => {
                                    callCount++;
                                    if (callCount === 1) {
                                        return { data: null, error: missingColError };
                                    }
                                    return { data: null, error: persistentError };
                                },
                            }),
                        }),
                    }),
                }),
            }),
        };

        await assert.rejects(
            () => sandbox.updateWithSchemaFallback('meals', 1, { col1: 1, col2: 2 }),
            (err) => {
                const msg = err?.message || String(err);
                return msg.includes('some other persistent error');
            }
        );
    });
});

describe('loadPage', () => {
    beforeEach(() => {
        sandbox.page = { meals: 0 };
        sandbox.pageSize = { meals: 10 };
        sandbox.totals = { meals: 0 };
    });

    test('fetches data and sets totals', async () => {
        const mockData = [{ id: 1 }, { id: 2 }];
        sandbox.supabaseClient = {
            from: () => ({
                select: () => ({
                    order: () => ({
                        range: async () => ({ data: mockData, count: 25, error: null }),
                    }),
                }),
            }),
        };

        const result = await sandbox.loadPage('meals', 'meal_time', 'meals');
        assert.deepEqual(result, mockData);
        assert.strictEqual(sandbox.totals.meals, 25);
    });

    test('throws on error', async () => {
        sandbox.supabaseClient = {
            from: () => ({
                select: () => ({
                    order: () => ({
                        range: async () => ({ data: null, error: new Error('fetch failed') }),
                    }),
                }),
            }),
        };

        await assert.rejects(
            () => sandbox.loadPage('meals', 'meal_time', 'meals'),
            /fetch failed/
        );
    });
});

describe('loadGlucose', () => {
    beforeEach(() => {
        sandbox.page = { glucose: 0 };
        sandbox.pageSize = { glucose: 10 };
        sandbox.totals = { glucose: 0 };
    });

    test('returns data on success', async () => {
        const mockData = [{ id: 1, glucose_mmol_l: 5.2 }];
        sandbox.supabaseClient = {
            from: () => ({
                select: () => ({
                    order: () => ({
                        range: async () => ({ data: mockData, count: 1, error: null }),
                    }),
                }),
            }),
        };

        const result = await sandbox.loadGlucose();
        assert.deepEqual(result, mockData);
        assert.strictEqual(sandbox.totals.glucose, 1);
    });

    test('returns empty array when glucose_readings table does not exist', async () => {
        sandbox.supabaseClient = {
            from: () => ({
                select: () => ({
                    order: () => ({
                        range: async () => ({
                            data: null,
                            count: null,
                            error: { message: 'relation "glucose_readings" does not exist' },
                        }),
                    }),
                }),
            }),
        };

        const result = await sandbox.loadGlucose();
        assert.deepEqual(result, []);
        assert.strictEqual(sandbox.totals.glucose, 0);
    });
});

describe('loadWeights', () => {
    beforeEach(() => {
        sandbox.page = { weights: 0 };
        sandbox.pageSize = { weights: 10 };
        sandbox.totals = { weights: 0 };
    });

    test('returns empty array when weight_entries table does not exist', async () => {
        sandbox.supabaseClient = {
            from: () => ({
                select: () => ({
                    order: () => ({
                        range: async () => ({
                            data: null,
                            count: null,
                            error: { message: 'relation "weight_entries" does not exist' },
                        }),
                    }),
                }),
            }),
        };

        const result = await sandbox.loadWeights();
        assert.deepEqual(result, []);
        assert.strictEqual(sandbox.totals.weights, 0);
    });
});

describe('save', () => {
    beforeEach(() => {
        sandbox.editState = null;
        sandbox.page = { meals: 0, glucose: 0, symptoms: 0, bowels: 0, weights: 0 };
        sandbox.pageSize = { meals: 10, glucose: 10, symptoms: 10, bowels: 10, weights: 10 };
        sandbox.totals = { meals: 0, glucose: 0, symptoms: 0, bowels: 0, weights: 0 };
        sandbox.user = { id: 'test-user-id' };
    });

    test('calls insertWithSchemaFallback for new records', async () => {
        const mockData = { id: 42 };
        sandbox.supabaseClient = {
            from: () => ({
                insert: () => ({
                    select: () => ({
                        single: async () => ({ data: mockData, error: null }),
                    }),
                }),
            }),
        };
        sandbox.load = async () => {};

        const result = await sandbox.save('meals', { meal_time: '2025-01-01', meal_type: 'breakfast' }, 'fs');
        assert.strictEqual(result.id, 42);
    });

    test('calls updateWithSchemaFallback when editState matches table', async () => {
        sandbox.editState = { table: 'meals', id: 5 };
        const mockData = { id: 5, meal_type: 'updated' };
        sandbox.supabaseClient = {
            from: () => ({
                update: () => ({
                    eq: () => ({
                        eq: () => ({
                            select: () => ({
                                single: async () => ({ data: mockData, error: null }),
                            }),
                        }),
                    }),
                }),
            }),
        };
        sandbox.load = async () => {};

        const result = await sandbox.save('meals', { meal_type: 'updated' }, 'fs');
        assert.strictEqual(result.id, 5);
    });
});

describe('saveSilent', () => {
    beforeEach(() => {
        sandbox.page = { meals: 0 };
        sandbox.pageSize = { meals: 10 };
        sandbox.totals = { meals: 0 };
        sandbox.user = { id: 'test-user-id' };
    });

    test('inserts without calling setMsg', async () => {
        const mockData = { id: 99 };
        let msgCalled = false;
        sandbox.supabaseClient = {
            from: () => ({
                insert: () => ({
                    select: () => ({
                        single: async () => ({ data: mockData, error: null }),
                    }),
                }),
            }),
        };
        sandbox.setMsg = () => { msgCalled = true; };

        const result = await sandbox.saveSilent('meal_foods', { meal_id: 1, food_name: 'test' });
        assert.strictEqual(result.id, 99);
        assert.strictEqual(msgCalled, false);
    });
});

describe('deleteEntry', () => {
    beforeEach(() => {
        sandbox.page = { meals: 0 };
        sandbox.pageSize = { meals: 10 };
        sandbox.totals = { meals: 0 };
        sandbox.user = { id: 'test-user-id' };
        sandbox.confirm = () => true;
        sandbox.load = async () => {};
    });

    test('deletes meal_foods first when deleting a meal', async () => {
        let foodDeleted = false;
        sandbox.supabaseClient = {
            from: (table) => ({
                select: () => ({
                    order: () => ({
                        range: async () => ({ data: [], error: null }),
                    }),
                }),
                delete: () => ({
                    eq: (col, val) => {
                        if (table === 'meal_foods' && col === 'meal_id') foodDeleted = true;
                        return {
                            eq: () => ({
                                select: () => ({
                                    single: async () => ({ data: { id: 1 }, error: null }),
                                }),
                            }),
                            range: async () => ({ data: [], error: null }),
                            then: (resolve) => resolve({ data: [], error: null }),
                        };
                    },
                }),
            }),
        };

        await sandbox.deleteEntry('meals', 1);
        assert.strictEqual(foodDeleted, true);
    });

    test('returns early if no id provided', async () => {
        let fromCalled = false;
        sandbox.supabaseClient = {
            from: () => { fromCalled = true; return { delete: () => ({ eq: () => ({ eq: () => ({}) }) }) }; },
        };

        await sandbox.deleteEntry('meals', null);
        assert.strictEqual(fromCalled, false);
    });
});
