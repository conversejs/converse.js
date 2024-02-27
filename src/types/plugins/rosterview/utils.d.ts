export function removeContact(contact: any): void;
export function highlightRosterItem(chatbox: any): void;
export function toggleGroup(ev: any, name: any): void;
export function isContactFiltered(contact: any, groupname: any): boolean;
/**
 * @param {RosterContact} contact
 * @param {string} groupname
 * @param {Model} model
 */
export function shouldShowContact(contact: any, groupname: string, model: Model): boolean;
export function shouldShowGroup(group: any, model: any): boolean;
export function populateContactsMap(contacts_map: any, contact: any): any;
export type Model = import('@converse/skeletor').Model;
export type RosterContact = any;
//# sourceMappingURL=utils.d.ts.map