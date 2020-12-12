import { _converse } from '@converse/headless/core';


export default {
    /**
     * The "chatview" namespace groups methods pertaining to views
     * for one-on-one chats.
     *
     * @namespace _converse.api.chatviews
     * @memberOf _converse.api
     */
    chatviews: {
         /**
          * Get the view of an already open chat.
          * @method _converse.api.chatviews.get
          * @param { Array.string | string } jids
          * @returns { _converse.ChatBoxView|undefined }  The chat should already be open, otherwise `undefined` will be returned.
          * @example
          * // To return a single view, provide the JID of the contact:
          * _converse.api.chatviews.get('buddy@example.com')
          * @example
          * // To return an array of views, provide an array of JIDs:
          * _converse.api.chatviews.get(['buddy1@example.com', 'buddy2@example.com'])
          */
        get (jids) {
            if (jids === undefined) {
                return Object.values(_converse.chatboxviews.getAll());
            }
            if (typeof jids === 'string') {
                return _converse.chatboxviews.get(jids);
            }
            return jids.map(jid => _converse.chatboxviews.get(jid));
        }
    }
}
