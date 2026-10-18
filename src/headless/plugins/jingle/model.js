import { Model } from '@converse/skeletor';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import ModelWithVCard from '../../shared/model-with-vcard.js';
import ModelWithContact from '../../shared/model-with-contact.js';
import ColorAwareModel from '../../shared/color.js';
import { buildAccept, buildProceed, buildReject, buildRetract } from './jmi.js';
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
            muted_video: false,
            remote_video: false,
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
     */
    armTimeout() {
        const state = this.get('state');
        const phase = [CALL_STATES.CALLING, CALL_STATES.RINGING].includes(state)
            ? 'answer'
            : state === CALL_STATES.CONNECTING
              ? 'connect'
              : null;
        if (phase === this.timed_phase) return;

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
            api.send(buildRetract(this.peer, this.sid));
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

    /** @returns {string} the Jingle session id */
    get sid() {
        return /** @type {string} */ (this.get('id'));
    }

    /** @returns {string} the peer's bare JID */
    get peer() {
        return /** @type {string} */ (this.get('jid'));
    }

    /**
     * The peer's full JID when known - the caller's resource for an incoming
     * call (the `<propose>`'s `from`), else the bare JID. JMI `<proceed>`,
     * `<ringing>` and `<reject>` must be addressed to the initiator's full JID:
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
     * Incoming call: accept it. Sends `<proceed>` to the caller and `<accept>`
     * to our own other devices so they stop ringing.
     */
    accept() {
        if (this.get('direction') !== CALL_DIRECTION.INCOMING || !this.isPreActive()) return;

        api.send(buildProceed(this.peer_full_jid, this.sid));
        api.send(buildAccept(_converse.session.get('bare_jid'), this.sid));
        this.set('state', CALL_STATES.CONNECTING);
    }

    /** Incoming call: decline it before it's active. */
    reject() {
        if (this.get('direction') !== CALL_DIRECTION.INCOMING || !this.isPreActive()) return;
        api.send(buildReject(this.peer_full_jid, this.sid));
        this.end(ENDED_REASONS.DECLINED);
    }

    /** End the call from our side: retract a not-yet-answered outgoing call, otherwise terminate. */
    hangup() {
        if (this.session) {
            // Past session-initiate, so it's a Jingle session-terminate, not a JMI retract.
            const reason = this.get('state') === CALL_STATES.ACTIVE ? ENDED_REASONS.SUCCESS : ENDED_REASONS.CANCELLED;
            this.session.terminate(reason);
            this.end(reason);
        } else if (this.get('direction') === CALL_DIRECTION.OUTGOING && this.isPreActive()) {
            api.send(buildRetract(this.peer, this.sid));
            this.end(ENDED_REASONS.CANCELLED);
        } else if (this.get('direction') === CALL_DIRECTION.INCOMING && this.get('state') === CALL_STATES.CONNECTING) {
            // Accepted, but the caller's session-initiate hasn't arrived yet.
            sendSessionTerminate(this.peer_full_jid, this.sid, ENDED_REASONS.CANCELLED);
            this.end(ENDED_REASONS.CANCELLED);
        } else {
            this.end(ENDED_REASONS.SUCCESS);
        }
    }

    /** Toggle the local microphone. */
    toggleAudio() {
        const muted = !this.get('muted_audio');
        this.local_stream?.getAudioTracks().forEach((t) => (t.enabled = !muted));
        this.set('muted_audio', muted);
    }

    toggleVideo() {
        throw new Error('toggleVideo: not implemented (v1 audio only)');
    }

    addVideo() {
        throw new Error('addVideo: not implemented (v1 audio only)');
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
        this.set({ state, ended_reason: reason, ended_at: Date.now(), missed });

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
