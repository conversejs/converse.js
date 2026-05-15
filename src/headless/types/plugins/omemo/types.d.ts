import { MUCMessageAttributes } from '../../plugins/muc/types';
import { MessageAttributes, ModelAttributes } from '../../shared/types';
declare global {
    interface Window {
        libomemo?: Record<string, unknown>;
    }
}
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
export type DeviceAttributes = ModelAttributes & {
    id: number;
    jid: string;
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
export {};
//# sourceMappingURL=types.d.ts.map