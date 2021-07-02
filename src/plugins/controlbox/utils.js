import { _converse, converse } from "@converse/headless/core";

const u = converse.env.utils;

export function addControlBox () {
    const m = _converse.chatboxes.add(new _converse.ControlBox({'id': 'controlbox'}));
     _converse.chatboxviews.get('controlbox')?.setModel();
    return m;
}

export function showControlBox (ev) {
    ev?.preventDefault?.();
    const controlbox = _converse.chatboxes.get('controlbox') || addControlBox();
    u.safeSave(controlbox, {'closed': false});
}

export function navigateToControlBox (jid) {
    showControlBox();
    const model = _converse.chatboxes.get(jid);
    u.safeSave(model, {'hidden': true});
}

export function disconnect () {
    /* Upon disconnection, set connected to `false`, so that if
     * we reconnect, "onConnected" will be called,
     * to fetch the roster again and to send out a presence stanza.
     */
    const view = _converse.chatboxviews.get('controlbox');
    view.model.set({ 'connected': false });
    return view;
}

export function clearSession () {
    const chatboxviews = _converse?.chatboxviews;
    const view = chatboxviews && chatboxviews.get('controlbox');
    if (view) {
        u.safeSave(view.model, { 'connected': false });
        if (view?.controlbox_pane) {
            view.controlbox_pane.remove();
            delete view.controlbox_pane;
        }
    }
}

export function onChatBoxesFetched () {
    const controlbox = _converse.chatboxes.get('controlbox') || addControlBox();
    controlbox.save({ 'connected': true });
}
