const APP_VERSION = '3.2.16';

const SUPABASE_KEY_STORAGE = 'gut_tracker_publishable_key';

function isLikelySupabasePublishableKey(value) {
    return /^sb_publishable_[A-Za-z0-9._-]+$/.test(value) || /^eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(value);
}

function getStoredSupabaseKey() {
    return localStorage.getItem(SUPABASE_KEY_STORAGE) || '';
}

function storeSupabaseKey(value) {
    localStorage.setItem(SUPABASE_KEY_STORAGE, value);
}

function clearStoredSupabaseKey() {
    localStorage.removeItem(SUPABASE_KEY_STORAGE);
}
