import { _converse, api, log } from '@converse/headless';

export async function setActiveForm (value) {
    await api.waitUntil('controlBoxInitialized');

    const { chatboxes } = _converse.state;
    const controlbox = chatboxes.get('controlbox');
    controlbox.set({ 'active-form': value });
}

export function routeToForm (event) {
    if (location.hash === '#converse/login') {
        event?.preventDefault();
        setActiveForm('login');
    } else if (location.hash === '#converse/register') {
        event?.preventDefault();
        setActiveForm('register');
    }
}

/** @type {Promise<import('./types.ts').XMPPProvider[]>|null} */
let providers_fetch_promise = null;

/**
 * @param {string} url
 * @returns {Promise<import('./types.ts').XMPPProvider[]>}
 */
async function fetchProviderData (url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const data = await response.json();
        if (Array.isArray(data)) {
            const providers = data
                .map(item => typeof item === 'string' ? { jid: item, category: '' } : item)
                .filter(item => item.jid);
            log.debug(`Fetched ${providers.length} XMPP providers`);
            return providers;
        }
        return [];
    } catch (err) {
        log.warn(`Failed to fetch XMPP providers from ${url}: ${err.message}`);
        return [];
    }
}

/**
 * Fetches the list of XMPP providers from the configured URL.
 * The list is cached after the first successful fetch.
 * @returns {Promise<import('./types.ts').XMPPProvider[]>} - Array of provider objects
 */
export async function fetchXMPPProviders () {
    if (providers_fetch_promise) return providers_fetch_promise;

    const url = api.settings.get('xmpp_providers_url');
    if (!url) return [];

    providers_fetch_promise = fetchProviderData(url);
    return providers_fetch_promise;
}
