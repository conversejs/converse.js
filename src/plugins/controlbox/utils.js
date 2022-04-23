import { __ } from 'i18n/index.js';
import { _converse, api, converse } from "@converse/headless/core.js";

const { Strophe, u } = converse.env;

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


/**
 * Given the login `<form>` element, parse its data and update the
 * converse settings with the supplied JID, password and connection URL.
 * @param { HTMLElement } form
 * @param { Object } settings - Extra settings that may be passed in and will
 *  also be set together with the form settings.
 */
export function updateSettingsWithFormData (form, settings={}) {
    const form_data = new FormData(form);

    const connection_url  = form_data.get('connection-url');
    if (connection_url?.startsWith('ws')) {
        settings['websocket_url'] = connection_url;
    } else if (connection_url?.startsWith('http')) {
        settings['bosh_service_url'] = connection_url;
    }

    let jid = form_data.get('jid');
    if (api.settings.get('locked_domain')) {
        const last_part = '@' + api.settings.get('locked_domain');
        if (jid.endsWith(last_part)) {
            jid = jid.substr(0, jid.length - last_part.length);
        }
        jid = Strophe.escapeNode(jid) + last_part;
    } else if (api.settings.get('default_domain') && !jid.includes('@')) {
        jid = jid + '@' + api.settings.get('default_domain');
    }
    settings['jid'] = jid;
    settings['password'] = form_data.get('password');

    api.settings.set(settings);

    _converse.config.save({ 'trusted': (form_data.get('trusted') && true) || false });
}


export function validateJID (form) {
    const jid_element = form.querySelector('input[name=jid]');
    if (
        jid_element.value &&
        !api.settings.get('locked_domain') &&
        !api.settings.get('default_domain') &&
        !u.isValidJID(jid_element.value)
    ) {
        jid_element.setCustomValidity(__('Please enter a valid XMPP address'));
        return false;
    }
    jid_element.setCustomValidity('');
    return true;
}

