/**
 * @param {RosterContact} contact
 * @param {boolean} [unauthorize]
 * @returns {Promise<boolean>}
 */
export function removeContact(contact: RosterContact, unauthorize?: boolean): Promise<boolean>;
/**
 * @param {RosterContact} contact
 */
export function declineContactRequest(contact: RosterContact): Promise<any>;
/**
 * @param {RosterContact} contact
 * @returns {Promise<boolean>}
 */
export function blockContact(contact: RosterContact): Promise<boolean>;
/**
 * @param {RosterContact} contact
 * @returns {Promise<boolean>}
 */
export function unblockContact(contact: RosterContact): Promise<boolean>;
/**
 * @param {string} jid
 */
export function highlightRosterItem(jid: string): void;
/**
 * @param {Event} ev
 * @param {string} name
 */
export function toggleGroup(ev: Event, name: string): void;
/**
 * @param {RosterContact|Profile} contact
 * @param {string} groupname
 * @returns {boolean}
 */
export function isContactFiltered(contact: RosterContact | Profile, groupname: string): boolean;
/**
 * @param {RosterContact} contact
 * @param {string} groupname
 * @param {import('@converse/headless').Model} model
 * @returns {boolean}
 */
export function shouldShowContact(contact: RosterContact, groupname: string, model: import("@converse/headless").Model): boolean;
/**
 * @param {string} group
 * @param {import('@converse/headless').Model} model
 */
export function shouldShowGroup(group: string, model: import("@converse/headless").Model): boolean;
/**
 * Populates a contacts map with the given contact, categorizing it into appropriate groups.
 * @param {import('./types').ContactsMap} contacts_map
 * @param {RosterContact} contact
 * @returns {import('./types').ContactsMap}
 */
export function populateContactsMap(contacts_map: import("./types").ContactsMap, contact: RosterContact): import("./types").ContactsMap;
/**
 * @param {RosterContact|Profile} contact1
 * @param {RosterContact|Profile} contact2
 * @returns {(-1|0|1)}
 */
export function contactsComparator(contact1: RosterContact | Profile, contact2: RosterContact | Profile): (-1 | 0 | 1);
/**
 * @param {string} a
 * @param {string} b
 */
export function groupsComparator(a: string, b: string): 0 | 1 | -1;
export function getGroupsAutoCompleteList(): string[];
/**
 * @returns {string[]}
 */
export function getJIDsAutoCompleteList(): string[];
/**
 * Clears the cached XMPP providers list.
 * Useful for testing or when the providers URL is changed.
 */
export function clearXMPPProvidersCache(): void;
/**
 * Fetches the list of XMPP providers from the configured URL.
 * Results are cached after the first successful fetch.
 * @returns {Promise<string[]>}
 */
export function fetchXMPPProviders(): Promise<string[]>;
/**
 * Returns a combined list of JID domains from the user's roster and XMPP providers.
 * Used for autocomplete when adding a contact.
 * This function fetches providers asynchronously and caches them for future use.
 * @param {string} _query - The current input value (unused, filtering is done by the autocomplete component)
 * @returns {Promise<string[]>}
 */
export function getJIDsAutoCompleteListWithProviders(_query: string): Promise<string[]>;
/**
 * @param {string} query
 */
export function getNamesAutoCompleteList(query: string): Promise<any[]>;
export type RosterContact = import("@converse/headless").RosterContact;
export type RosterContacts = import("@converse/headless").RosterContacts;
import { Profile } from '@converse/headless';
//# sourceMappingURL=utils.d.ts.map