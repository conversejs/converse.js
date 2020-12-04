import { _converse } from "@converse/headless/core";

export function addControlBox () {
    const m = new _converse.ControlBox({'id': 'controlbox'});
    return _converse.chatboxes.add(m);
}
