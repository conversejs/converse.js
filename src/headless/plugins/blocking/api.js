import log from '@converse/headless/log.js';
import { _converse, api, converse } from "@converse/headless/core.js";
import { sendBlockingStanza } from './utils.js';

const { Strophe } = converse.env;


export default {

    blocking: {
        /**
         * Checks if XEP-0191 is supported
         */
        async supported () {
            const has_feature = await api.disco.features.has(Strophe.NS.BLOCKING, _converse.domain);
            if (!has_feature) {
                log.info("XEP-0191 not supported, no blocklist available");
                return false;
            }
            log.debug("XEP-0191 available");
            return true;
        },
        /**
         * Retrieves the blocklist held by the logged in user at a JID by sending an IQ stanza.
         * @private
         * @method api.blocking.refresh
         */
        async refresh () {
            if (!_converse.connection) {
                return false;
            }
            log.debug("refreshing blocklist");
            const available = await this.supported();
            if (!available) {
                log.debug("XEP-0191 NOT available, not refreshing...");
                return false;
            }
            log.debug("getting blocklist...");
            return sendBlockingStanza( 'blocklist', 'get' );
        },
        /**
         * Blocks JIDs by sending an IQ stanza
         * @method api.blocking.block
         *
         * @param { Array } [jid_list] - The list of JIDs to block
         */
        block ( jid_list ) {
            sendBlockingStanza( 'block', 'set', jid_list );
        },
        /**
         * Unblocks JIDs by sending an IQ stanza to the server JID specified
         * @method api.blocking.unblock
         * @param { Array } [jid_list] - The list of JIDs to unblock
         */
        unblock ( jid_list ) {
            sendBlockingStanza( 'unblock', 'set', jid_list );
        },
        /**
         * Retrieve the blocked set
         * @method api.blocking.blocklist
         */
        blocklist () {
            return _converse.blocking._blocked?.get('set') ?? new Set();
        },
    }
}
