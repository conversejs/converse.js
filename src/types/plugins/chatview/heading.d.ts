export default class ChatHeading extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    initialize(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    showUserDetailsModal(ev: any): void;
    close(ev: any): void;
    /**
     * Returns a list of objects which represent buttons for the chat's header.
     * @async
     * @emits _converse#getHeadingButtons
     */
    getHeadingButtons(): any;
}
/**
 * An object representing a chat heading button
 */
export type HeadingButtonAttributes = {
    /**
     *  True if shown on its own, false if it must be in the dropdown menu.
     */
    standalone: boolean;
    /**
     *  A handler function to be called when the button is clicked.
     */
    handler: Function;
    /**
     * - HTML classes to show on the button
     */
    a_class: string;
    /**
     * - The user-visiible name of the button
     */
    i18n_text: string;
    /**
     * - The tooltip text for this button
     */
    i18n_title: string;
    /**
     * - What kind of CSS class to use for the icon
     */
    icon_class: string;
    /**
     * - The internal name of the button
     */
    name: string;
};
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=heading.d.ts.map