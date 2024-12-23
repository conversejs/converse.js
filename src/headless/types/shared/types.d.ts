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
type XFormListTypes = 'list-single' | 'list-multi';
type XFormJIDTypes = 'jid-single' | 'jid-multi';
type XFormTextTypes = 'text-multi' | 'text-private' | 'text-single';
type XFormDateTypes = 'date' | 'datetime';
type XFormFieldTypes = XFormListTypes | XFormJIDTypes | XFormTextTypes | XFormDateTypes | 'fixed' | 'boolean' | 'url' | 'hidden';
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
export type XFormResponseType = 'result' | 'form';
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
export type ErrorName = 'bad-request' | 'conflict' | 'feature-not-implemented' | 'forbidden' | 'gone' | 'internal-server-error' | 'item-not-found' | 'jid-malformed' | 'not-acceptable' | 'not-allowed' | 'not-authorized' | 'payment-required' | 'recipient-unavailable' | 'redirect' | 'registration-required' | 'remote-server-not-found' | 'remote-server-timeout' | 'resource-constraint' | 'service-unavailable' | 'subscription-required' | 'undefined-condition' | 'unexpected-request';
export type ErrorType = 'auth' | 'cancel' | 'continue' | 'modify' | 'wait';
export {};
//# sourceMappingURL=types.d.ts.map