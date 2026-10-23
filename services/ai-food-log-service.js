/* Authenticated Edge Function orchestration and atomic journal persistence. */
async function analyseFoodLogText(text) {
    if (!user || !supabaseClient) throw new Error('Sign in before using AI analysis.');
    if (!String(text || '').trim()) throw new Error('Describe what you ate or drank first.');
    const { data, error } = await supabaseClient.functions.invoke('analyse-food-log', { body: { text: String(text).trim() } });
    if (error) throw new Error(error.message || 'The analysis service is unavailable.');
    const check = validateAiFoodResponse(data);
    if (!check.valid) throw new Error(`The analysis could not be used: ${check.error}`);
    return data;
}

async function saveAiFoodLog(response, text, occurredAt, requestId) {
    if (!user || !supabaseClient) throw new Error('Sign in before saving.');
    const payload = createAiFoodSavePayload(response, text, occurredAt, requestId);
    const { data, error } = await supabaseClient.rpc('save_ai_food_log', payload);
    if (error) throw error;
    await load();
    return Array.isArray(data) ? data[0] : data;
}
