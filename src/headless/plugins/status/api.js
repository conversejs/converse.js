import { _converse, api } from '@converse/headless/core';


export default {
    /**
     * @namespace _converse.api.user.presence
     * @memberOf _converse.api.user
     */
    presence: {
        /**
         * Send out a presence stanza
         * @method _converse.api.user.presence.send
         * @param { String } type
         * @param { String } to
         * @param { String } [status] - An optional status message
         * @param { Element[]|Strophe.Builder[]|Element|Strophe.Builder } [child_nodes]
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
    },

    /**
     * Set and get the user's chat status, also called their *availability*.
     * @namespace _converse.api.user.status
     * @memberOf _converse.api.user
     */
    status: {
        /**
         * Return the current user's availability status.
         * @async
         * @method _converse.api.user.status.get
         * @example _converse.api.user.status.get();
         */
        async get () {
            await api.waitUntil('statusInitialized');
            return _converse.xmppstatus.get('status');
        },

        /**
         * The user's status can be set to one of the following values:
         *
         * @async
         * @method _converse.api.user.status.set
         * @param {string} value The user's chat status (e.g. 'away', 'dnd', 'offline', 'online', 'unavailable' or 'xa')
         * @param {string} [message] A custom status message
         *
         * @example _converse.api.user.status.set('dnd');
         * @example _converse.api.user.status.set('dnd', 'In a meeting');
         */
        async set (value, message) {
            const data = {'status': value};
            if (!Object.keys(_converse.STATUS_WEIGHTS).includes(value)) {
                throw new Error(
                    'Invalid availability value. See https://xmpp.org/rfcs/rfc3921.html#rfc.section.2.2.2.1'
                );
            }
            if (typeof message === 'string') {
                data.status_message = message;
            }
            await api.waitUntil('statusInitialized');
            _converse.xmppstatus.save(data);
        },

        /**
         * Set and retrieve the user's custom status message.
         *
         * @namespace _converse.api.user.status.message
         * @memberOf _converse.api.user.status
         */
        message: {
            /**
             * @async
             * @method _converse.api.user.status.message.get
             * @returns {string} The status message
             * @example const message = _converse.api.user.status.message.get()
             */
            async get () {
                await api.waitUntil('statusInitialized');
                return _converse.xmppstatus.get('status_message');
            },
            /**
             * @async
             * @method _converse.api.user.status.message.set
             * @param {string} status The status message
             * @example _converse.api.user.status.message.set('In a meeting');
             */
            async set (status) {
                await api.waitUntil('statusInitialized');
                _converse.xmppstatus.save({ status_message: status });
            }
        }
    }
}
