export default class RosterContact extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    initialize(): void;
    render(): import("lit").TemplateResult<1>;
    openChat(ev: any): void;
    removeContact(ev: any): Promise<void>;
    acceptRequest(ev: any): Promise<void>;
    declineRequest(ev: any): Promise<this>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=contactview.d.ts.map