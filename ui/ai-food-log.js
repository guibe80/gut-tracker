/* Review-first natural-language food and hydration logging UI. */
let aiFoodAnalysis = null;
let aiFoodRequestId = null;

function aiFoodInputId(prefix, index, key) { return `${prefix}-${index}-${key}`; }

function renderAiFoodReview(response) {
    const review = $('aiFoodReview');
    const allItems = [...response.ingredients.map(item => ({ ...item, kind: 'food' })), ...response.drinks.map(item => ({ ...item, kind: 'drink' }))];
    const rows = allItems.map((item, index) => `<tr data-ai-kind="${item.kind}"><td><input data-ai-key="name" value="${esc(item.name)}" aria-label="Item name"></td><td><input data-ai-key="quantity" type="number" min="0" step="any" value="${item.quantity ?? ''}" aria-label="Quantity"></td><td><input data-ai-key="unit" value="${esc(item.unit || '')}" aria-label="Unit"></td><td><input data-ai-key="carbohydrates_g" type="number" min="0" step="any" value="${item.carbohydrates_g ?? ''}" aria-label="Carbohydrates grams"></td><td><input data-ai-key="protein_g" type="number" min="0" step="any" value="${item.protein_g ?? ''}" aria-label="Protein grams"></td><td><input data-ai-key="fibre_g" type="number" min="0" step="any" value="${item.fibre_g ?? ''}" aria-label="Fibre grams"></td><td>${item.kind === 'drink' && item.is_plain_water ? 'Plain water' : '—'}</td></tr>`).join('');
    const questions = (response.clarification_questions || []).map(question => `<li>${esc(question)}</li>`).join('');
    review.innerHTML = `<p class="muted">Estimates only — review and edit before saving. Nutrient estimates are not medical advice.</p>${questions ? `<div class="authmsg err"><strong>Clarification needed</strong><ul>${questions}</ul></div>` : ''}<div class="table-wrap"><table><thead><tr><th>Item</th><th>Amount</th><th>Unit</th><th>Carbs (g)</th><th>Protein (g)</th><th>Fibre (g)</th><th>Hydration</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">${esc(response.diabetes_indicators?.explanation || 'Glucose responses vary between individuals.')} </p><button type="button" class="primary" id="aiFoodSave" ${response.needs_clarification ? 'disabled' : ''}>Save to journal</button>`;
    review.classList.remove('hidden');
    $('aiFoodSave')?.addEventListener('click', saveAiFoodReview);
}

function applyAiFoodEdits() {
    let foodIndex = 0, drinkIndex = 0;
    document.querySelectorAll('#aiFoodReview tbody tr').forEach(row => {
        const target = row.dataset.aiKind === 'food' ? aiFoodAnalysis.ingredients[foodIndex++] : aiFoodAnalysis.drinks[drinkIndex++];
        row.querySelectorAll('[data-ai-key]').forEach(input => {
            const key = input.dataset.aiKey;
            target[key] = ['quantity', 'carbohydrates_g', 'protein_g', 'fibre_g'].includes(key) ? (input.value === '' ? null : Number(input.value)) : input.value;
        });
    });
    aiFoodAnalysis.totals = calculateAiTotals(aiFoodAnalysis.ingredients);
}

async function saveAiFoodReview() {
    try {
        applyAiFoodEdits();
        const now = new Date();
        const occurredAt = localIso($('fd').value || now.toISOString().slice(0, 10), $('ft').value || now.toTimeString().slice(0, 5));
        const result = await saveAiFoodLog(aiFoodAnalysis, $('aiFoodText').value, occurredAt, aiFoodRequestId);
        setMsg('aiFoodMsg', `Saved to journal${result?.meal_id ? '.' : ''}`, 'ok');
        $('aiFoodReview').classList.add('hidden');
        aiFoodAnalysis = null;
    } catch (error) { setMsg('aiFoodMsg', error.message || 'Could not save the analysis.', 'err'); }
}

function initAiFoodLogging() {
    $('aiFoodAnalyse')?.addEventListener('click', async () => {
        try {
            setMsg('aiFoodMsg', 'Analysing your entry…');
            aiFoodAnalysis = await analyseFoodLogText($('aiFoodText').value);
            aiFoodRequestId = crypto.randomUUID();
            renderAiFoodReview(aiFoodAnalysis);
            setMsg('aiFoodMsg', 'Review the estimates before saving.', 'ok');
        } catch (error) { setMsg('aiFoodMsg', error.message || 'Could not analyse that entry.', 'err'); }
    });
}
