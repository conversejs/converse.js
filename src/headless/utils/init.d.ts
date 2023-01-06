export function initConnection(): void;
export function initPlugins(_converse: any): void;
export function initClientConfig(_converse: any): Promise<void>;
export function initSessionStorage(_converse: any): Promise<void>;
/**
 * Stores the passed in JID for the current user, potentially creating a
 * resource if the JID is bare.
 *
 * Given that we can only create an XMPP connection if we know the domain of
 * the server connect to and we only know this once we know the JID, we also
 * call {@link initConnection } (if necessary) to make sure that the
 * connection is set up.
 *
 * @emits _converse#setUserJID
 * @params { String } jid
 */
export function setUserJID(jid: any): Promise<any>;
export function initSession(_converse: any, jid: any): Promise<void>;
export function registerGlobalEventHandlers(_converse: any): void;
export function cleanup(_converse: any): Promise<void>;
export function attemptNonPreboundSession(credentials: any, automatic: any): Promise<void>;
/**
 * Fetch the stored SCRAM keys for the given JID, if available.
 *
 * The user's plaintext password is not stored, nor any material from which
 * the user's plaintext password could be recovered.
 *
 * @param { String } JID - The XMPP address for which to fetch the SCRAM keys
 * @returns { Promise } A promise which resolves once we've fetched the previously
 *  used login keys.
 */
export function savedLoginInfo(jid: any): Promise<any>;
