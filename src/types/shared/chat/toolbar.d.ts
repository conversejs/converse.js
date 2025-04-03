export class ChatToolbar extends CustomElement {
    static get properties(): {
        hidden_occupants: {
            type: BooleanConstructor;
        };
        is_groupchat: {
            type: BooleanConstructor;
        };
        message_limit: {
            type: NumberConstructor;
        };
        model: {
            type: ObjectConstructor;
        };
        show_call_button: {
            type: BooleanConstructor;
        };
        show_emoji_button: {
            type: BooleanConstructor;
        };
        show_send_button: {
            type: BooleanConstructor;
        };
        show_spoiler_button: {
            type: BooleanConstructor;
        };
    };
    model: any;
    is_groupchat: any;
    hidden_occupants: boolean;
    show_send_button: boolean;
    show_spoiler_button: boolean;
    show_call_button: boolean;
    show_emoji_button: boolean;
    connectedCallback(): void;
    render(): import("lit-html").TemplateResult<1>;
    firstUpdated(): void;
    getButtons(): any;
    /**
     * @param {boolean} is_supported
     */
    getHTTPUploadButton(is_supported: boolean): "" | import("lit-html").TemplateResult<1>;
    getSpoilerButton(): import("lit-html").TemplateResult<1>;
    /** @param {MouseEvent} ev */
    toggleFileUpload(ev: MouseEvent): void;
    /** @param {InputEvent} ev */
    onFileSelection(ev: InputEvent): void;
    /** @param {MouseEvent} ev */
    toggleComposeSpoilerMessage(ev: MouseEvent): void;
    /** @param {MouseEvent} ev */
    toggleCall(ev: MouseEvent): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=toolbar.d.ts.map