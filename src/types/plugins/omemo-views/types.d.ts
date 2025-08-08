import { MUCMessageAttributes, MessageAttributes } from "./utils";
export type EncryptedMessageAttributes = {
    iv: string;
    key: string;
    payload: string | null;
    prekey: boolean;
};
export type MUCMessageAttrsWithEncryption = MUCMessageAttributes & EncryptedMessageAttributes;
export type MessageAttrsWithEncryption = MessageAttributes & EncryptedMessageAttributes;
export type EncryptedMessage = {
    key: ArrayBuffer;
    tag: ArrayBuffer;
    key_and_tag: ArrayBuffer;
    payload: string;
    iv: string;
};
//# sourceMappingURL=types.d.ts.map