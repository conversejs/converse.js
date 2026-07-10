import { MUCMessageAttributes } from '../../plugins/muc/types';
import { JIDModelAttributes, MessageAttributes, ModelAttributes } from '../../shared/types';

declare global {
    interface Window {
        libomemo?: Record<string, unknown>;
    }
}

export type OMEMOVersion = 'eu.siacs.conversations.axolotl' | 'urn:xmpp:omemo:2';

export type OMEMOProfile = {
    version: OMEMOVersion;
    readonly devicelist_node: string;
    readonly bundle_node_prefix: string;
    usesSCE: boolean;
    encodePubKey: (b64: string) => string;
};

export type CounterpartyPreKey = {
    id: number;
    key: string;
};

export type Bundle = {
    identity_key: string;
    signed_prekey: {
        id: number;
        public_key: string;
        signature: string;
    };
    prekeys: CounterpartyPreKey[];
    fingerprint?: string;
};

export type DeviceAttributes = JIDModelAttributes & {
    id: number;
    bundle?: Bundle;
    trusted: 0 | 1 | -1;
    active: boolean;
};

type SerializedKeyPair = {
    pubKey: string;
    privKey: string;
};

type SerializedPreKey = {
    id: number;
    privKey: string;
    pubKey: string;
    signature: string;
};

export type OMEMOStoreAttributes = ModelAttributes & {
    identity_keypair: SerializedKeyPair;
    signed_prekey: SerializedPreKey;
    /** Whether the current bundle has been successfully published to the server. */
    bundle_published?: boolean;
};

export type EncryptedMessage = {
    key: ArrayBuffer;
    tag: ArrayBuffer;
    key_and_tag?: ArrayBuffer;
    payload: string;
    iv?: string;
};

export type EncryptedMessageAttributes = {
    iv: string;
    key: string;
    payload: string | null;
    prekey: boolean;
};

export type MUCMessageAttrsWithEncryption = MUCMessageAttributes & EncryptedMessageAttributes;
export type MessageAttrsWithEncryption = MessageAttributes & EncryptedMessageAttributes;
