import converse from '../../shared/api/public.js';
import api from '../../shared/api/index.js';
import { buildReactionFallbackBody } from './fallback.js';
import { getOwnReactionJID } from './utils.js';

const { Strophe, stx, u } = converse.env;

/**
 * @typedef {import('../../shared/message').default} BaseMessage
 * @typedef {import('../../shared/types').ChatBoxOrMUC} ChatBoxOrMUC
 */

export default {
    /**
     * @namespace _converse.api.reactions
     * @memberOf _converse.api
     */
    reactions: {
        /**
         * Sets our reactions to a message (XEP-0444), replacing those we gave
         * it before. XEP-0444 has no "add one": each reaction stanza carries
         * the sender's whole set, so an empty set withdraws them all.
         *
         * The message's `reactions` are updated straight away. When the chat
         * is OMEMO-encrypted the reactions go through OMEMO, and if that send
         * fails the update is rolled back and the error re-thrown
         * (`api.omemo.send` has already alerted the user). Otherwise the
         * stanza is sent as is, and one that bounces is rolled back by the
         * `getErrorAttributesForMessage` hook.
         *
         * @method _converse.api.reactions.send
         * @param {BaseMessage} message - The message reacted to
         * @param {string[]} emojis - Our whole set of reactions to it, as unicode emojis
         * @returns {Promise<void>}
         */
        async send(message, emojis) {
            /** @type {ChatBoxOrMUC} */
            const chatbox = message.collection.chatbox;
            const to_jid = chatbox.get('jid');
            const type = chatbox.get('type') === 'chatroom' ? 'groupchat' : 'chat';
            // In a MUC a message is referred to by the stanza_id the MUC gave it, if any.
            const muc_stanza_id = type === 'groupchat' ? message.get(`stanza_id ${to_jid}`) : null;
            const msg_id = muc_stanza_id || message.get('msgid');

            const my_jid = getOwnReactionJID(chatbox);
            const previous = [...(message.get('reactions')?.[my_jid] || [])];
            setOwnReactions(message, my_jid, emojis);

            // Reactions are body-coupled metadata: when the chat is OMEMO-encrypted we
            // must not leak them in cleartext, so route them through OMEMO.
            if (chatbox.get('omemo_active')) {
                try {
                    await sendEncryptedReaction(chatbox, message, msg_id, emojis);
                } catch (e) {
                    setOwnReactions(message, my_jid, previous);
                    throw e;
                }
            } else {
                api.send(stx`
                    <message to="${to_jid}" type="${type}" id="${u.getUniqueId('reaction')}" xmlns="jabber:client">
                        <reactions xmlns="${Strophe.NS.REACTIONS}" id="${msg_id}">
                            ${emojis.map((reaction) => stx`<reaction>${reaction}</reaction>`)}
                        </reactions>
                        <store xmlns="${Strophe.NS.HINTS}"/>
                    </message>
                `);
            }
        },
    },
};

/**
 * Stores our reactions on a message, under the key the server will echo them
 * back with (see {@link getOwnReactionJID}).
 * @param {BaseMessage} message
 * @param {string} my_jid
 * @param {string[]} emojis - Empty to remove ours
 */
function setOwnReactions(message, my_jid, emojis) {
    const reactions = { ...(message.get('reactions') || {}) };
    if (emojis.length === 0) {
        delete reactions[my_jid];
    } else {
        reactions[my_jid] = emojis;
    }
    message.save({ reactions });
}

/**
 * Send a XEP-0444 reaction encrypted via OMEMO.
 *
 * The structured `<reactions>` element travels encrypted inside the omemo:2 SCE
 * `<content>`; the body — a quote of the reacted-to message plus the emoji(s)
 * (see {@link buildReactionFallbackBody}) — doubles as the fallback for
 * legacy-OMEMO recipients, whose payload can't carry structured metadata. A
 * XEP-0428 `<fallback for="urn:xmpp:reactions:0">` marks the whole body so
 * XEP-0444-aware clients strip it and render the reaction natively instead.
 *
 * @param {ChatBoxOrMUC} chatbox
 * @param {BaseMessage} message - the message being reacted to (for its text)
 * @param {string} msg_id - the id of the message being reacted to
 * @param {string[]} emojis - the user's current reaction set (empty on retraction)
 * @returns {Promise<void>} rejects if the encrypted send fails
 */
function sendEncryptedReaction(chatbox, message, msg_id, emojis) {
    const extensions = [
        stx`<reactions xmlns="${Strophe.NS.REACTIONS}" id="${msg_id}">
            ${emojis.map((reaction) => stx`<reaction>${reaction}</reaction>`)}
        </reactions>`,
    ];
    const body = buildReactionFallbackBody(message.getMessageText(), emojis);
    // A retraction (empty set) has no body, so there's nothing to mark.
    if (body) {
        extensions.push(stx`<fallback xmlns="${Strophe.NS.FALLBACK}" for="${Strophe.NS.REACTIONS}"><body/></fallback>`);
    }
    return api.omemo.send(chatbox, body, extensions);
}
