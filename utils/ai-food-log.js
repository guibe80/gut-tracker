/* Pure contract checks and calculations for AI food/drink analysis. */
const AI_NUTRIENTS = ['calories_kcal', 'carbohydrates_g', 'protein_g', 'fibre_g', 'sugars_g', 'fat_g'];

function aiNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const number = Number(value);
    return Number.isFinite(number) && number >= 0 && number <= 100000 ? number : null;
}

function normaliseAiFoodSummary(response) {
    if (typeof response === 'string') return response.trim();
    if (response && typeof response === 'object') {
        const values = [
            response.summary,
            response.text,
            response.analysis,
            response.message,
            response.data && response.data.summary,
            response.data && response.data.text,
            response.data && response.data.analysis
        ];
        for (const value of values) {
            if (typeof value === 'string' && value.trim()) return value.trim();
        }
    }
    return '';
}

function calculateAiTotals(items) {
    return (items || []).reduce((totals, item) => {
        AI_NUTRIENTS.forEach(key => { totals[key] += aiNumber(item[key]) || 0; });
        return totals;
    }, Object.fromEntries(AI_NUTRIENTS.map(key => [key, 0])));
}

function aiTotalsConsistent(response, tolerance = 1) {
    const calculated = calculateAiTotals(response.ingredients);
    return AI_NUTRIENTS.every(key => response.totals?.[key] == null || Math.abs(calculated[key] - Number(response.totals[key])) <= tolerance);
}

function validateAiFoodResponse(response) {
    if (!response || typeof response !== 'object') return { valid: false, error: 'Analysis was not an object.' };
    if (!['success', 'needs_clarification'].includes(response.status)) return { valid: false, error: 'Analysis status is invalid.' };
    if (!['meal', 'drink', 'mixed'].includes(response.entry_type)) return { valid: false, error: 'Analysis entry type is invalid.' };
    if (!Array.isArray(response.ingredients) || !Array.isArray(response.drinks) || !response.totals) return { valid: false, error: 'Analysis is missing required lists or totals.' };
    for (const item of [...response.ingredients, ...response.drinks]) {
        if (!item || typeof item.name !== 'string' || !item.name.trim()) return { valid: false, error: 'Every item needs a name.' };
        if (item.quantity != null && aiNumber(item.quantity) === null) return { valid: false, error: 'An item has an invalid quantity.' };
        for (const key of AI_NUTRIENTS) if (item[key] != null && aiNumber(item[key]) === null) return { valid: false, error: `An item has an invalid ${key}.` };
    }
    if (!aiTotalsConsistent(response)) return { valid: false, error: 'Meal totals do not match the ingredient estimates.' };
    const unmeasuredWater = response.drinks.some(drink => drink.is_plain_water && !(aiNumber(drink.quantity) > 0) || drink.is_plain_water && drink.unit !== 'ml');
    if (unmeasuredWater) return { valid: false, error: 'Plain water needs a positive millilitre amount before it can be saved.' };
    return { valid: true };
}

function createAiFoodSavePayload(response, input, occurredAt, requestId) {
    const check = validateAiFoodResponse(response);
    if (!check.valid) throw new Error(check.error);
    const totals = calculateAiTotals(response.ingredients);
    return {
        p_request_id: requestId,
        p_meal: {
            meal_time: occurredAt,
            meal_type: response.entry_type === 'drink' ? 'drink' : 'other',
            notes: `AI estimate — ${String(input).trim()}`.slice(0, 4000),
            estimated_carbohydrate_g: totals.carbohydrates_g,
            protein_estimate_g: totals.protein_g,
            fibre_estimate_g: totals.fibre_g,
            estimated_calories_kcal: totals.calories_kcal,
            estimated_sugars_g: totals.sugars_g,
            estimated_fat_g: totals.fat_g,
            ai_assumptions: response.assumptions || []
        },
        p_ingredients: response.ingredients.map(item => ({
            food_name: item.name.trim(), portion: aiNumber(item.quantity), portion_unit: item.unit || null,
            estimated_carbohydrate_g: aiNumber(item.carbohydrates_g), estimated_fibre_g: aiNumber(item.fibre_g),
            estimated_calories_kcal: aiNumber(item.calories_kcal), protein_estimate_g: aiNumber(item.protein_g),
            sugars_g: aiNumber(item.sugars_g), fat_g: aiNumber(item.fat_g),
            notes: [item.estimation_method, ...(item.assumptions || [])].filter(Boolean).join(' · ') || null
        })),
        p_water_amounts: response.drinks.filter(drink => drink.is_plain_water).map(drink => Math.round(Number(drink.quantity)))
    };
}
