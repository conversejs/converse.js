import { _converse } from "@converse/headless/core";

export function addControlBox () {
    const m = _converse.chatboxes.add(new _converse.ControlBox({'id': 'controlbox'}));
     _converse.chatboxviews.get('controlbox')?.setModel();
    return m;
}
