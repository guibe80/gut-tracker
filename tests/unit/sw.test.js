// Unit tests for sw.js — service worker caching, versioning, and compatibility rewriting.
// Run: node --test tests/unit/sw.test.js
//
// Tests the install handler (asset caching), activate handler (old cache cleanup),
// fetch handler (app-shell network-first, cache-first for static assets),
// and the appResponse compatibility patching logic.

const { test, describe } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

// Mock Response (minimal) — defined at module level so both sandbox and tests can use it
class MockResponse {
    constructor(body, opts = {}) {
        this.body = body;
        this.status = opts.status || 200;
        this.statusText = opts.statusText || 'OK';
        this.headers = opts.headers || {};
        this._bodyText = typeof body === 'string' ? body : '';
    }
    async text() { return this._bodyText; }
    clone() { return new MockResponse(this.body, { status: this.status, statusText: this.statusText, headers: this.headers }); }
}

// Load version.js to get APP_VERSION
const versionCode = fs.readFileSync(path.resolve(__dirname, '../../version.js'), 'utf8');
const APP_VERSION = versionCode.match(/APP_VERSION\s*=\s*'([^']+)'/)[1];

// The expected asset list that sw.js should cache on install
const EXPECTED_ASSETS = [
    './', './index.html', './version.js',
    './css/app.css', './css/setup.css',
    './utils/datetime.js', './utils/supabase-helpers.js',
    './utils/validation.js', './utils/html.js',
    './utils/data-mapping.js', './utils/five-a-day-calculator.js',
    './services/data-service.js', './services/v2-import.js',
    './services/five-a-day-catalogue.js', './services/five-a-day-repository.js',
    './ui/dayview-renderer.js', './ui/render.js',
    './ui/form-controllers.js', './ui/hba1c-trend.js',
    './ui/timing-utils.js', './ui/water-intake.js',
    './ui/insights-view.js', './ui/five-a-day.js',
    './ui/chartjs-config.js',
    './manifest.webmanifest',
    './icon-192.png', './icon-512.png',
];

/**
 * Creates a fresh service-worker sandbox with mocked globals.
 * Returns the sandbox so tests can inspect what the SW did.
 */
function createSWSandbox() {
    const installCachedKeys = [];
    const activateDeletedKeys = [];
    const fetchLog = [];

    // Mock CacheStorage
    const mockCaches = {
        _stores: new Map(),
        async open(name) {
            if (!this._stores.has(name)) {
                this._stores.set(name, new Map());
            }
            const store = this._stores.get(name);
            return {
                async addAll(urls) {
                    for (const url of urls) {
                        installCachedKeys.push(url);
                        store.set(url, new Response('mock-body-for-' + url));
                    }
                },
                async put(request, response) {
                    const key = typeof request === 'string' ? request : request.url;
                    store.set(key, response);
                },
                async match(request) {
                    const key = typeof request === 'string' ? request : request.url;
                    return store.get(key) || null;
                },
            };
        },
        async keys() {
            return [...this._stores.keys()];
        },
        async delete(key) {
            activateDeletedKeys.push(key);
            return this._stores.delete(key);
        },
        async match(request) {
            const key = typeof request === 'string' ? request : request.url;
            for (const store of this._stores.values()) {
                const hit = store.get(key);
                if (hit) return hit;
            }
            return null;
        },
    };

    // Mock fetch
    const mockFetch = async (request, opts) => {
        const url = typeof request === 'string' ? request : request.url;
        fetchLog.push({ url, opts });
        return new MockResponse('<html><head></head><body>Live: ' + url + '</body></html>', { status: 200 });
    };

    // Event listeners collected for triggering
    const listeners = { install: null, activate: null, fetch: null };

    const sandbox = {
        APP_VERSION,
        self: {
            location: { origin: 'http://localhost:8080' },
            addEventListener: (event, handler) => { listeners[event] = handler; },
            skipWaiting: () => Promise.resolve(),
            clients: { claim: () => Promise.resolve() },
        },
        importScripts: () => {},
        caches: mockCaches,
        fetch: mockFetch,
        Response: MockResponse,
        URL: URL,
        console,
        // Test helpers
        _listeners: listeners,
        _installCachedKeys: installCachedKeys,
        _activateDeletedKeys: activateDeletedKeys,
        _fetchLog: fetchLog,
        _mockCaches: mockCaches,
    };

    return sandbox;
}

/**
 * Loads sw.js into a sandbox and returns the sandbox.
 */
function loadSW() {
    const sandbox = createSWSandbox();
    const swCode = fs.readFileSync(path.resolve(__dirname, '../../sw.js'), 'utf8');
    vm.createContext(sandbox);
    vm.runInContext(swCode, sandbox);
    return sandbox;
}

/**
 * Creates a mock ExtendableEvent with waitUntil.
 */
function mockEvent() {
    let waitUntilPromise = null;
    return {
        waitUntil(promise) { waitUntilPromise = promise; },
        _getWaitUntil: () => waitUntilPromise,
    };
}

/**
 * Creates a mock FetchEvent.
 */
function mockFetchEvent(url, method = 'GET') {
    const request = { url, method };
    let respondWithPromise = null;
    return {
        request,
        respondWith(promise) { respondWithPromise = promise; },
        _getRespondWith: () => respondWithPromise,
    };
}

// ------------------------------------------------------------------
// Install handler — asset caching
// ------------------------------------------------------------------

describe('sw.js install handler', () => {
    test('caches the correct set of assets on install', async () => {
        const sandbox = loadSW();
        const event = mockEvent();
        sandbox._listeners.install(event);

        assert.ok(event._getWaitUntil(), 'install handler must call waitUntil');
        await event._getWaitUntil();

        const cached = sandbox._installCachedKeys;
        assert.ok(cached.length >= EXPECTED_ASSETS.length,
            `Expected at least ${EXPECTED_ASSETS.length} cached assets, got ${cached.length}`);

        // Verify critical assets are present
        for (const asset of EXPECTED_ASSETS) {
            assert.ok(cached.includes(asset), `Missing cached asset: ${asset}`);
        }
    });

    test('cache name includes APP_VERSION', async () => {
        const sandbox = loadSW();
        const event = mockEvent();
        sandbox._listeners.install(event);
        await event._getWaitUntil();

        const expectedCacheName = `gut-tracker-v${APP_VERSION}`;
        const storeKeys = [...sandbox._mockCaches._stores.keys()];
        assert.ok(storeKeys.includes(expectedCacheName),
            `Cache store "${expectedCacheName}" not found. Available: ${storeKeys.join(', ')}`);
    });

    test('calls skipWaiting after caching', async () => {
        const sandbox = loadSW();
        let skipWaitingCalled = false;
        sandbox.self.skipWaiting = () => { skipWaitingCalled = true; return Promise.resolve(); };

        const event = mockEvent();
        sandbox._listeners.install(event);
        await event._getWaitUntil();

        assert.ok(skipWaitingCalled, 'skipWaiting must be called after caching');
    });
});

// ------------------------------------------------------------------
// Activate handler — old cache cleanup
// ------------------------------------------------------------------

describe('sw.js activate handler', () => {
    test('deletes caches that do not match current version', async () => {
        const sandbox = loadSW();

        // Pre-populate an old cache
        const oldCacheName = 'gut-tracker-v0.0.1';
        sandbox._mockCaches._stores.set(oldCacheName, new Map());

        const event = mockEvent();
        sandbox._listeners.activate(event);
        await event._getWaitUntil();

        assert.ok(sandbox._activateDeletedKeys.includes(oldCacheName),
            `Old cache "${oldCacheName}" should have been deleted`);
    });

    test('does not delete the current version cache', async () => {
        const sandbox = loadSW();
        const currentCacheName = `gut-tracker-v${APP_VERSION}`;
        sandbox._mockCaches._stores.set(currentCacheName, new Map());

        const event = mockEvent();
        sandbox._listeners.activate(event);
        await event._getWaitUntil();

        assert.ok(!sandbox._activateDeletedKeys.includes(currentCacheName),
            `Current cache "${currentCacheName}" should NOT be deleted`);
    });

    test('calls clients.claim after cleanup', async () => {
        const sandbox = loadSW();
        let clientsClaimed = false;
        sandbox.self.clients.claim = () => { clientsClaimed = true; return Promise.resolve(); };

        const event = mockEvent();
        sandbox._listeners.activate(event);
        await event._getWaitUntil();

        assert.ok(clientsClaimed, 'clients.claim must be called after cache cleanup');
    });
});

// ------------------------------------------------------------------
// Fetch handler — app-shell network-first, static cache-first
// ------------------------------------------------------------------

describe('sw.js fetch handler', () => {
    test('app-shell GET requests hit network first', async () => {
        const sandbox = loadSW();
        const event = mockFetchEvent('http://localhost:8080/');
        sandbox._listeners.fetch(event);

        const responsePromise = event._getRespondWith();
        assert.ok(responsePromise, 'fetch handler must call respondWith');

        // Network should have been called
        const networkCall = sandbox._fetchLog.find(
            entry => entry.url === 'http://localhost:8080/');
        assert.ok(networkCall, 'App-shell request should hit network');
    });

    test('non-app-shell requests use cache-first', async () => {
        const sandbox = loadSW();

        // Pre-cache a static asset
        const assetUrl = 'http://localhost:8080/utils/datetime.js';
        sandbox._mockCaches._stores.set(
            `gut-tracker-v${APP_VERSION}`,
            new Map([[assetUrl, new MockResponse('cached-datetime-js')]])
        );

        const event = mockFetchEvent(assetUrl);
        sandbox._listeners.fetch(event);

        const response = await event._getRespondWith();
        const text = await response.text();
        assert.strictEqual(text, 'cached-datetime-js',
            'Should serve from cache without hitting network');
    });

    test('cross-origin requests bypass service worker caching', async () => {
        const sandbox = loadSW();
        const event = mockFetchEvent('https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js');
        sandbox._listeners.fetch(event);

        const response = await event._getRespondWith();
        // Should have passed through to fetch directly
        const passthroughCall = sandbox._fetchLog.find(
            entry => entry.url === 'https://cdn.jsdelivr.net/npm/chart.js@4.4.1/dist/chart.umd.min.js');
        assert.ok(passthroughCall, 'Cross-origin request should be passed to fetch');
    });
});

// ------------------------------------------------------------------
// appResponse — legacy app-shell compatibility rewriting
// ------------------------------------------------------------------
// The three tests below drive the real appResponse path through the
// fetch handler. They replace earlier simulated tests that duplicated
// sw.js patching logic inline — those were maintenance hazards because
// they could drift out of sync with the implementation.
//
// appResponse is not directly exported, so we exercise it by serving a
// legacy app shell from the (mocked) network for an app-shell GET and
// asserting on the patched response.

describe('appResponse — compatibility patching', () => {

    test('appResponse patches a full legacy app-shell through the fetch handler', async () => {
        const sandbox = loadSW();
        const legacyShell = [
            '<!doctype html><html><head>',
            '<title>Gut Tracker 3.2.4</title>',
            '<script>async function saveSilent("meals", payload){}</script>',
            '<script>await saveSilent("meals", { meal_time: "2025-01-01" })</script>',
            '</head><body><div id="github">github</div></body></html>'
        ].join('');

        // Serve the legacy shell from the network for an app-shell GET.
        sandbox.fetch = async (request) => {
            return new MockResponse(legacyShell, {
                status: 200,
                statusText: 'OK',
                headers: { 'content-type': 'text/html' }
            });
        };

        const event = mockFetchEvent('http://localhost:8080/');
        sandbox._listeners.fetch(event);
        const response = await event._getRespondWith();
        const text = await response.text();

        // Old version strings must be replaced with the current version.
        assert.ok(!text.includes('3.2.4'), 'stale version 3.2.4 must be rewritten');
        assert.ok(text.includes(APP_VERSION), `patched shell must include ${APP_VERSION}`);

        // V2 saveSilent compatibility rewriting must be applied.
        assert.ok(text.includes('window.__gutV2Save'), 'saveSilent must be exposed on window');
        // The definition is rewritten to `window.__gutV2Save=async function saveSilent(`
        // so the substring `async function saveSilent(` legitimately remains — what
        // must NOT remain is a bare `await saveSilent(` call site.
        assert.ok(!text.includes('await saveSilent('), 'bare saveSilent call sites must be rewritten');
        assert.ok(text.includes('await window.__gutV2Save('), 'call sites must route through window.__gutV2Save');

        // GitHub auth patch must be injected before </head>.
        const patchIdx = text.indexOf('github');
        const headIdx = text.indexOf('</head>');
        assert.ok(patchIdx !== -1 && headIdx !== -1 && patchIdx < headIdx,
            'GitHub patch must appear before </head>');
    });

    test('appResponse preserves status, statusText and headers', async () => {
        const sandbox = loadSW();
        const body = '<html><head></head><body>3.1.3</body></html>';
        sandbox.fetch = async () => new MockResponse(body, {
            status: 503,
            statusText: 'Service Unavailable',
            headers: { 'content-type': 'text/html', 'x-test': '1' }
        });

        const event = mockFetchEvent('http://localhost:8080/');
        sandbox._listeners.fetch(event);
        const response = await event._getRespondWith();
        assert.strictEqual(response.status, 503);
        assert.strictEqual(response.statusText, 'Service Unavailable');
        assert.strictEqual(response.headers['content-type'], 'text/html');
        assert.strictEqual(response.headers['x-test'], '1');
    });

    test('appResponse does not crash when there is no </head> tag', async () => {
        const sandbox = loadSW();
        const body = '<html><body>No head close tag here. 3.2.3</body></html>';
        sandbox.fetch = async () => new MockResponse(body, { status: 200, statusText: 'OK', headers: {} });

        const event = mockFetchEvent('http://localhost:8080/');
        sandbox._listeners.fetch(event);
        const response = await event._getRespondWith();
        const text = await response.text();
        assert.ok(!text.includes('3.2.3'), 'version string should still be patched');
        assert.ok(text.includes(APP_VERSION), 'current version should be present');
        // No </head> means the GitHub patch is simply not injected — body is returned intact.
        assert.ok(!text.includes('github'), 'no github patch injected without </head>');
    });
});

// ------------------------------------------------------------------
// Asset list consistency — guards sw.js / README drift
// ------------------------------------------------------------------

describe('sw.js cached asset list matches the files on disk', () => {
    async function getCachedAssets() {
        const sandbox = loadSW();
        const event = mockEvent();
        sandbox._listeners.install(event);
        assert.ok(event._getWaitUntil(), 'install handler must call waitUntil');
        await event._getWaitUntil();
        return sandbox._installCachedKeys;
    }

    test('every cached asset that is a source file exists on disk', async () => {
        const cached = await getCachedAssets();
        const missing = cached
            .filter(url => !url.startsWith('http'))
            .map(url => url.replace(/^\.\//, ''))
            .filter(url => /^[A-Za-z0-9._/-]+$/.test(url))
            .filter(url => !fs.existsSync(path.resolve(__dirname, '..', '..', url)));

        assert.deepStrictEqual(missing, [],
            `Cached assets missing from disk: ${missing.join(', ')}`);
    });

    test('all local source modules are present in the cached asset list', async () => {
        const cached = new Set((await getCachedAssets()).map(url => url.replace(/^\.\//, '')));
        const sourceRoots = ['utils', 'services', 'ui'];
        const missing = [];
        for (const dir of sourceRoots) {
            const dirPath = path.resolve(__dirname, '..', '..', dir);
            if (!fs.existsSync(dirPath)) continue;
            for (const file of fs.readdirSync(dirPath)) {
                if (file.endsWith('.js') && !cached.has(`${dir}/${file}`)) {
                    missing.push(`${dir}/${file}`);
                }
            }
        }
        assert.deepStrictEqual(missing, [],
            `Source modules missing from the SW cache list: ${missing.join(', ')}`);
    });
});
