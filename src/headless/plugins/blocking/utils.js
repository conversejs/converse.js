import { _converse, api, converse } from "@converse/headless/core.js";

const { Strophe } = converse.env;

export function onConnected () {
    _converse.connection.addHandler(
        api.handleBlockingStanza, Strophe.NS.BLOCKING, 'iq', ['set', 'result']
    );
    api.refreshBlocklist();
}
