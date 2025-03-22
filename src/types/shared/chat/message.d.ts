export default class Message extends ObservableElement {
    static get properties(): {
        model_with_messages: {
            type: ObjectConstructor;
        };
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
    model_with_messages: any;
    initialize(): Promise<void>;
    render(): import("lit").TemplateResult<1> | "";
    renderRetraction(): import("lit").TemplateResult<1>;
    renderMessageText(): import("lit").TemplateResult<1>;
    renderMEPMessage(): import("lit").TemplateResult<1>;
    renderInfoMessage(): import("lit").TemplateResult<1>;
    renderFileProgress(): import("lit").TemplateResult<1> | "";
    renderChatMessage(): import("lit").TemplateResult<1>;
    shouldShowAvatar(): boolean;
    onImgClick(ev: any): void;
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
import { ObservableElement } from 'shared/components/observable.js';
//# sourceMappingURL=message.d.ts.map