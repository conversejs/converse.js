/**
 * @typedef {import('./model.js').default} Call
 */
import _converse from '../../shared/_converse.js';
import { Strophe } from 'strophe.js';
import { dial } from './utils.js';

/**
 * The "calls" namespace - the imperative entry the UI uses to start a call.
 * Per-call verbs (accept/reject/hangup/toggleAudio) live on the {@link Call} model.
 *
 * @namespace api.calls
 * @memberOf api
 */
export default {
    /**
     * Start an outgoing call to a contact. Returns the live call if one is
     * already in progress (one call at a time).
     * @method api.calls.dial
     * @param {string} jid - the contact to call
     * @param {{ audio?: boolean }} [opts]
     * @returns {Call}
     */
    dial(jid, opts) {
        return dial(jid, opts);
    },

    /**
     * Look up a call by its session id or by the peer's JID.
     * @method api.calls.get
     * @param {string} [id_or_jid] - omit to get all live calls
     * @returns {Call|Call[]|undefined}
     */
    get(id_or_jid) {
        const { calls } = _converse.state;
        if (id_or_jid === undefined) return calls.models;

        const call = calls.get(id_or_jid);
        if (call) return call;

        const bare_jid = Strophe.getBareJidFromJid(id_or_jid);
        return calls.find((c) => c.get('jid') === bare_jid);
    },
};
