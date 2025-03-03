export default class RosterContact extends ObservableElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        observable: {
            type: StringConstructor;
        };
        intersectionRatio: {
            type: NumberConstructor;
        };
    };
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
import { ObservableElement } from 'shared/components/observable.js';
//# sourceMappingURL=contactview.d.ts.map