import { _converse, api, converse } from "@converse/headless/core.js";

const { Strophe } = converse.env;

export function onConnected () {
    api.refreshBlocklist();
    _converse.connection.addHandler(api.handleBlockingStanza, Strophe.NS.BLOCKING, 'iq', 'set', null, null);
}
