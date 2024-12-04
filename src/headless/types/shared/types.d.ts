import { Model } from '@converse/skeletor';
type Constructor<T = {}> = new (...args: any[]) => T;
export type ModelExtender = Constructor<Model>;
type EncryptionPayloadAttrs = {
    prekey?: boolean;
    device_id: string;
};
export type EncryptionAttrs = {
    encrypted?: EncryptionPayloadAttrs;
    is_encrypted: boolean;
    encryption_namespace: string;
};
export {};
//# sourceMappingURL=types.d.ts.map