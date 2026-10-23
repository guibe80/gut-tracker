/* Review-first natural-language food and hydration logging UI. */
let aiFoodAnalysis = null;
let aiFoodRequestId = null;

function aiFoodInputId(prefix, index, key) { return `${prefix}-${index}-${key}`; }

function renderAiFoodReview(summaryText) {
    const review = $('aiFoodReview');
    const text = normaliseAiFoodSummary(summaryText);
    const content = esc(text || 'No summary was returned.').replace(/\n/g, '<br>');
    review.innerHTML = `
        <div class="authmsg ok">
            <strong>AI review</strong>
            <p>${content}</p>
        </div>
        <p class="muted">Use this as a rough guide and enter the values manually in the meal form before saving.</p>
        <div class="row" style="margin-top:10px">
            <button type="button" class="primary" id="aiFoodPopulate">Use in meal form</button>
            <button type="button" id="aiFoodClearReview">Clear</button>
        </div>
    `;
    review.classList.remove('hidden');

    $('aiFoodPopulate')?.addEventListener('click', () => {
        const notes = $('fn');
        if (notes) {
            const current = notes.value.trim();
            notes.value = current ? `${current}\n\n${text}` : text;
        }
        setMsg('aiFoodMsg', 'The AI summary has been added to the meal notes for manual review.', 'ok');
    });

    $('aiFoodClearReview')?.addEventListener('click', () => {
        review.classList.add('hidden');
        review.innerHTML = '';
        setMsg('aiFoodMsg', 'AI review cleared. You can try a different description.', 'ok');
    });
}

function initAiFoodLogging() {
    $('aiFoodAnalyse')?.addEventListener('click', async () => {
        try {
            setMsg('aiFoodMsg', 'Analysing your entry…');
            aiFoodAnalysis = await analyseFoodLogText($('aiFoodText').value);
            renderAiFoodReview(aiFoodAnalysis);
            setMsg('aiFoodMsg', 'Review the summary and enter the values manually in the meal form.', 'ok');
        } catch (error) { setMsg('aiFoodMsg', error.message || 'Could not analyse that entry.', 'err'); }
    });
}
