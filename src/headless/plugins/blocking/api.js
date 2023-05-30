import log from '@converse/headless/log.js';
import { _converse, api, converse } from '@converse/headless/core.js';

const { Strophe, $iq, sizzle, u } = converse.env;

export default {

    /**
     * Checks if XEP-0191 is supported
     */
    async isBlockingAvailable () {
        const has_feature = await api.disco.supports(Strophe.NS.BLOCKING, _converse.domain);
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
     * @method api.refreshBlocklist
     */
    async refreshBlocklist () {
        log.debug("refreshing blocklist");
        const available = await this.isBlockingAvailable();
        if (!available) {
            log.debug("XEP-0191 NOT available, not refreshing...");
            api.trigger('blockListFetched', []);
            return
        }
        if (!_converse.connection) {
            return false;
        }
        log.debug("getting blocklist...");
        return this.sendBlockingStanza( 'blocklist', 'get' );
    },

    /**
     * Handle incoming iq stanzas in the BLOCKING namespace. Adjusts the global blocked.set.
     * @private
     * @method api.handleBlockingStanza
     * @param { Object } [stanza] - The incoming stanza to handle
     */
    handleBlockingStanza ( stanza ) {
        const action = stanza.firstElementChild.tagName;
        const items = sizzle('item', stanza).map(item => item.getAttribute('jid'));
        const msg_type = stanza.getAttribute('type');

        log.debug(`handle blocking stanza Type ${msg_type} action ${action}`);
        if (msg_type == 'result' && action == 'blocklist' ) {
            log.debug(`resetting blocklist: ${items}`);
            _converse.blocked.set({'set': new Set()});
            items.forEach((item) => { _converse.blocked.get('set').add(item)});

            /**
            * Triggered once the _converse.blocked list has been fetched
            * @event _converse#blockListFetched
            * @example _converse.api.listen.on('blockListFetched', () => { ... });
            */
            api.trigger('blockListFetched', _converse.blocked.get('set'));
            log.debug("triggered blockListFetched");

        } else if (msg_type == 'set' && action == 'block') {
            log.debug(`adding people to blocklist: ${items}`);
            items.forEach((item) => { _converse.blocked.get('set').add(item)});
            api.trigger('blockListUpdated', _converse.blocked.get('set'));
        } else if (msg_type == 'set' && action == 'unblock') {
            log.debug(`removing people from blocklist: ${items}`);
            items.forEach((item) => { _converse.blocked.get('set').delete(item)});
            api.trigger('blockListUpdated', _converse.blocked.get('set'));
        } else {
            log.error("Received a blocklist push update but could not interpret it");
        }
        return true;
    },

    /**
     * Send block/unblock IQ stanzas to the server for the JID specified
     * @method api.sendBlockingStanza
     * @param { String } action - "block", "unblock" or "blocklist"
     * @param { String } iq_type - "get" or "set"
     * @param { Array } [jid_list] - (optional) The list of JIDs to block or unblock
     */
    async sendBlockingStanza ( action, iq_type = 'set', jid_list = [] ) {
        if (!_converse.connection) {
            return false;
        }

        const element = Strophe.xmlElement(action, {'xmlns': Strophe.NS.BLOCKING});
        jid_list.forEach((jid) => {
            const item = Strophe.xmlElement('item', { 'jid': jid });
            element.append(item);
        });

        const iq = $iq({
                'type': iq_type,
                'id': u.getUniqueId(action)
            }).cnode(element);

        const result = await api.sendIQ(iq).catch(e => { log.fatal(e); return false });
        const err_msg = `An error occured while trying to ${action} user(s) ${jid_list}`;
        if (result === null) {
            api.alert('error', __('Error'), err_msg);
            log(err_msg, Strophe.LogLevel.WARN);
            return false;
        } else if (u.isErrorStanza(result)) {
            log.error(err_msg);
            log.error(result);
            return false;
        }
        return true;
    },

    /**
     * Blocks JIDs by sending an IQ stanza
     * @method api.blockUser
     *
     * @param { Array } [jid_list] - The list of JIDs to block
     */
    blockUser ( jid_list ) {
        return this.sendBlockingStanza( 'block', 'set', jid_list );
    },

    /**
     * Retrieved the blocked set
     * @method api.blockedUsers
     */
    blockedUsers () {
        if (_converse.blocked)
          return _converse.blocked.get('set');

        return new Set();
    },

    /**
     * Unblocks JIDs by sending an IQ stanza to the server JID specified
     * @method api.unblockUser
     * @param { Array } [jid_list] - The list of JIDs to unblock
     */
    unblockUser ( jid_list ) {
        return this.sendBlockingStanza( 'unblock', 'set', jid_list );
    }
}
