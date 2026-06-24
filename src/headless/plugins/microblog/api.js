/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import { MICROBLOG_NODE } from './constants.js';

export default {
    /**
     * The "microblog" namespace groups methods relevant to XEP-0277
     * Microblogging.
     *
     * @namespace _converse.api.microblog
     * @memberOf _converse.api
     */
    microblog: {
        feeds: {
            /**
             * Get (creating if necessary) a microblog feed for a JID + node.
             * @method _converse.api.microblog.feeds.get
             * @param {string} [jid] - The feed's JID. Defaults to the logged-in
             *      user's bare JID (their own microblog).
             * @param {string} [node='urn:xmpp:microblog:0']
             * @param {boolean} [create=true]
             * @returns {Promise<import('./feed').default|undefined>}
             */
            async get(jid, node = MICROBLOG_NODE, create = true) {
                await api.waitUntil('pubsubFeedsInitialized');
                const bare_jid = _converse.session.get('bare_jid');
                return _converse.state.pubsubfeeds.getFeed(jid || bare_jid, node, create);
            },

            /**
             * Get the logged-in user's own microblog feed.
             * @method _converse.api.microblog.feeds.own
             * @returns {Promise<import('./feed').default>}
             */
            async own() {
                return api.microblog.feeds.get();
            },
        },
    },
};
