export default class Message extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
        mid: {
            type: StringConstructor;
        };
    };
    jid: any;
    mid: any;
    initialize(): Promise<void>;
    setModels(): Promise<void>;
    chatbox: any;
    model: any;
    render(): import("lit-html").TemplateResult<1> | "";
    getProps(): any;
    renderRetraction(): import("lit-html").TemplateResult<1>;
    renderMessageText(): import("lit-html").TemplateResult<1>;
    renderMEPMessage(): import("lit-html").TemplateResult<1>;
    renderInfoMessage(): import("lit-html").TemplateResult<1>;
    renderFileProgress(): import("lit-html").TemplateResult<1> | "";
    renderChatMessage(): import("lit-html").TemplateResult<1>;
    shouldShowAvatar(): boolean;
    onUnfurlAnimationEnd(): void;
    onRetryClicked(): Promise<void>;
    show_spinner: boolean;
    isRetracted(): any;
    hasMentions(): any;
    getOccupantAffiliation(): any;
    getOccupantRole(): any;
    getExtraMessageClasses(): string;
    getDerivedMessageProps(): {
        pretty_time: any;
        has_mentions: any;
        hats: any[];
        is_first_unread: boolean;
        is_me_message: any;
        is_retracted: any;
        username: any;
        color: any;
        should_show_avatar: boolean;
        colorize_username: any;
    };
    getRetractionText(): any;
    showUserModal(ev: any): void;
    showMessageVersionsModal(ev: any): void;
    toggleSpoilerMessage(ev: any): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=message.d.ts.map