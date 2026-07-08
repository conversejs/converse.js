import sizzle from 'sizzle';
import _converse from '../../../shared/_converse.js';
import converse from '../../../shared/api/public.js';
import api from '../../../shared/api/index.js';
import { arrayBufferToHex, stringToArrayBuffer } from '../../../utils/arraybuffer.js';
import { FOLLOWING_NODE, FOLLOWING_PUBLISH_OPTIONS, NS_SUBSCRIPTION } from '../constants.js';

const { stx } = converse.env;

/**
 * Compute the XEP-0330 item id for a subscription: the lowercase-hex SHA-1 of
 * `server + '<' + node + '<' + own-bare-jid`.
 * @param {string} server - The followed entity's pubsub service.
 * @param {string} node - The followed node.
 * @param {string} jid - The follower's bare JID.
 * @returns {Promise<string>}
 */
async function computeFollowItemId(server, node, jid) {
    const ab = await crypto.subtle.digest('SHA-1', stringToArrayBuffer(`${server}<${node}<${jid}`));
    return arrayBufferToHex(ab);
}

/**
 * Build a XEP-0330 follow-list `<item>`.
 * @param {{ server: string, node: string, id: string, title?: string }} attrs
 * @returns {import('strophe.js').Stanza}
 */
function buildFollowItem({ server, node, id, title }) {
    return stx`
        <item id="${id}">
            <subscription xmlns="${NS_SUBSCRIPTION}" server="${server}" node="${node}"
                >${title ? stx`<title>${title}</title>` : ''}</subscription>
        </item>`;
}

/**
 * Parse a XEP-0330 follow-list `<item>` into a plain object.
 * @param {Element} item
 * @returns {{ server: string, node: string, title?: string }|null}
 */
function parseFollowItem(item) {
    const sub = sizzle(`> subscription[xmlns="${NS_SUBSCRIPTION}"]`, item).pop();
    if (!sub) return null;
    return {
        server: sub.getAttribute('server'),
        node: sub.getAttribute('node'),
        title: sizzle('> title', sub).pop()?.textContent?.trim() || undefined,
    };
}

/**
 * Publish (add or update) a follow to the durable XEP-0330 list on our own PEP
 * service.
 * @param {string} server - The followed entity's pubsub service (a contact's bare JID for PEP).
 * @param {string} node - The followed node (e.g. `urn:xmpp:microblog:0`).
 * @param {string} [title] - A human-readable label.
 * @returns {Promise<void>}
 */
export async function publishFollow(server, node, title) {
    const bare_jid = _converse.session.get('bare_jid');
    const id = await computeFollowItemId(server, node, bare_jid);
    await api.pubsub.publish(
        null,
        FOLLOWING_NODE,
        buildFollowItem({ server, node, id, title }),
        FOLLOWING_PUBLISH_OPTIONS,
    );
}

/**
 * Retract a follow from the XEP-0330 list.
 * @param {string} server
 * @param {string} node
 * @returns {Promise<void>}
 */
export async function retractFollow(server, node) {
    const bare_jid = _converse.session.get('bare_jid');
    const id = await computeFollowItemId(server, node, bare_jid);
    await api.pubsub.retract(null, FOLLOWING_NODE, id);
}

/**
 * Read the durable XEP-0330 follow list from our own PEP service.
 * @returns {Promise<Array<{ server: string, node: string, title?: string }>>}
 */
export async function readFollowing() {
    const { items } = await api.pubsub.items.get(null, FOLLOWING_NODE);
    return items.map(parseFollowItem).filter(Boolean);
}
