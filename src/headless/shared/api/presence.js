import _converse from '../_converse.js';
import api_promise from './promise.js';
import api_send from './send.js';
import api_events from './events.js';

const { waitUntil } = api_promise;
const { send } = api_send;
const { trigger } = api_events;

export default {
    /**
     * @namespace _converse.api.user.presence
     * @memberOf _converse.api.user
     */
    presence: {
        /**
         * Send out a presence stanza
         * @method _converse.api.user.presence.send
         * @param { String } [type]
         * @param { String } [to]
         * @param { String } [status] - An optional status message
         * @param { Array<Element>|Array<Strophe.Builder>|Element|Strophe.Builder } [child_nodes]
         *  Nodes(s) to be added as child nodes of the `presence` XML element.
         */
        async send (type, to, status, child_nodes) {
            await waitUntil('statusInitialized');
            if (child_nodes && !Array.isArray(child_nodes)) {
                child_nodes = [child_nodes];
            }
            const model = _converse.xmppstatus
            const presence = await model.constructPresence(type, to, status);
            child_nodes?.map(c => c?.tree() ?? c).forEach(c => presence.cnode(c).up());
            send(presence);
            /**
             * Triggered when a presence has been sent out via api.presence.send
             * @event _converse#presenceSent
             * @example _converse.api.listen.on('presenceSent', ({ presence, type, child_nodes }) => { ... });
             */
            trigger('presenceSent', { presence, type, child_nodes });
        }
    }
}
