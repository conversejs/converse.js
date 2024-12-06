import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';

const { Strophe, sizzle } = converse.env;

/**
 * @param {Element} stanza
 * @returns {Promise<Array<import('./types.js').BookmarkAttrs>>}
 */
export async function parseStanzaForBookmarks(stanza) {
    let ns;
    let sel;
    const bare_jid = _converse.session.get('bare_jid');
    if (await api.disco.supports(`${Strophe.NS.BOOKMARKS2}#compat`, bare_jid)) {
        ns = Strophe.NS.BOOKMARKS2;
        sel = `items[node="${ns}"] item conference`;
    } else {
        ns = Strophe.NS.BOOKMARKS;
        sel = `items[node="${ns}"] item storage[xmlns="${ns}"] conference`;
    }
    return sizzle(sel, stanza).map(
        /** @param {Element} el */ (el) => {
            const jid = ns === Strophe.NS.BOOKMARKS2 ? el.parentElement.getAttribute('id') : el.getAttribute('jid');
            return {
                jid,
                name: el.getAttribute('name') || jid,
                autojoin: ['1', 'true'].includes(el.getAttribute('autojoin')),
                nick: el.querySelector('nick')?.textContent ?? '',
                password: el.querySelector('password')?.textContent ?? '',
                extensions: Array.from(el.querySelector('extensions')?.children ?? []).map(c => c.outerHTML),
            };
        }
    );
}
