let fiveADaySelectedDate = '';
let fiveADayEditingId = null;

function fiveADaySetMessage(message, isError = false) {
    const target = $('fiveADayMessage');
    if (!target) return;
    target.textContent = message;
    target.className = `muted fiveaday-message${isError ? ' err' : ''}`;
}

function fiveADayFormatPortions(value) {
    return Number(value).toFixed(2).replace(/\.?0+$/, '');
}

function fiveADayUpdateManualFields() {
    const name = $('fiveADayFoodSearch').value.trim();
    const catalogueItem = findFiveADayCatalogueItem(name);
    const manual = !catalogueItem;
    $('fiveADayManualNameWrap').classList.toggle('hidden', !manual);
    $('fiveADayManualName').required = manual;
    $('fiveADayManualName').value = manual ? name : '';
    $('fiveADayCategory').disabled = Boolean(catalogueItem);

    if (catalogueItem) {
        $('fiveADayCategory').value = catalogueItem.category;
        $('fiveADayQuantity').value = catalogueItem.defaultQuantity;
        $('fiveADayUnit').value = catalogueItem.unit;
        $('fiveADayUnitLabel').textContent = catalogueItem.unit;
        $('fiveADayGuidance').textContent = catalogueItem.guidance;
    } else {
        $('fiveADayGuidance').textContent = 'Not in the catalogue: estimate and confirm the qualifying amount yourself.';
    }
    $('fiveADayQualifyingWeightWrap').classList.toggle('hidden', $('fiveADayCategory').value !== 'mixed_dish');
    fiveADayUpdatePreview();
}

function fiveADayUpdatePreview() {
    const category = $('fiveADayCategory').value;
    const quantity = Number($('fiveADayQuantity').value);
    const qualifyingWeight = Number($('fiveADayQualifyingWeight').value);
    const preview = calculateFiveADayEntryPortions({
        category,
        quantity,
        unit: $('fiveADayUnit').value,
        qualifying_weight_g: category === 'mixed_dish' ? qualifyingWeight : undefined,
        confirmed: true,
    });
    $('fiveADayContributionPreview').textContent = preview > 0
        ? `Estimated contribution: ${preview.toFixed(2)} portion${preview === 1 ? '' : 's'}.`
        : 'This amount does not add a portion. For mixed dishes, enter only the known fruit and vegetable weight.';
}

function fiveADaySetEditMode(entry) {
    fiveADayEditingId = entry?.id || null;
    $('fiveADayFormTitle').textContent = entry ? 'Edit food entry' : 'Add a food';
    $('fiveADaySave').textContent = entry ? 'Save changes for review' : 'Add for review';
    $('fiveADayCancelEdit').classList.toggle('hidden', !entry);
    if (entry) {
        const time = localDateTime(entry.consumed_at);
        $('fiveADayFoodSearch').value = entry.source === 'catalogue' ? entry.food_name : '';
        $('fiveADayManualName').value = entry.source === 'manual' ? entry.food_name : '';
        $('fiveADayManualNameWrap').classList.toggle('hidden', entry.source !== 'manual');
        $('fiveADayManualName').required = entry.source === 'manual';
        $('fiveADayCategory').value = entry.category;
        $('fiveADayCategory').disabled = entry.source === 'catalogue';
        $('fiveADayQuantity').value = entry.quantity;
        $('fiveADayUnit').value = entry.unit;
        $('fiveADayUnitLabel').textContent = entry.unit;
        $('fiveADayQualifyingWeight').value = entry.qualifying_weight_g ?? '';
        $('fiveADayEntryDate').value = entry.date;
        $('fiveADayTime').value = time.time;
        $('fiveADayGuidance').textContent = entry.source === 'manual'
            ? 'Manually estimated entry. Review the qualifying amount before confirming.'
            : (findFiveADayCatalogueItem(entry.food_name)?.guidance || '');
        $('fiveADayQualifyingWeightWrap').classList.toggle('hidden', entry.category !== 'mixed_dish');
        fiveADayUpdatePreview();
        const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        $('fiveADayForm').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' });
    } else {
        $('fiveADayForm').reset();
        $('fiveADayEntryDate').value = fiveADaySelectedDate;
        $('fiveADayTime').value = localDateTime(new Date()).time;
        $('fiveADayCategory').disabled = false;
        $('fiveADayManualName').required = false;
        $('fiveADayManualNameWrap').classList.add('hidden');
        $('fiveADayQualifyingWeightWrap').classList.add('hidden');
        $('fiveADayUnitLabel').textContent = 'g';
        $('fiveADayGuidance').textContent = '';
        $('fiveADayContributionPreview').textContent = '';
    }
}

function fiveADayRenderProgress(summary) {
    const percent = Math.min(100, summary.portions / FIVE_A_DAY_TARGET_PORTIONS * 100);
    const progress = $('fiveADayProgress');
    progress.setAttribute('aria-valuenow', String(Math.min(FIVE_A_DAY_TARGET_PORTIONS, summary.portions)));
    progress.setAttribute('aria-valuetext', `${fiveADayFormatPortions(summary.portions)} of ${FIVE_A_DAY_TARGET_PORTIONS} portions`);
    $('fiveADayProgressFill').style.width = `${percent}%`;
    $('fiveADayProgressCard').classList.toggle('fiveaday-target-reached', summary.reachedTarget);
    $('fiveADayCount').textContent = `${fiveADayFormatPortions(summary.portions)} of ${FIVE_A_DAY_TARGET_PORTIONS} portions`;
    $('fiveADayRemaining').textContent = summary.reachedTarget
        ? 'Five portions reached — more qualifying fruit and vegetables still count.'
        : `${fiveADayFormatPortions(summary.remaining)} portions to reach five.`;
    $('fiveADayMarkers').innerHTML = Array.from({ length: FIVE_A_DAY_TARGET_PORTIONS }, (_, index) =>
        `<span class="fiveaday-marker${summary.portions >= index + 1 ? ' is-filled' : ''}" aria-hidden="true">${summary.portions >= index + 1 ? '🍎' : '○'}</span>`
    ).join('');
    $('fiveADayMarkers').setAttribute('aria-label', `${Math.min(FIVE_A_DAY_TARGET_PORTIONS, Math.floor(summary.portions))} of 5 visual milestones reached`);
    $('fiveADayCategoryBreakdown').innerHTML = Object.entries(summary.byCategory)
        .filter(([, portions]) => portions > 0)
        .map(([category, portions]) => `<span class="fiveaday-category">${esc(FIVE_A_DAY_CATEGORY_LABELS[category])}: ${fiveADayFormatPortions(portions)}</span>`)
        .join('') || '<span class="muted">No confirmed portions yet.</span>';
}

function fiveADayRenderEntries(summary) {
    const target = $('fiveADayEntries');
    if (!summary.entries.length) {
        target.innerHTML = '<p class="muted fiveaday-empty">Nothing recorded for this day yet. Add a food below to start tracking.</p>';
        return;
    }

    target.innerHTML = summary.entries.map(entry => {
        const estimate = summary.entryContributions[entry.id] || 0;
        const status = entry.confirmed
            ? `<span class="fiveaday-status confirmed">Confirmed · ${fiveADayFormatPortions(estimate)} portion${estimate === 1 ? '' : 's'}</span>`
            : '<span class="fiveaday-status pending">Awaiting confirmation · not counted</span>';
        const amount = `${Number(entry.quantity)} ${entry.unit}`;
        const contribution = entry.category === 'mixed_dish'
            ? `${Number(entry.qualifying_weight_g || 0)}g qualifying produce`
            : amount;
        return `<article class="fiveaday-entry">
            <div class="fiveaday-entry-copy">
                <strong>${esc(entry.food_name)}</strong>
                <span class="muted">${esc(FIVE_A_DAY_CATEGORY_LABELS[entry.category] || entry.category)} · ${esc(contribution)} · ${esc(fmt(entry.consumed_at))}</span>
                ${entry.source === 'manual' ? '<span class="muted">Manual estimate</span>' : ''}
                ${status}
            </div>
            <div class="row fiveaday-entry-actions">
                ${entry.confirmed ? '' : `<button type="button" data-fiveaday-confirm="${esc(entry.id)}">Confirm</button>`}
                <button type="button" data-fiveaday-edit="${esc(entry.id)}">Edit</button>
                <button type="button" class="danger" data-fiveaday-delete="${esc(entry.id)}">Delete</button>
            </div>
        </article>`;
    }).join('');
}

async function fiveADayRender() {
    $('fiveADaySelectedDate').value = fiveADaySelectedDate;
    $('fiveADayEntryDate').value = fiveADaySelectedDate;
    let entries;
    try {
        entries = await fiveADayRepository.listEntries(fiveADaySelectedDate);
    } catch (error) {
        console.error('[5 A Day] Could not load entries:', error);
        fiveADaySetMessage(error.message || 'Could not load 5 A Day entries.', true);
        $('fiveADayEntries').textContent = error.message || 'Could not load 5 A Day entries.';
        $('fiveADayPendingNotice').classList.add('hidden');
        return;
    }
    const summary = summarizeFiveADayEntries(entries, fiveADaySelectedDate);
    fiveADayRenderProgress(summary);
    fiveADayRenderEntries(summary);
    $('fiveADayPendingNotice').classList.toggle('hidden', summary.pendingCount === 0);
    $('fiveADayPendingNotice').textContent = summary.pendingCount
        ? `${summary.pendingCount} unconfirmed entr${summary.pendingCount === 1 ? 'y is' : 'ies are'} excluded from your total.`
        : '';
}

async function fiveADaySubmit(event) {
    event.preventDefault();
    const catalogueItem = findFiveADayCatalogueItem($('fiveADayFoodSearch').value);
    const source = catalogueItem ? 'catalogue' : 'manual';
    const foodName = catalogueItem ? catalogueItem.name : $('fiveADayManualName').value.trim();
    const category = $('fiveADayCategory').value;
    const quantity = Number($('fiveADayQuantity').value);
    const unit = $('fiveADayUnit').value;
    const qualifyingWeight = category === 'mixed_dish' ? Number($('fiveADayQualifyingWeight').value) : null;

    if (!foodName || !Number.isFinite(quantity) || quantity <= 0 ||
        (unit === 'ml' && category !== 'juice_smoothie') ||
        (unit === 'g' && category === 'juice_smoothie') ||
        (category === 'mixed_dish' && (!Number.isFinite(qualifyingWeight) || qualifyingWeight < 0 || qualifyingWeight > quantity))) {
        fiveADaySetMessage('Enter a food, a positive amount, and only the known qualifying produce weight for a mixed dish.', true);
        return;
    }

    const consumedAt = localIso($('fiveADayEntryDate').value, $('fiveADayTime').value);
    const record = {
        date: $('fiveADayEntryDate').value,
        consumed_at: consumedAt,
        food_name: foodName,
        category,
        quantity,
        unit,
        qualifying_weight_g: qualifyingWeight,
        source,
        confirmed: false,
    };

    try {
        if (fiveADayEditingId) await fiveADayRepository.updateEntry(fiveADayEditingId, record);
        else await fiveADayRepository.addEntry(record);
        fiveADaySelectedDate = record.date;
        fiveADaySetEditMode(null);
        fiveADaySetMessage('Saved for review. Confirm the entry to include it in your total.');
        await fiveADayRender();
    } catch (error) {
        console.error('[5 A Day] Could not save entry:', error);
        fiveADaySetMessage('Could not save this entry. Please try again.', true);
    }
}

async function fiveADayHandleEntriesClick(event) {
    const confirmButton = event.target.closest('[data-fiveaday-confirm]');
    const editButton = event.target.closest('[data-fiveaday-edit]');
    const deleteButton = event.target.closest('[data-fiveaday-delete]');
    try {
        if (confirmButton) {
            await fiveADayRepository.updateEntry(confirmButton.dataset.fiveadayConfirm, { confirmed: true });
            fiveADaySetMessage('Entry confirmed and included in your total.');
        } else if (editButton) {
            const selected = (await fiveADayRepository.listEntries(fiveADaySelectedDate))
                .find(item => item.id === editButton.dataset.fiveadayEdit);
            if (!selected) throw new Error('5 A Day entry not found.');
            fiveADaySetEditMode(selected);
        } else if (deleteButton) {
            if (!confirm('Delete this 5 A Day entry?')) return;
            await fiveADayRepository.deleteEntry(deleteButton.dataset.fiveadayDelete);
            fiveADaySetMessage('Entry deleted.');
        } else {
            return;
        }
        await fiveADayRender();
    } catch (error) {
        console.error('[5 A Day] Entry action failed:', error);
        fiveADaySetMessage('Could not update this entry. Please try again.', true);
    }
}

function initFiveADayTracker() {
    fiveADaySelectedDate = dvFormatDate(new Date());
    $('fiveADayFoodSearch').setAttribute('list', 'fiveADayCatalogueOptions');
    $('fiveADayCatalogueOptions').innerHTML = FIVE_A_DAY_CATALOGUE
        .map(food => `<option value="${esc(food.name)}"></option>`).join('');
    $('fiveADayForm').addEventListener('submit', fiveADaySubmit);
    $('fiveADayFoodSearch').addEventListener('input', fiveADayUpdateManualFields);
    $('fiveADayFoodSearch').addEventListener('change', fiveADayUpdateManualFields);
    $('fiveADayCategory').addEventListener('change', () => {
        const isJuice = $('fiveADayCategory').value === 'juice_smoothie';
        $('fiveADayUnit').value = isJuice ? 'ml' : 'g';
        $('fiveADayUnitLabel').textContent = $('fiveADayUnit').value;
        $('fiveADayQualifyingWeightWrap').classList.toggle('hidden', $('fiveADayCategory').value !== 'mixed_dish');
        fiveADayUpdatePreview();
    });
    ['fiveADayQuantity', 'fiveADayUnit', 'fiveADayQualifyingWeight'].forEach(id =>
        $(id).addEventListener('input', fiveADayUpdatePreview)
    );
    $('fiveADayEntries').addEventListener('click', fiveADayHandleEntriesClick);
    $('fiveADaySelectedDate').addEventListener('change', async () => {
        fiveADaySelectedDate = $('fiveADaySelectedDate').value || dvFormatDate(new Date());
        fiveADaySetEditMode(null);
        await fiveADayRender();
    });
    $('fiveADayPrev').addEventListener('click', async () => {
        const date = dvParseDate(fiveADaySelectedDate);
        date.setDate(date.getDate() - 1);
        fiveADaySelectedDate = dvFormatDate(date);
        await fiveADayRender();
    });
    $('fiveADayNext').addEventListener('click', async () => {
        const date = dvParseDate(fiveADaySelectedDate);
        date.setDate(date.getDate() + 1);
        fiveADaySelectedDate = dvFormatDate(date);
        await fiveADayRender();
    });
    $('fiveADayToday').addEventListener('click', async () => {
        fiveADaySelectedDate = dvFormatDate(new Date());
        await fiveADayRender();
    });
    $('fiveADayCancelEdit').addEventListener('click', () => fiveADaySetEditMode(null));
    document.querySelector('.tab[data-tab="fiveaday"]').addEventListener('click', fiveADayRender);
    fiveADaySetEditMode(null);
    fiveADayRender();
}
