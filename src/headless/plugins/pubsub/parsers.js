import { parseXForm } from '../../shared/parsers.js';

/**
 * @param {Element} iq - An IQ result stanza
 * @returns {import('./types').PubSubConfigOptions}
 */
export function parseStanzaForPubSubConfig(iq) {
    return parseXForm(iq).fields.reduce((acc, f) => {
        if (f.var.startsWith('pubsub#')) {
            const key = f.var.replace(/^pubsub#/, '');
            if (f.type === 'boolean') {
                acc[key] = f.checked;
            } else if (f.type === 'list-multi' || f.type === 'text-multi' || f.type === 'jid-multi') {
                acc[key] = f.values?.length ? f.values : null;
            } else {
                acc[key] = f.value ?? null;
            }
        }
        return acc;
    }, {});
}
