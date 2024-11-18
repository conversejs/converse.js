export default class MUCOccupant extends CustomElement {
    static get properties(): {
        muc_jid: {
            type: StringConstructor;
        };
        occupant_id: {
            type: StringConstructor;
        };
    };
    muc_jid: any;
    occupant_id: any;
    initialize(): Promise<void>;
    muc: any;
    model: any;
    render(): import("lit").TemplateResult<1> | "";
    /**
     * @param {string} jid
     */
    openChat(jid: string): void;
    closeSidebar(): void;
    /** @param {MouseEvent} [ev] */
    showOccupantModal(ev?: MouseEvent): void;
    getVcard(): any;
    addToContacts(): void;
    /**
     * @param {MouseEvent} ev
     */
    toggleForm(ev: MouseEvent): void;
    show_role_form: any;
    show_affiliation_form: any;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=occupant.d.ts.map