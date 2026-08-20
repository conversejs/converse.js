import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';

const { Strophe, sizzle, dayjs } = converse.env;

/**
 * @param {Element} stanza
 * @returns {Promise<import('./types').PresenceAttributes>}
 */
export async function parsePresence(stanza) {
    const from = stanza.getAttribute('from');
    const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, stanza).pop();
    const priority_value = stanza.querySelector('priority')?.textContent ?? '0';
    const priority = parseInt(priority_value, 10) || 0;

    const timestamp = delay ? dayjs(delay.getAttribute('stamp')).toISOString() : new Date().toISOString();
    const attrs = {
        bare_jid: Strophe.getBareJidFromJid(from),
        from,
        status: stanza.querySelector('status')?.textContent,
        resource: Strophe.getResourceFromJid(from),
        show: /** @type {import('./types').PresenceShowValues|undefined} */ (stanza.querySelector('show')?.textContent),
        timestamp,
        type: /** @type {import('./types').PresenceTypes} */ (stanza.getAttribute('type')),
        priority,
        nickname: sizzle(`nick[xmlns="${Strophe.NS.NICK}"]`, stanza).pop()?.textContent,
    };

    /**
     * *Hook* which allows plugins to add additional parsing
     * @event _converse#parsePresence
     */
    return await api.hook('parsePresence', stanza, attrs);
}
