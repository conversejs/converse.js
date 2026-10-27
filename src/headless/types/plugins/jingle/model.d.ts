export default Call;
declare const Call_base: (new (attributes?: Partial<import("@converse/skeletor").ModelAttributes>, options?: import("@converse/skeletor").ModelOptions) => Model<import("@converse/skeletor").ModelAttributes>) & import("../../shared/types.js").Constructor<import("../../shared/types.js").ColorAware> & import("../../shared/types.js").Constructor<import("../../shared/types.js").ContactAware> & import("../../shared/types.js").Constructor<import("../../shared/types.js").VCardAware>;
/**
 * A single 1:1 call. The UI only reads these attributes and calls these methods;
 * the signalling lives below.
 *
 * Mixin stack = ChatBox's minus ModelWithMessages (a call has no message log),
 * which gives us `call.contact` and `call.vcard` so `<converse-avatar>` works.
 */
declare class Call extends Call_base {
    /**
     * @param {import('@converse/skeletor').ModelAttributes} attrs
     * @param {import('@converse/skeletor').ModelOptions} [options]
     */
    constructor(attrs: import("@converse/skeletor").ModelAttributes, options?: import("@converse/skeletor").ModelOptions);
    defaults(): {
        direction: string;
        media: string[];
        state: string;
        ended_reason: any;
        missed: boolean;
        started_at: any;
        ended_at: any;
        muted_audio: boolean;
    };
    local_stream: any;
    remote_stream: any;
    session: RTPSession;
    timeout: number;
    timed_phase: any;
    /**
     * Give up on a call that waits too long for an answer, or for its media to
     * connect. Ringing after calling is still the same wait for an answer.
     * @param {boolean} [restart=false] - wait afresh, even if still in the same phase
     */
    armTimeout(restart?: boolean): void;
    /** Our outgoing call is retracted; an incoming one stops ringing without telling the caller. */
    onNoAnswer(): void;
    onConnectTimeout(): void;
    initialize(): void;
    /**
     * The call is keyed by its Jingle session id, which changes if the peer
     * carries the call on in a new session (see {@link Call#migrate}).
     * @returns {string} the Jingle session id
     */
    get sid(): string;
    /** @returns {string} the peer's bare JID */
    get peer(): string;
    /**
     * The peer's full JID when known - the caller's resource for an incoming
     * call (the `<propose>`'s `from`), the callee's for an answered outgoing
     * one (the `<proceed>`'s `from`), else the bare JID. JMI `<proceed>`,
     * `<ringing>`, `<reject>` and `<finish>` must be addressed to a full JID:
     * peers (e.g. Conversations) ignore them otherwise.
     * @returns {string}
     */
    get peer_full_jid(): string;
    /** True while the call hasn't connected media yet (calling/ringing/connecting). */
    isPreActive(): boolean;
    /**
     * Whether the call ended without anything to show for it: it gave way to
     * the peer's, proposed at the same time, which gets its own history line
     * and summary.
     */
    leavesNoTrace(): boolean;
    /** Whether the call got past `<proceed>` and isn't over yet. */
    isAnswered(): boolean;
    /**
     * Whether the call was answered and waits for the peer's session-initiate.
     * We start our own sessions as soon as the call is answered, so only a
     * session the peer proposed is ever waited for.
     */
    awaitsSession(): boolean;
    /**
     * Incoming call: accept it. Sends `<proceed>` to the caller and `<accept>`
     * to our own other devices so they stop ringing.
     */
    accept(): void;
    /** Incoming call: decline it before it's active. */
    reject(): void;
    /** End the call from our side: retract a not-yet-answered outgoing call, otherwise terminate. */
    hangup(): void;
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
    migrate(sid: string, from: string, media: import("./types").CallMedia[]): void;
    /** Toggle the local microphone. */
    toggleAudio(): void;
    /**
     * End the call. Fires the app-wide `callEnded` event for toolbar/notification
     * listeners; the call view removes itself from the collection once dismissed.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    end(reason: string): void;
    /**
     * Abnormal end - same teardown as {@link Call#end} but lands in `failed`.
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    fail(reason: string): void;
    /**
     * @param {string} state - the terminal state, `ended` or `failed`
     * @param {string} reason - one of {@link ENDED_REASONS}
     */
    markEnded(state: string, reason: string): void;
    /**
     * Outgoing call: create the Jingle RTP session once the call reaches
     * `connecting`, and begin negotiating media.
     * @param {string} peer_jid - full JID of the remote endpoint
     */
    startSession(peer_jid: string): void;
    /**
     * Incoming call: create the answering session. The caller's session-initiate
     * drives the rest; the peer (caller) is the Jingle initiator.
     * @param {string} peer_jid - full JID of the caller
     */
    answerSession(peer_jid: string): void;
    #private;
}
import { Model } from '@converse/skeletor';
import RTPSession from './rtp.js';
//# sourceMappingURL=model.d.ts.map