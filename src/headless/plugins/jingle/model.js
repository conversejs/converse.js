import { Model } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import ModelWithVCard from '../../shared/model-with-vcard.js';
import ModelWithContact from '../../shared/model-with-contact.js';
import ColorAwareModel from '../../shared/color.js';
import {
    createAcceptStanza,
    createFinishStanza,
    createProceedStanza,
    createRejectStanza,
    createRetractStanza,
} from './jmi.js';
import RTPSession, { sendSessionTerminate } from './rtp.js';
import { CALL_DIRECTION, CALL_STATES, CONNECT_TIMEOUT, ENDED_REASONS, RING_TIMEOUT } from './constants.js';

/**
 * A single 1:1 call. The UI only reads these attributes and calls these methods;
 * the signalling lives below.
 *
 * Mixin stack = ChatBox's minus ModelWithMessages (a call has no message log),
 * which gives us `call.contact` and `call.vcard` so `<converse-avatar>` works.
 */
class Call extends ModelWithVCard(ModelWithContact(ColorAwareModel(Model))) {
    defaults() {
        return {
            direction: CALL_DIRECTION.OUTGOING,
            media: ['audio'],
            state: CALL_STATES.CALLING,
            ended_reason: null,
            missed: false,
            started_at: null,
            ended_at: null,
            muted_audio: false,
        };
    }

    /**
     * @param {import('@converse/skeletor').ModelAttributes} attrs
     * @param {import('@converse/skeletor').ModelOptions} [options]
     */
    constructor(attrs, options = {}) {
        super(attrs, options);

        // Not serializable, so they're plain props signalled by the `stream`
        // event rather than skeletor attributes.
        this.local_stream = null;
        this.remote_stream = null;

        // The Jingle RTP session, created lazily by startSession().
        this.session = null;

        this.timeout = null;
        this.timed_phase = null;
        this.on('change:state', () => this.armTimeout());
        this.armTimeout();
    }

    /**
     * Give up on a call that waits too long for an answer, or for its media to
     * connect. Ringing after calling is still the same wait for an answer.
     * @param {boolean} [restart=false] - wait afresh, even if still in the same phase
     */
    armTimeout(restart = false) {
        const state = this.get('state');
        const phase = [CALL_STATES.CALLING, CALL_STATES.RINGING].includes(state)
            ? 'answer'
            : state === CALL_STATES.CONNECTING
              ? 'connect'
              : null;
        if (phase === this.timed_phase && !restart) return;

        clearTimeout(this.timeout);
        this.timed_phase = phase;
        if (phase === 'answer') {
            this.timeout = setTimeout(() => this.onNoAnswer(), RING_TIMEOUT);
        } else if (phase === 'connect') {
            this.timeout = setTimeout(() => this.onConnectTimeout(), CONNECT_TIMEOUT);
        }
    }

    /** Our outgoing call is retracted; an incoming one stops ringing without telling the caller. */
    onNoAnswer() {
        if (this.get('direction') === CALL_DIRECTION.OUTGOING) {
            api.send(createRetractStanza(this.peer, this.sid));
        }
        this.end(ENDED_REASONS.NO_ANSWER);
    }

    onConnectTimeout() {
        if (this.session) {
            this.session.fail(ENDED_REASONS.CONNECTIVITY_ERROR);
        } else {
            // Accepted, but the caller's session-initiate never came.
            sendSessionTerminate(this.peer_full_jid, this.sid, ENDED_REASONS.CONNECTIVITY_ERROR);
            this.fail(ENDED_REASONS.CONNECTIVITY_ERROR);
        }
    }

    initialize() {
        super.initialize();
        this.setModelContact(this.get('jid'));
    }

    get idAttribute() {
        return 'id';
    }

    /**
     * The call is keyed by its Jingle session id, which changes if the peer
     * carries the call on in a new session (see {@link Call#migrate}).
     * @returns {string} the Jingle session id
     */
    get sid() {
        return /** @type {string} */ (this.get('id'));
    }

    /** @returns {string} the peer's bare JID */
    get peer() {
        return /** @type {string} */ (this.get('jid'));
    }

    /**
     * The peer's full JID when known - the caller's resource for an incoming
     * call (the `<propose>`'s `from`), the callee's for an answered outgoing
     * one (the `<proceed>`'s `from`), else the bare JID. JMI `<proceed>`,
     * `<ringing>`, `<reject>` and `<finish>` must be addressed to a full JID:
     * peers (e.g. Conversations) ignore them otherwise.
     * @returns {string}
     */
    get peer_full_jid() {
        return /** @type {string} */ (this.get('full_jid') || this.get('jid'));
    }

    /** True while the call hasn't connected media yet (calling/ringing/connecting). */
    isPreActive() {
        return ![CALL_STATES.ACTIVE, CALL_STATES.ENDED, CALL_STATES.FAILED].includes(this.get('state'));
    }

    /**
     * Whether the call ended without anything to show for it: it gave way to
     * the peer's, proposed at the same time, which gets its own history line
     * and summary.
     */
    leavesNoTrace() {
        return this.get('ended_reason') === ENDED_REASONS.TIE_BREAK;
    }

    /** Whether the call got past `<proceed>` and isn't over yet. */
    isAnswered() {
        return [CALL_STATES.CONNECTING, CALL_STATES.ACTIVE].includes(this.get('state'));
    }

    /**
     * Whether the call was answered and waits for the peer's session-initiate.
     * We start our own sessions as soon as the call is answered, so only a
     * session the peer proposed is ever waited for.
     */
    awaitsSession() {
        return this.get('state') === CALL_STATES.CONNECTING && !this.session;
    }

    /**
     * Incoming call: accept it. Sends `<proceed>` to the caller and `<accept>`
     * to our own other devices so they stop ringing.
     */
    accept() {
        if (this.get('direction') !== CALL_DIRECTION.INCOMING || !this.isPreActive()) return;

        this.#proceed();
        this.set('state', CALL_STATES.CONNECTING);
    }

    /** Take up the session the peer proposed. */
    #proceed() {
        api.send(createProceedStanza(this.peer_full_jid, this.sid));
        api.send(createAcceptStanza(_converse.session.get('bare_jid'), this.sid));
    }

    /** Incoming call: decline it before it's active. */
    reject() {
        if (this.get('direction') !== CALL_DIRECTION.INCOMING || !this.isPreActive()) return;
        api.send(createRejectStanza(this.peer_full_jid, this.sid));
        this.end(ENDED_REASONS.DECLINED);
    }

    /** End the call from our side: retract a not-yet-answered outgoing call, otherwise terminate. */
    hangup() {
        if (this.session) {
            // Past session-initiate, so it's a Jingle session-terminate, not a JMI retract.
            const reason = this.get('state') === CALL_STATES.ACTIVE ? ENDED_REASONS.SUCCESS : ENDED_REASONS.CANCELLED;
            this.session.terminate(reason);
            this.end(reason);
        } else if (
            this.get('direction') === CALL_DIRECTION.OUTGOING &&
            [CALL_STATES.CALLING, CALL_STATES.RINGING].includes(this.get('state'))
        ) {
            api.send(createRetractStanza(this.peer, this.sid));
            this.end(ENDED_REASONS.CANCELLED);
        } else if (this.awaitsSession()) {
            // Accepted, but the peer's session-initiate hasn't arrived yet.
            sendSessionTerminate(this.peer_full_jid, this.sid, ENDED_REASONS.CANCELLED);
            this.end(ENDED_REASONS.CANCELLED);
        } else {
            this.end(ENDED_REASONS.SUCCESS);
        }
    }

    /**
     * The peer carries this answered call on in a new session it proposed
     * (XEP-0353 § 9.2), e.g. from another device or after losing its
     * connection. Finish the old session as migrated, and take up the new one
     * without ringing, since the user already took the call. It stays the same
     * call, so what the user sees of it (how long it has lasted, whether they
     * muted it) carries on too.
     * @param {string} sid - the new session's id
     * @param {string} from - the full JID that proposed it
     * @param {import('./types').CallMedia[]} media
     */
    migrate(sid, from, media) {
        const old_sid = this.sid;
        if (this.session) {
            this.session.terminate(ENDED_REASONS.MIGRATED);
            this.session.close();
            this.session = null;
        } else {
            sendSessionTerminate(this.peer_full_jid, old_sid, ENDED_REASONS.MIGRATED);
        }
        // Told to all the peer's devices, as the new session may be on another.
        api.send(createFinishStanza(this.peer, old_sid, ENDED_REASONS.MIGRATED, { migrated_to: sid }));

        this.set({ id: sid, full_jid: from, media, state: CALL_STATES.CONNECTING });
        this.armTimeout(true); // the new session gets its own time to connect
        this.#proceed();
    }

    /** Toggle the local microphone. */
    toggleAudio() {
        const muted = !this.get('muted_audio');
        this.local_stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
        this.set('muted_audio', muted);
    }

    /**
     * End the call. Fires the app-wide `callEnded` event for toolbar/notification
     * listeners; the call view removes itself from the collection once dismissed.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    end(reason) {
        this.markEnded(CALL_STATES.ENDED, reason);
    }

    /**
     * Abnormal end - same teardown as {@link Call#end} but lands in `failed`.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    fail(reason) {
        this.markEnded(CALL_STATES.FAILED, reason);
    }

    /**
     * @param {string} state - the terminal state, `ended` or `failed`
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    markEnded(state, reason) {
        if ([CALL_STATES.ENDED, CALL_STATES.FAILED].includes(this.get('state'))) return;

        // Only an incoming call that was still ringing when it ended went unanswered.
        const missed =
            this.get('direction') === CALL_DIRECTION.INCOMING &&
            this.get('state') === CALL_STATES.RINGING &&
            [ENDED_REASONS.CANCELLED, ENDED_REASONS.NO_ANSWER].includes(reason);
        // Only a call that got past <proceed> is finished; the others ended with a JMI message of their own.
        const answered = this.isAnswered();
        this.set({ state, ended_reason: reason, ended_at: Date.now(), missed });

        if (answered && api.connection.connected()) {
            api.send(createFinishStanza(this.peer_full_jid, this.sid, reason));
        }

        this.session?.close?.();
        this.session = null;

        api.trigger('callEnded', this);
        // Only live calls are kept. A view that shows the ended call keeps its own reference.
        this.collection?.remove(this);
    }

    /**
     * Outgoing call: create the Jingle RTP session once the call reaches
     * `connecting`, and begin negotiating media.
     * @param {string} peer_jid - full JID of the remote endpoint
     */
    startSession(peer_jid) {
        this.session = new RTPSession(this, peer_jid);
        this.session.initiate();
    }

    /**
     * Incoming call: create the answering session. The caller's session-initiate
     * drives the rest; the peer (caller) is the Jingle initiator.
     * @param {string} peer_jid - full JID of the caller
     */
    answerSession(peer_jid) {
        this.session = new RTPSession(this, peer_jid, false);
    }
}

export default Call;
