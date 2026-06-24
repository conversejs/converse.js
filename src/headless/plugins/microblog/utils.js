/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import sizzle from 'sizzle';
import { Strophe } from 'strophe.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import log from '@converse/log';
import { COMMENTS_NODE_PREFIX, MICROBLOG_NODE } from './constants.js';

/**
 * @param {string} [node]
 * @returns {boolean}
 */
export function isMicroblogNode(node) {
    return node === MICROBLOG_NODE || (!!node && node.startsWith(COMMENTS_NODE_PREFIX));
}

/**
 * Handle an incoming PEP/PubSub event, routing microblog items to the relevant
 * feed. New feeds are auto-created only for the user's own PEP node; events from
 * other JIDs are applied only to feeds the user already follows (M3 adds the
 * machinery to follow others).
 *
 * @param {Element} message
 * @returns {boolean} Always `true`, to keep the Strophe handler registered.
 */
export function handleMicroblogEvent(message) {
    try {
        const event = sizzle(`event[xmlns="${Strophe.NS.PUBSUB}#event"]`, message).pop();
        if (!event) return true;

        const feeds = _converse.state.pubsubfeeds;
        if (!feeds) return true;

        const bare_jid = _converse.session.get('bare_jid');
        const from = Strophe.getBareJidFromJid(message.getAttribute('from')) || bare_jid;

        for (const items_el of sizzle('> items', event)) {
            const node = items_el.getAttribute('node');
            if (!isMicroblogNode(node)) continue;

            const items = sizzle('> item', items_el);
            if (!items.length) continue;

            const feed = feeds.getFeed(from, node, from === bare_jid);
            feed?.addItems(items);
        }
    } catch (e) {
        log.error(e);
    }
    return true;
}

/**
 * Register a handler for microblog items pushed via PEP from our own or
 * followed nodes.
 */
export function registerMicroblogHandler() {
    api.connection.get().addHandler(handleMicroblogEvent, null, 'message');
}
