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

export type RetractionAttrs = {
    editable: boolean;
    is_tombstone?: boolean;
    retracted: string;
    retracted_id?: string; // ID of the message being retracted
    retraction_id?: string; // ID of the retraction message
}

export type EncryptionAttrs = {
    encrypted?: EncryptionPayloadAttrs; //  XEP-0384 encryption payload attributes
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
type XFormFieldTypes =
    | XFormListTypes
    | XFormJIDTypes
    | XFormTextTypes
    | XFormDateTypes
    | 'fixed'
    | 'boolean'
    | 'url'
    | 'hidden';

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

// An object representing XEP-0372 reference data
export type XEP372Reference = {
    begin: number;
    end: number;
    type: string;
    value: string;
    uri: string;
};

export type ErrorExtra = Record<string, string>;

// https://datatracker.ietf.org/doc/html/rfc6120#section-8.3
export type ErrorName =
    | 'bad-request'
    | 'conflict'
    | 'feature-not-implemented'
    | 'forbidden'
    | 'gone'
    | 'internal-server-error'
    | 'item-not-found'
    | 'jid-malformed'
    | 'not-acceptable'
    | 'not-allowed'
    | 'not-authorized'
    | 'payment-required'
    | 'recipient-unavailable'
    | 'redirect'
    | 'registration-required'
    | 'remote-server-not-found'
    | 'remote-server-timeout'
    | 'resource-constraint'
    | 'service-unavailable'
    | 'subscription-required'
    | 'undefined-condition'
    | 'unexpected-request';

export type ErrorType = 'auth' | 'cancel' | 'continue' | 'modify' | 'wait';
