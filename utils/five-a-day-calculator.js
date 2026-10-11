const FIVE_A_DAY_TARGET_PORTIONS = 5;
const FIVE_A_DAY_PORTION_GRAMS = 80;
const FIVE_A_DAY_DRIED_PORTION_GRAMS = 30;
const FIVE_A_DAY_JUICE_PORTION_ML = 150;

const FIVE_A_DAY_CATEGORY_LABELS = {
    fruit: 'Fruit',
    vegetable: 'Vegetables',
    beans_pulses: 'Beans and pulses',
    dried_fruit: 'Dried fruit',
    juice_smoothie: 'Juice and smoothies',
    mixed_dish: 'Mixed dishes',
    excluded: 'Does not count',
};

function calculateFiveADayEntryPortions(entry) {
    if (!entry || !entry.confirmed) return 0;

    const quantity = Number(entry.quantity);
    const qualifyingWeight = entry.category === 'mixed_dish'
        ? Number(entry.qualifying_weight_g)
        : entry.qualifying_weight_g == null
        ? quantity
        : Number(entry.qualifying_weight_g);

    if (entry.category === 'juice_smoothie') {
        if (entry.unit !== 'ml' || !Number.isFinite(quantity) || quantity <= 0) return 0;
        return quantity / FIVE_A_DAY_JUICE_PORTION_ML;
    }
    if (entry.category === 'dried_fruit') {
        return entry.unit === 'g' && Number.isFinite(qualifyingWeight) && qualifyingWeight > 0
            ? qualifyingWeight / FIVE_A_DAY_DRIED_PORTION_GRAMS
            : 0;
    }
    if (entry.category === 'fruit' || entry.category === 'vegetable' ||
        entry.category === 'beans_pulses' || entry.category === 'mixed_dish') {
        return entry.unit === 'g' && Number.isFinite(qualifyingWeight) && qualifyingWeight > 0
            ? qualifyingWeight / FIVE_A_DAY_PORTION_GRAMS
            : 0;
    }
    return 0;
}

function summarizeFiveADayEntries(entries, dateKey) {
    const dayEntries = (entries || []).filter(entry => entry.date === dateKey);
    const confirmedEntries = dayEntries.filter(entry => entry.confirmed)
        .slice()
        .sort((left, right) => new Date(left.consumed_at) - new Date(right.consumed_at));
    const rawByCategory = {
        fruit: 0,
        vegetable: 0,
        beans_pulses: 0,
        dried_fruit: 0,
        juice_smoothie: 0,
        mixed_dish: 0,
    };
    const entryContributions = {};

    for (const entry of confirmedEntries) {
        const category = entry.category;
        if (!Object.prototype.hasOwnProperty.call(rawByCategory, category)) continue;
        const rawContribution = calculateFiveADayEntryPortions(entry);
        if (category === 'beans_pulses' || category === 'juice_smoothie') {
            const remainingDailyAllowance = Math.max(0, 1 - rawByCategory[category]);
            entryContributions[entry.id] = Math.min(rawContribution, remainingDailyAllowance);
        } else {
            entryContributions[entry.id] = rawContribution;
        }
        rawByCategory[category] += entryContributions[entry.id];
    }

    const byCategory = {
        fruit: rawByCategory.fruit,
        vegetable: rawByCategory.vegetable,
        beans_pulses: Math.min(1, rawByCategory.beans_pulses),
        dried_fruit: rawByCategory.dried_fruit,
        juice_smoothie: Math.min(1, rawByCategory.juice_smoothie),
        mixed_dish: rawByCategory.mixed_dish,
    };
    const portions = Object.values(byCategory).reduce((total, amount) => total + amount, 0);

    return {
        date: dateKey,
        portions,
        target: FIVE_A_DAY_TARGET_PORTIONS,
        remaining: Math.max(0, FIVE_A_DAY_TARGET_PORTIONS - portions),
        reachedTarget: portions >= FIVE_A_DAY_TARGET_PORTIONS,
        byCategory,
        confirmedCount: confirmedEntries.length,
        pendingCount: dayEntries.length - confirmedEntries.length,
        entries: dayEntries,
        entryContributions,
    };
}
