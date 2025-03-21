import { Collection, Model } from "@converse/skeletor";
export type ModelAttributes = Record<string, any>;
export interface ModelOptions {
    collection?: Collection;
    parse?: boolean;
    unset?: boolean;
    silent?: boolean;
}
export type RSMResult = {
    count?: string;
    first?: string;
    last?: string;
};
type Constructor<T = {}> = new (...args: any[]) => T;
export type ModelExtender = Constructor<Model>;
type EncryptionPayloadAttrs = {
    key?: string;
    prekey?: boolean;
    device_id: string;
};
export type RetractionAttrs = {
    editable: boolean;
    is_tombstone?: boolean;
    retracted: string;
    retracted_id?: string;
    retraction_id?: string;
};
export type EncryptionAttrs = {
    encrypted?: EncryptionPayloadAttrs;
    is_encrypted: boolean;
    encryption_namespace: string;
};
export type XFormReportedField = {
    var: string;
    label: string;
};
export type XFormResultItemField = {
    var: string;
    value: string;
};
export type XFormOption = {
    value: string;
    label: string;
    selected: boolean;
    required: boolean;
};
export type XFormCaptchaURI = {
    type: string;
    data: string;
};
type XFormListTypes = "list-single" | "list-multi";
type XFormJIDTypes = "jid-single" | "jid-multi";
type XFormTextTypes = "text-multi" | "text-private" | "text-single";
type XFormDateTypes = "date" | "datetime";
type XFormFieldTypes = XFormListTypes | XFormJIDTypes | XFormTextTypes | XFormDateTypes | "fixed" | "boolean" | "url" | "hidden";
export type XFormField = {
    var: string;
    label: string;
    type?: XFormFieldTypes;
    text?: string;
    value?: string;
    required?: boolean;
    checked?: boolean;
    options?: XFormOption[];
    uri?: XFormCaptchaURI;
    readonly: boolean;
};
export type XFormResponseType = "result" | "form";
export type XForm = {
    type: XFormResponseType;
    title?: string;
    instructions?: string;
    reported?: XFormReportedField[];
    items?: XFormResultItemField[][];
    fields?: XFormField[];
};
export type XEP372Reference = {
    begin: number;
    end: number;
    type: string;
    value: string;
    uri: string;
};
export type ErrorExtra = Record<string, string>;
export type ErrorName = "bad-request" | "conflict" | "feature-not-implemented" | "forbidden" | "gone" | "internal-server-error" | "item-not-found" | "jid-malformed" | "not-acceptable" | "not-allowed" | "not-authorized" | "payment-required" | "recipient-unavailable" | "redirect" | "registration-required" | "remote-server-not-found" | "remote-server-timeout" | "resource-constraint" | "service-unavailable" | "subscription-required" | "undefined-condition" | "unexpected-request";
export type ErrorType = "auth" | "cancel" | "continue" | "modify" | "wait";
export type Reference = {
    begin: number;
    end: number;
    type: string;
    uri: string;
};
export type MessageErrorAttributes = {
    is_error: boolean;
    error: string;
    errors: {
        name: string;
        xmlns: string;
    }[];
    error_condition: string;
    error_text: string;
    error_type: string;
};
export type MessageAttributes = EncryptionAttrs & MessageErrorAttributes & {
    body: string;
    chat_state: string;
    contact_jid: string;
    editable: boolean;
    edited: string;
    from: string;
    message?: string;
    fullname: string;
    is_archived: boolean;
    is_carbon: boolean;
    is_delayed: boolean;
    is_encrypted: boolean;
    is_headline: boolean;
    is_markable: boolean;
    is_marker: boolean;
    is_only_emojis: boolean;
    is_spoiler: boolean;
    is_tombstone: boolean;
    is_unstyled: boolean;
    is_valid_receipt_request: boolean;
    marker: string;
    marker_id: string;
    msgid: string;
    nick: string;
    ogp_for_id?: string;
    oob_desc: string;
    oob_url: string;
    origin_id: string;
    plaintext: string;
    receipt_id: string;
    received: string;
    references: Array<Reference>;
    replace_id: string;
    retracted: string;
    retracted_id: string;
    sender: "me" | "them";
    spoiler_hint: string;
    stanza_id: string;
    subject: string;
    thread: string;
    time: string;
    to: string;
    type: string;
};
export type FileUploadMessageAttributes = {
    body: string;
    message: string;
    oob_url: string;
    upload: 'success' | 'failure';
};
export {};
//# sourceMappingURL=types.d.ts.map