/**
 * @param {RosterContact} contact
 */
export function removeContact(contact: RosterContact): Promise<void>;
export function highlightRosterItem(chatbox: any): void;
export function toggleGroup(ev: any, name: any): void;
/**
 * @param {RosterContact} contact
 * @param {string} groupname
 * @returns {boolean}
 */
export function isContactFiltered(contact: RosterContact, groupname: string): boolean;
/**
 * @param {RosterContact} contact
 * @param {string} groupname
 * @param {Model} model
 * @returns {boolean}
 */
export function shouldShowContact(contact: RosterContact, groupname: string, model: Model): boolean;
export function shouldShowGroup(group: any, model: any): boolean;
/**
 * @param {import('./types').ContactsMap} contacts_map
 * @param {RosterContact} contact
 * @returns {import('./types').ContactsMap}
 */
export function populateContactsMap(contacts_map: import("./types").ContactsMap, contact: RosterContact): import("./types").ContactsMap;
/**
 * @param {RosterContact} contact1
 * @param {RosterContact} contact2
 * @returns {(-1|0|1)}
 */
export function contactsComparator(contact1: RosterContact, contact2: RosterContact): (-1 | 0 | 1);
export function groupsComparator(a: any, b: any): 0 | 1 | -1;
export function getGroupsAutoCompleteList(): any[];
export function getJIDsAutoCompleteList(): any[];
/**
 * @param {string} query
 */
export function getNamesAutoCompleteList(query: string): Promise<{
    label: any;
    value: any;
}[]>;
export type Model = import("@converse/skeletor").Model;
export type RosterContact = import("@converse/headless").RosterContact;
export type RosterContacts = import("@converse/headless").RosterContacts;
//# sourceMappingURL=utils.d.ts.map