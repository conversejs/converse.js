/**
 * @class
 * @namespace _converse.RosterView
 * @memberOf _converse
 */
export default class RosterView extends CustomElement {
    initialize(): Promise<void>;
    model: Model;
    render(): import("lit").TemplateResult<1>;
    /** @param {MouseEvent} ev */
    showAddContactModal(ev: MouseEvent): void;
    /** @param {MouseEvent} ev */
    showNewChatModal(ev: MouseEvent): void;
    /** @param {MouseEvent} [ev] */
    syncContacts(ev?: MouseEvent): Promise<void>;
    syncing_contacts: boolean;
    /** @param {MouseEvent} [ev] */
    toggleRoster(ev?: MouseEvent): void;
    /** @param {MouseEvent} [ev] */
    toggleFilter(ev?: MouseEvent): void;
}
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/skeletor';
//# sourceMappingURL=rosterview.d.ts.map