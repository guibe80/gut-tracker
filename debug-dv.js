const fs = require('fs');
const path = require('path');
const vm = require('vm');

const filesToLoad = [
    path.resolve(__dirname, 'utils/datetime.js'),
    path.resolve(__dirname, 'utils/supabase-helpers.js'),
    path.resolve(__dirname, 'utils/validation.js'),
    path.resolve(__dirname, 'utils/html.js'),
    path.resolve(__dirname, 'utils/data-mapping.js'),
    path.resolve(__dirname, 'services/data-service.js'),
    path.resolve(__dirname, 'ui/dayview-renderer.js'),
];

const code = filesToLoad.map(f => fs.readFileSync(f, 'utf8')).join('\n');
const sandbox = {
    confirm: () => true,
    $: (id) => ({ value: '', innerHTML: '', textContent: '', classList: { add: () => {}, remove: () => {} } }),
    document: { querySelector: () => null, querySelectorAll: () => [], addEventListener: () => {} },
    window: {},
    console,
};
vm.createContext(sandbox);
vm.runInContext(code, sandbox);

sandbox.dvState = { date: '2025-01-15', toggles: { food: true, glucose: true, gut: true, bowel: true, weight: true }, data: null, loading: false };

const data = {
    meals: [{ id: 1, meal_time: '2025-01-15T08:00:00.000Z', meal_type: 'breakfast', estimated_carbohydrate_g: 50, notes: 'notes' }],
    mealFoods: [{ meal_id: 1, food_name: 'oats' }],
    glucose: [], symptoms: [], bowels: [], weights: []
};

sandbox.data = data;

// Debug from inside VM
const debugCode = `
(function() {
    try {
        const ds = dvDayStart(dvState.date);
        const de = dvDayEnd(dvState.date);
        const dayStart = ds.getTime();
        const dayEnd = de.getTime();
        const filter = e => { const t = new Date(e.t).getTime(); return t >= dayStart && t <= dayEnd; };
        const mapped = data.meals.map(x => ({ type: 'food', t: x.meal_time, tz: parseTzNotes(x.notes), detail: data.mealFoods.filter(f => f.meal_id === x.id).map(f => f.food_name).filter(Boolean).join(', '), value: x.estimated_carbohydrate_g || 0 }));
        const filtered = mapped.filter(filter);
        return JSON.stringify({ dayStart, dayEnd, mapped: mapped.length, filtered: filtered.length, eventTime: new Date('2025-01-15T08:00:00.000Z').getTime() });
    } catch(e) {
        return JSON.stringify({ error: e.message, stack: e.stack });
    }
})();
`;

const debug = vm.runInContext(debugCode, sandbox);
console.log('debug:', debug);

// Now call the actual function
const events = sandbox.dvGetEvents(data, 'food');
console.log('dvGetEvents result:', events.length);
