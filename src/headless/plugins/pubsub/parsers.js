import { parseXForm } from '../../shared/parsers.js';

/**
 * @param {Element} iq - An IQ result stanza
 * @returns {import('./types').PubSubConfigOptions}
 */
export function parseStanzaForPubSubConfig(iq) {
    return parseXForm(iq).fields.reduce((acc, f) => {
        if (f.var.startsWith('pubsub#')) {
            const key = f.var.replace(/^pubsub#/, '');
            const value = (f.type === 'boolean') ? f.checked : (f.value ?? null);
            acc[key] = value;
        }
        return acc;
    }, {});
}
