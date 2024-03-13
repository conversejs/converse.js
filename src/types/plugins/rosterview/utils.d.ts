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
export type Model = import('@converse/skeletor').Model;
export type RosterContact = import('@converse/headless').RosterContact;
//# sourceMappingURL=utils.d.ts.map