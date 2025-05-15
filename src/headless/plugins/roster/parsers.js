import converse from '../../shared/api/public.js';

const { Strophe, sizzle, dayjs } = converse.env;

/**
 * @param {Element} stanza
 * @returns {import('./types').Presence}
 */
export function parsePresence(stanza) {
    const jid = stanza.getAttribute('from');
    const type = /** @type {import('./types').PresenceTypes} */(stanza.getAttribute('type'));
    const resource = Strophe.getResourceFromJid(jid);
    const delay = sizzle(`delay[xmlns="${Strophe.NS.DELAY}"]`, stanza).pop();
    const priority = stanza.querySelector('priority')?.textContent;
    const show = /** @type {import('./types').PresenceShowValues|undefined} */(stanza.querySelector('show')?.textContent);
    const timestamp = delay ? dayjs(delay.getAttribute('stamp')).toISOString() : new Date().toISOString();
    return {
        resource,
        show,
        timestamp,
        type,
        priority: Number.isNaN(parseInt(priority, 10)) ? 0 : parseInt(priority, 10),
    };
}
