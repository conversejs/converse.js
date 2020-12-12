import { _converse, api } from "@converse/headless/core";

export default {
    /**
     * The "roomviews" namespace groups methods relevant to chatroom
     * (aka groupchats) views.
     *
     * @namespace _converse.api.roomviews
     * @memberOf _converse.api
     */
    roomviews: {
        /**
         * Retrieves a groupchat (aka chatroom) view. The chat should already be open.
         *
         * @method _converse.api.roomviews.get
         * @param {String|string[]} name - e.g. 'coven@conference.shakespeare.lit' or
         *  ['coven@conference.shakespeare.lit', 'cave@conference.shakespeare.lit']
         * @returns {View} View representing the groupchat
         *
         * @example
         * // To return a single view, provide the JID of the groupchat
         * const view = _converse.api.roomviews.get('coven@conference.shakespeare.lit');
         *
         * @example
         * // To return an array of views, provide an array of JIDs:
         * const views = _converse.api.roomviews.get(['coven@conference.shakespeare.lit', 'cave@conference.shakespeare.lit']);
         *
         * @example
         * // To return views of all open groupchats, call the method without any parameters::
         * const views = _converse.api.roomviews.get();
         *
         */
        get (jids) {
            if (Array.isArray(jids)) {
                const views = api.chatviews.get(jids);
                return views.filter(v => v.model.get('type') === _converse.CHATROOMS_TYPE)
            } else {
                const view = api.chatviews.get(jids);
                if (view.model.get('type') === _converse.CHATROOMS_TYPE) {
                    return view;
                } else {
                    return null;
                }
            }
        },
        /**
         * Lets you close open chatrooms.
         *
         * You can call this method without any arguments to close
         * all open chatrooms, or you can specify a single JID or
         * an array of JIDs.
         *
         * @method _converse.api.roomviews.close
         * @param {(String[]|String)} jids The JID or array of JIDs of the chatroom(s)
         * @returns { Promise } - Promise which resolves once the views have been closed.
         */
        close (jids) {
            let views;
            if (jids === undefined) {
                views = _converse.chatboxviews;
            } else if (typeof jids === 'string') {
                views = [_converse.chatboxviews.get(jids)].filter(v => v);
            } else if (Array.isArray(jids)) {
                views = jids.map(jid => _converse.chatboxviews.get(jid));
            }
            return Promise.all(views.map(v => (v.is_chatroom && v.model && v.close())))
        }
    }
}
