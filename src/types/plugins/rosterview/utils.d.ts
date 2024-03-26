export function removeContact(contact: any): void;
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
export function populateContactsMap(contacts_map: any, contact: any): any;
export function contactsComparator(contact1: any, contact2: any): 0 | 1 | -1;
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
export type Model = import('@converse/skeletor').Model;
export type RosterContact = import('@converse/headless').RosterContact;
export type RosterContacts = import('@converse/headless').RosterContacts;
//# sourceMappingURL=utils.d.ts.map