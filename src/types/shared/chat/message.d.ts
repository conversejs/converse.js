export default class Message extends CustomElement {
    static get properties(): {
        model_with_messages: {
            type: ObjectConstructor;
        };
        model: {
            type: ObjectConstructor;
        };
    };
    model_with_messages: any;
    model: any;
    initialize(): Promise<void>;
    render(): import("lit").TemplateResult<1> | "";
    renderRetraction(): import("lit").TemplateResult<1>;
    renderMessageText(): import("lit").TemplateResult<1>;
    renderMEPMessage(): import("lit").TemplateResult<1>;
    renderInfoMessage(): import("lit").TemplateResult<1>;
    renderFileProgress(): import("lit").TemplateResult<1> | "";
    renderChatMessage(): import("lit").TemplateResult<1>;
    shouldShowAvatar(): boolean;
    onUnfurlAnimationEnd(): void;
    onRetryClicked(): Promise<void>;
    show_spinner: boolean;
    hasMentions(): any;
    getOccupantAffiliation(): any;
    getOccupantRole(): any;
    getExtraMessageClasses(): string;
    getRetractionText(): any;
    showUserModal(ev: any): void;
    showMessageVersionsModal(ev: any): void;
    toggleSpoilerMessage(ev: any): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=message.d.ts.map