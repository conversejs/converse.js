/**
 * The codes that explain a failed encrypted send. Clients map them to their own text.
 */
export const SEND_ERROR: Readonly<{
    ENCRYPT_FAILED: "omemo-encrypt-failed";
    GROUPCHAT_NOT_ELIGIBLE: "omemo-groupchat-not-eligible";
    KEY_FETCH_FAILED: "omemo-key-fetch-failed";
    NO_DEVICES: "no-omemo-devices";
    REMOTE_SERVER_NOT_FOUND: "omemo-remote-server-not-found";
    SUBSCRIPTION_REQUIRED: "omemo-subscription-required";
}>;
/** @type {0} */ export const UNDECIDED: 0;
/** @type {1} */ export const TRUSTED: 1;
/** @type {-1} */ export const UNTRUSTED: -1;
export const TAG_LENGTH: 128;
export namespace KEY_ALGO {
    let name: string;
    let length: number;
}
//# sourceMappingURL=constants.d.ts.map