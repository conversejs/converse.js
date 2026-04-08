import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import { getCodePointReferences, getShortnameReferences, isOnlyEmojis } from './utils.js';

const { Strophe } = converse.env;

export function registerPEPPushHandler() {
    const bare_jid = _converse.session.get('bare_jid');
    api.connection.get().addHandler(
        /** @param {Element} stanza */
        (stanza) => {
            const { popular_emojis } = _converse.state;
            popular_emojis?.applyPopularEmojisFromStanza(stanza);
            return true;
        },
        Strophe.NS.REACTIONS_POPULAR,
        'message',
        'headline',
        null,
        bare_jid,
    );
}

/**
 * Given a message, extract emojis from it and use them to update the list of
 * popular emojis.
 * @param {import('../../plugins/reactions/utils').BaseMessage} message
 */
export async function updatePopularEmojis(message) {
    const body = message.get('body');
    if (!body) return;

    await api.emojis.initialize();

    const { popular_emojis } = _converse.state;
    if (!popular_emojis) return;

    const shortname_refs = new Set(getShortnameReferences(body).map(({ shortname }) => shortname));
    const cp_refs = new Set(getCodePointReferences(body).map(({ emoji }) => emoji));
    const emojis = [...shortname_refs, ...cp_refs];

    if (emojis.length) {
        popular_emojis.recordUsage(emojis);
    }
}

/**
 * @param {import('../../shared/types').MessageAttributes} attrs
 * @param {String} text
 * @returns {Promise<import('../../shared/types').MessageAttributes & { is_only_emojis: boolean }>}
 */
export async function parseMessage(attrs, text) {
    await api.emojis.initialize();
    return {
        ...attrs,
        is_only_emojis: text ? isOnlyEmojis(text) : false,
    };
}
