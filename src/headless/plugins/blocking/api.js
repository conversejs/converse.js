import log from '@converse/headless/log.js';
import { _converse, api, converse } from "@converse/headless/core.js";
import { setLastStanzaDate } from './utils.js';

const { Strophe, $iq, sizzle, u } = converse.env;

export default {
    /**
     * Retrieves the blocklist held by the logged in user at a JID by sending an IQ stanza.
     * Saves the model variable _converse.blocked.set
     * @private
     * @method api.refreshBlocklist
     */
    async refreshBlocklist () {
        const features = await api.disco.getFeatures(_converse.domain);
        if (!features?.findWhere({'var': Strophe.NS.BLOCKING})) {
            return false;
        }
        if (!_converse.connection) {
            return false;
        }

        const iq = $iq({
                'type': 'get',
                'id': u.getUniqueId('blocklist')
            }).c('blocklist', {'xmlns': Strophe.NS.BLOCKING});

        const result = await api.sendIQ(iq).catch(e => { log.fatal(e); return null });
        if (result === null) {
            const err_msg = `An error occured while fetching the blocklist`;
            api.alert('error', __('Error'), err_msg);
            log(err_msg, Strophe.LogLevel.WARN);
            return false;
        } else if (u.isErrorStanza(result)) {
            log.error(`Error while fetching blocklist from ${jid}`);
            log.error(result);
            return false;
        }

        const blocklist = sizzle('item', result).map(item => item.getAttribute('jid'));
        _converse.blocked.set({'set': new Set(blocklist)});
        return true;
    },

    /**
     * Handle incoming iq stanzas in the BLOCKING namespace. Adjusts the global blocked_set.
     * @private
     * @method api.handleBlockingStanza
     * @param { Object } [stanza] - The incoming stanza to handle
     */
    async handleBlockingStanza ( stanza ) {
        if (stanza.firstElementChild.tagName === 'block') {
            const users_to_block = sizzle('item', stanza).map(item => item.getAttribute('jid'));
            users_to_block.forEach(_converse.blocked.get('set').add, _converse.blocked.get('set'));
        } else if (stanza.firstElementChild.tagName === 'unblock') {
            const users_to_unblock = sizzle('item', stanza).map(item => item.getAttribute('jid'));
            users_to_unblock.forEach(_converse.blocked.get('set').delete, _converse.blocked.get('set'));
        } else {
            log.error("Received blocklist push update but could not interpret it.");
        }
        // TODO: Fix this to not use the length as an update key, and
        // use a more accurate update method, like a length-extendable hash
        _converse.blocked.set({ 'len': _converse.blocked.get('set').size });
    },

    /**
     * Blocks JIDs by sending an IQ stanza
     * @method api.blockUser
     *
     * @param { Array } [jid_list] - The list of JIDs to block
     */
    async blockUser ( jid_list ) { 
        if (!_converse.disco_entities.get(_converse.domain)?.features?.findWhere({'var': Strophe.NS.BLOCKING})) {
            return false;
        }
        if (!_converse.connection) {
            return false;
        }

        const block_items = jid_list.map(jid => Strophe.xmlElement('item', { 'jid': jid }));
        const block_element = Strophe.xmlElement('block', {'xmlns': Strophe.NS.BLOCKING });

        block_items.forEach(block_element.appendChild, block_element);

        const iq = $iq({
                'type': 'set',
                'id': u.getUniqueId('block')
            }).cnode(block_element);

        const result = await api.sendIQ(iq).catch(e => { log.fatal(e); return false });
        const err_msg = `An error occured while trying to block user(s) ${jid_list}`;
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
     * Unblocks JIDs by sending an IQ stanza to the server JID specified
     * @method api.unblockUser
     * @param { Array } [jid_list] - The list of JIDs to unblock
     */
    async unblockUser ( jid_list ) {
        if (!_converse.disco_entities.get(_converse.domain)?.features?.findWhere({'var': Strophe.NS.BLOCKING})) {
            return false;
        }
        if (!_converse.connection) {
            return false;
        }

        const unblock_items = jid_list.map(jid => Strophe.xmlElement('item', { 'jid': jid }));
        const unblock_element = Strophe.xmlElement('unblock', {'xmlns': Strophe.NS.BLOCKING});

        unblock_items.forEach(unblock_element.append, unblock_element);

        const iq = $iq({
                'type': 'set',
                'id': u.getUniqueId('block')
            }).cnode(unblock_element);

        const result = await api.sendIQ(iq).catch(e => { log.fatal(e); return false });
        const err_msg = `An error occured while trying to unblock user(s) ${jid_list}`;
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
     * Retrieved the blocked set
     * @method api.blockedUsers
     */
    blockedUsers () {
        return _converse.blocked.get('set');
    }

}
