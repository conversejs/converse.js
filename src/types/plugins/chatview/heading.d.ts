export default class ChatHeading extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): void;
    model: any;
    render(): import("lit").TemplateResult<1 | 2>;
    /**
     * @param {Event} ev
     */
    showUserDetailsModal(ev: Event): void;
    /**
     * @param {Event} ev
     */
    close(ev: Event): void;
    /**
     * Returns a list of objects which represent buttons for the chat's header.
     * @emits _converse#getHeadingButtons
     * @returns {Promise<Array.<import('./types').HeadingButtonAttributes>>}
     */
    getHeadingButtons(): Promise<Array<import("./types").HeadingButtonAttributes>>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=heading.d.ts.map