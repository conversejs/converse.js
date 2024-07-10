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
    hidden_occupants: any;
    show_spoiler_button: any;
    show_call_button: any;
    show_emoji_button: any;
    connectedCallback(): void;
    render(): import("lit").TemplateResult<1>;
    firstUpdated(): void;
    getButtons(): any;
    getHTTPUploadButton(is_supported: any): import("lit").TemplateResult<1> | "";
    getSpoilerButton(): import("lit").TemplateResult<1>;
    toggleFileUpload(ev: any): void;
    /**
     * @param {InputEvent} evt
     */
    onFileSelection(evt: InputEvent): void;
    toggleComposeSpoilerMessage(ev: any): void;
    toggleOccupants(ev: any): void;
    toggleCall(ev: any): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=toolbar.d.ts.map