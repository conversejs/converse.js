import { _converse, api, converse } from "@converse/headless/core.js";

const { Strophe, $iq } = converse.env;

export async function onConnected () {
    api.refreshBlocklist();
    _converse.connection.addHandler(api.handleBlockingStanza, Strophe.NS.BLOCKING, 'iq', 'set', null, null);
}


