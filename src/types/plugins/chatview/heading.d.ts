export default class ChatHeading extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): void;
    model: any;
    render(): import("lit").TemplateResult<1>;
    showUserDetailsModal(ev: any): void;
    close(ev: any): void;
    /**
     * Returns a list of objects which represent buttons for the chat's header.
     * @emits _converse#getHeadingButtons
     */
    getHeadingButtons(): Promise<any>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=heading.d.ts.map