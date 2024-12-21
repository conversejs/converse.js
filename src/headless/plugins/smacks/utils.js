import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import log from '../../log.js';
import { getOpenPromise } from '@converse/openpromise';
import { isTestEnv } from '../../utils/session.js';

const { Strophe, u, stx } = converse.env;

function isStreamManagementSupported () {
    if (api.connection.isType('bosh') && !isTestEnv()) {
        return false;
    }
    return api.disco.stream.getFeature('sm', Strophe.NS.SM);
}

/**
 * @param {Element} el
 */
function handleAck (el) {
    if (!_converse.session.get('smacks_enabled')) {
        return true;
    }
    const handled = parseInt(el.getAttribute('h'), 10);
    const last_known_handled = _converse.session.get('num_stanzas_handled_by_server');
    const delta = handled - last_known_handled;

    if (delta < 0) {
        const err_msg =
            `New reported stanza count lower than previous. ` + `New: ${handled} - Previous: ${last_known_handled}`;
        log.error(err_msg);
    }
    const unacked_stanzas = _converse.session.get('unacked_stanzas');
    if (delta > unacked_stanzas.length) {
        const err_msg =
            `Higher reported acknowledge count than unacknowledged stanzas. ` +
            `Reported Acknowledged Count: ${delta} -` +
            `Unacknowledged Stanza Count: ${unacked_stanzas.length} -` +
            `New: ${handled} - Previous: ${last_known_handled}`;
        log.error(err_msg);
    }
    _converse.session.save({
        'num_stanzas_handled_by_server': handled,
        'num_stanzas_since_last_ack': 0,
        'unacked_stanzas': unacked_stanzas.slice(delta)
    });
    return true;
}

function sendAck () {
    if (_converse.session.get('smacks_enabled')) {
        const h = _converse.session.get('num_stanzas_handled');
        const stanza = stx`<a xmlns="${Strophe.NS.SM}" h="${h}"/>`;
        api.send(stanza);
    }
    return true;
}

/**
 * @param {Element} el
 */
function stanzaHandler (el) {
    if (_converse.session.get('smacks_enabled')) {
        if (u.isTagEqual(el, 'iq') || u.isTagEqual(el, 'presence') || u.isTagEqual(el, 'message')) {
            const h = _converse.session.get('num_stanzas_handled');
            _converse.session.save('num_stanzas_handled', h + 1);
        }
    }
    return true;
}

export function initSessionData () {
    _converse.session.save({
        'smacks_enabled': _converse.session.get('smacks_enabled') || false,
        'num_stanzas_handled': _converse.session.get('num_stanzas_handled') || 0,
        'num_stanzas_handled_by_server': _converse.session.get('num_stanzas_handled_by_server') || 0,
        'num_stanzas_since_last_ack': _converse.session.get('num_stanzas_since_last_ack') || 0,
        'unacked_stanzas': _converse.session.get('unacked_stanzas') || []
    });
}

function resetSessionData () {
    _converse.session?.save({
        'smacks_enabled': false,
        'num_stanzas_handled': 0,
        'num_stanzas_handled_by_server': 0,
        'num_stanzas_since_last_ack': 0,
        'unacked_stanzas': []
    });
}

/**
 * @param {Element} el
 */
function saveSessionData (el) {
    const data = { 'smacks_enabled': true };
    if (['1', 'true'].includes(el.getAttribute('resume'))) {
        data['smacks_stream_id'] = el.getAttribute('id');
    }
    _converse.session.save(data);
    return true;
}

/**
 * @param {Element} el
 */
function onFailedStanza (el) {
    resetSessionData();
    /**
     * Triggered when the XEP-0198 stream could not be resumed.
     * @event _converse#streamResumptionFailed
     */
    api.trigger('streamResumptionFailed');

    if (el.querySelector('item-not-found')) {
        // Stream resumption must happen before resource binding but
        // enabling a new stream must happen after resource binding.
        // Since resumption failed, we simply continue.
        //
        // After resource binding, sendEnableStanza will be called
        // based on the afterResourceBinding event.
        log.warn(
            'Could not resume previous SMACKS session, session id not found. A new session will be established.'
        );
    } else {
        log.error('Failed to enable stream management');
        log.error(el.outerHTML);

        const connection = api.connection.get();
        connection._changeConnectStatus(Strophe.Status.DISCONNECTED, null);
    }
    return true;
}

function resendUnackedStanzas () {
    const stanzas = _converse.session.get('unacked_stanzas');
    // We clear the unacked_stanzas array because it'll get populated
    // again in `onStanzaSent`
    _converse.session.save('unacked_stanzas', []);

    // XXX: Currently we're resending *all* unacked stanzas, including
    // IQ[type="get"] stanzas that longer have handlers (because the
    // page reloaded or we reconnected, causing removal of handlers).
    //
    // *Side-note:* Is it necessary to clear handlers upon reconnection?
    //
    // I've considered not resending those stanzas, but then keeping
    // track of what's been sent and ack'd and their order gets
    // prohibitively complex.
    //
    // It's unclear how much of a problem this poses.
    //
    // Two possible solutions are running @converse/headless as a
    // service worker or handling IQ[type="result"] stanzas
    // differently, more like push stanzas, so that they don't need
    // explicit handlers.
    stanzas.forEach((s) => api.send(u.toStanza(s)));
}

/**
 * @param {Element} el
 */
function onResumedStanza (el) {
    saveSessionData(el);
    handleAck(el);
    resendUnackedStanzas();
    const connection = api.connection.get();
    connection.do_bind = false; // No need to bind our resource anymore
    connection.authenticated = true;
    connection.restored = true;
    connection._changeConnectStatus(Strophe.Status.CONNECTED, null);
}

async function sendResumeStanza () {
    const promise = getOpenPromise();
    const connection = api.connection.get();
    connection._addSysHandler(el => promise.resolve(onResumedStanza(el)), Strophe.NS.SM, 'resumed');
    connection._addSysHandler(el => promise.resolve(onFailedStanza(el)), Strophe.NS.SM, 'failed');

    const previous_id = _converse.session.get('smacks_stream_id');
    const h = _converse.session.get('num_stanzas_handled');
    const stanza = stx`<resume xmlns="${Strophe.NS.SM}" h="${h}" previd="${previous_id}"/>`;
    api.send(stanza);
    connection.flush();
    await promise;
}

export async function sendEnableStanza () {
    if (!api.settings.get('enable_smacks') || _converse.session.get('smacks_enabled')) {
        return;
    }
    if (await isStreamManagementSupported()) {
        const promise = getOpenPromise();
        const connection = api.connection.get();
        connection._addSysHandler(el => promise.resolve(saveSessionData(el)), Strophe.NS.SM, 'enabled');
        connection._addSysHandler(el => promise.resolve(onFailedStanza(el)), Strophe.NS.SM, 'failed');

        const resume = api.connection.isType('websocket') || isTestEnv();
        const stanza = stx`<enable xmlns="${Strophe.NS.SM}" resume="${resume}"/>`;
        api.send(stanza);
        connection.flush();
        await promise;
    }
}

const smacks_handlers = [];

export async function enableStreamManagement () {
    if (!api.settings.get('enable_smacks')) {
        return;
    }
    if (!(await isStreamManagementSupported())) {
        return;
    }
    const conn = api.connection.get();
    while (smacks_handlers.length) {
        conn.deleteHandler(smacks_handlers.pop());
    }
    smacks_handlers.push(conn.addHandler(stanzaHandler));
    smacks_handlers.push(conn.addHandler(sendAck, Strophe.NS.SM, 'r'));
    smacks_handlers.push(conn.addHandler(handleAck, Strophe.NS.SM, 'a'));
    if (_converse.session?.get('smacks_stream_id')) {
        await sendResumeStanza();
    } else {
        resetSessionData();
    }
}

export function onStanzaSent (stanza) {
    if (!_converse.session) {
        log.warn('No _converse.session!');
        return;
    }
    if (!_converse.session.get('smacks_enabled')) {
        return;
    }
    if (u.isTagEqual(stanza, 'iq') || u.isTagEqual(stanza, 'presence') || u.isTagEqual(stanza, 'message')) {
        const stanza_string = Strophe.serialize(stanza);
        _converse.session.save(
            'unacked_stanzas',
            (_converse.session.get('unacked_stanzas') || []).concat([stanza_string])
        );
        const max_unacked = api.settings.get('smacks_max_unacked_stanzas');
        if (max_unacked > 0) {
            const num = _converse.session.get('num_stanzas_since_last_ack') + 1;
            if (num % max_unacked === 0) {
                // Request confirmation of sent stanzas
                api.send(stx`<r xmlns="${Strophe.NS.SM}"/>`);
            }
            _converse.session.save({ 'num_stanzas_since_last_ack': num });
        }
    }
}
