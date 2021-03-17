import { _converse, converse } from "@converse/headless/core";

const u = converse.env.utils;

export function addControlBox () {
    const m = _converse.chatboxes.add(new _converse.ControlBox({'id': 'controlbox'}));
     _converse.chatboxviews.get('controlbox')?.setModel();
    return m;
}

export function showControlBox () {
    const controlbox = _converse.chatboxes.get('controlbox') || addControlBox();
    u.safeSave(controlbox, {'closed': false});
}
