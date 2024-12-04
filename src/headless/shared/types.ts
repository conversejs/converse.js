import { Model } from '@converse/skeletor';

// Types for mixins.
// -----------------

// Represents the class that will be extended via a mixin.
type Constructor<T = {}> = new (...args: any[]) => T;

export type ModelExtender = Constructor<Model>;

type EncryptionPayloadAttrs = {
    prekey?: boolean;
    device_id: string;
};

export type EncryptionAttrs = {
    encrypted?: EncryptionPayloadAttrs; //  XEP-0384 encryption payload attributes
    is_encrypted: boolean;
    encryption_namespace: string;
};
