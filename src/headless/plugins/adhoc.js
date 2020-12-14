import { converse } from "../core.js";
import log from "@converse/headless/log";
import sizzle from 'sizzle';
import { getAttributes } from '@converse/headless/shared/parsers';

const { Strophe } = converse.env;
let _converse, api;

Strophe.addNamespace('ADHOC', 'http://jabber.org/protocol/commands');


function parseForCommands (stanza) {
    const items = sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"][node="${Strophe.NS.ADHOC}"] item`, stanza);
    return items.map(getAttributes)
}


const adhoc_api = {
    /**
     * The XEP-0050 Ad-Hoc Commands API
     *
     * This API lets you discover ad-hoc commands available for an entity in the XMPP network.
     *
     * @namespace api.adhoc
     * @memberOf api
     */
    adhoc: {
        /**
         * @method api.adhoc.getCommands
         * @param { String } to_jid
         */
        async getCommands (to_jid) {
            let commands = [];
            try {
                commands = parseForCommands(await api.disco.items(to_jid, Strophe.NS.ADHOC));
            } catch (e) {
                if (e === null) {
                    log.error(`Error: timeout while fetching ad-hoc commands for ${to_jid}`);
                } else {
                    log.error(`Error while fetching ad-hoc commands for ${to_jid}`);
                    log.error(e);
                }
            }
            return commands;
        }
    }
}


converse.plugins.add('converse-adhoc', {

    dependencies: ["converse-disco"],

    initialize () {
        _converse = this._converse;
        api  = _converse.api;
        Object.assign(api, adhoc_api);
    }
});

export default adhoc_api;
