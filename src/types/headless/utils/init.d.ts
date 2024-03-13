/**
 * Initializes the plugins for the Converse instance.
 * @param {ConversePrivateGlobal} _converse
 * @fires _converse#pluginsInitialized - Triggered once all plugins have been initialized.
 * @memberOf _converse
 */
export function initPlugins(_converse: any): void;
/**
 * @param {ConversePrivateGlobal} _converse
 */
export function initClientConfig(_converse: any): Promise<void>;
/**
 * @param {ConversePrivateGlobal} _converse
 */
export function initSessionStorage(_converse: any): Promise<void>;
/**
 * Stores the passed in JID for the current user, potentially creating a
 * resource if the JID is bare.
 *
 * Given that we can only create an XMPP connection if we know the domain of
 * the server connect to and we only know this once we know the JID, we also
 * call {@link api.connection.init} (if necessary) to make sure that the
 * connection is set up.
 *
 * @emits _converse#setUserJID
 * @param {string} jid
 */
export function setUserJID(jid: string): Promise<string>;
/**
 * @param {ConversePrivateGlobal} _converse
 * @param {string} jid
 */
export function initSession(_converse: any, jid: string): Promise<void>;
/**
 * @param {ConversePrivateGlobal} _converse
 */
export function registerGlobalEventHandlers(_converse: any): void;
/**
 * Make sure everything is reset in case this is a subsequent call to
 * converse.initialize (happens during tests).
 * @param {ConversePrivateGlobal} _converse
 */
export function cleanup(_converse: any): Promise<void>;
export function attemptNonPreboundSession(credentials: any, automatic: any): Promise<void>;
/**
 * Fetch the stored SCRAM keys for the given JID, if available.
 *
 * The user's plaintext password is not stored, nor any material from which
 * the user's plaintext password could be recovered.
 *
 * @param { String } jid - The XMPP address for which to fetch the SCRAM keys
 * @returns { Promise } A promise which resolves once we've fetched the previously
 *  used login keys.
 */
export function savedLoginInfo(jid: string): Promise<any>;
export type ConversePrivateGlobal = any;
//# sourceMappingURL=init.d.ts.map