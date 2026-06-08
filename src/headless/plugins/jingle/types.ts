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
