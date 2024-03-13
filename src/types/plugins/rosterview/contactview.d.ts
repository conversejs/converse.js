export default class RosterContact extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    initialize(): void;
    render(): import("lit-html").TemplateResult<1>;
    openChat(ev: any): void;
    removeContact(ev: any): Promise<void>;
    acceptRequest(ev: any): Promise<void>;
    declineRequest(ev: any): Promise<RosterContact>;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=contactview.d.ts.map