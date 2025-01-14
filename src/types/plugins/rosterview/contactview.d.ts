export default class RosterContact extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    initialize(): void;
    render(): import("lit").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    openChat(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    addContact(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    removeContact(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    blockContact(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    acceptRequest(ev: MouseEvent): Promise<void>;
    /**
     * @param {MouseEvent} ev
     */
    declineRequest(ev: MouseEvent): Promise<this>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=contactview.d.ts.map