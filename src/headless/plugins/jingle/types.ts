import type { SessionDescription, MediaDescription } from 'sdp-transform';

export type { SessionDescription, MediaDescription };

export type JingleSenders = 'both' | 'initiator' | 'responder' | 'none';

export type SdpDirection = 'sendrecv' | 'sendonly' | 'recvonly' | 'inactive';

export type SdpCandidate = MediaDescription['candidates'][number];

export type JingleConversionOptions = {
    is_initiator: boolean;
    creator?: 'initiator' | 'responder';
    action?: string;
    sid?: string;
    initiator?: string;
    responder?: string;
};

export type CallMedia = 'audio' | 'video';

export type CallDirection = 'incoming' | 'outgoing';

export type CallState = 'calling' | 'ringing' | 'connecting' | 'active' | 'ended' | 'failed';

export type CallEndedReason = 'success' | 'declined' | 'cancelled' | 'answered-elsewhere' | 'no-media';

export type JMIAction = 'propose' | 'ringing' | 'proceed' | 'reject' | 'retract' | 'accept' | 'finish';

export type CallAttributes = {
    id: string; // = Jingle session id (sid)
    jid: string; // bare JID of the peer
    direction: CallDirection;
    media: CallMedia[];
    state: CallState;
    ended_reason: CallEndedReason | null;
    started_at: number | null;
    ended_at: number | null;
    muted_audio: boolean;
    muted_video: boolean;
    remote_video: boolean;
};

export type JMIData = {
    action: JMIAction;
    sid: string;
    from: string;
    to: string;
    media: CallMedia[];
};
