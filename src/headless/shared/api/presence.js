import { _converse, api } from '../../core.js';


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
            await api.waitUntil('statusInitialized');
            if (child_nodes && !Array.isArray(child_nodes)) {
                child_nodes = [child_nodes];
            }
            const model = _converse.xmppstatus
            const presence = await model.constructPresence(type, to, status);
            child_nodes?.map(c => c?.tree() ?? c).forEach(c => presence.cnode(c).up());
            api.send(presence);

            if (['away', 'chat', 'dnd', 'online', 'xa', undefined].includes(type)) {
                const mucs = await api.rooms.get();
                mucs.forEach(muc => muc.sendStatusPresence(type, status, child_nodes));
            }
        }
    }
}
