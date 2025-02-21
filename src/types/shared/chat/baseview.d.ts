export default class BaseChatView extends CustomElement {
    static get properties(): {
        jid: {
            type: StringConstructor;
        };
    };
    jid: any;
    model: any;
    updated(): void;
    close(ev: any): any;
    maybeFocus(): void;
    focus(): this;
    getBottomPanel(): Element | null;
    getMessageForm(): Element | null;
    /**
     * Scrolls the chat down.
     *
     * This method will always scroll the chat down, regardless of
     * whether the user scrolled up manually or not.
     * @param { Event } [ev] - An optional event that is the cause for needing to scroll down.
     */
    scrollDown(ev?: Event | undefined): void;
    onWindowStateChanged(): void;
}
export type Model = import("@converse/skeletor").Model;
import { CustomElement } from '../components/element.js';
//# sourceMappingURL=baseview.d.ts.map