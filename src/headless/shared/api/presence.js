/**
 * @typedef {import('strophe.js').Builder} Builder
 * @typedef {import('../../plugins/status/profile').default} Profile
 * @typedef {import('../../plugins/muc/muc.js').default} MUC
 */
import _converse from '../_converse.js';
import promise_api from './promise.js';
import send_api from './send.js';
import rooms_api from '../../plugins/muc/api.js';

const { waitUntil } = promise_api;
const { send } = send_api;
const { rooms } = rooms_api;

export default {
    /**
     * @namespace _converse.api.user.presence
     * @memberOf _converse.api.user
     */
    presence: {
        /**
         * Send out a presence stanza
         * @method _converse.api.user.presence.send
         * @param {String} [type]
         * @param {String} [to]
         * @param {String} [status] - An optional status message
         * @param {Array<Element>|Array<Builder>|Element|Builder} [nodes]
         *  Nodes(s) to be added as child nodes of the `presence` XML element.
         */
        async send (type, to, status, nodes) {
            await waitUntil('statusInitialized');

            let children = [];
            if (nodes) {
                children = Array.isArray(nodes) ? nodes : [nodes];
            }

            const model = /** @type {Profile} */(_converse.state.profile);
            const presence = await model.constructPresence(type, to, status);
            children.map(c => c?.tree() ?? c).forEach(c => presence.cnode(c).up());
            send(presence);

            if (['away', 'chat', 'dnd', 'online', 'xa', undefined].includes(type)) {
                const mucs = /** @type {MUC[]} */(await rooms.get());
                mucs.forEach(muc => muc.sendStatusPresence(type, status, children));
            }
        }
    }
}
