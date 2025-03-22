/**
 * Implements a virtualized list of chat messages, which means only a subset of
 * messages, the `WINDOW_SIZE`, gets rendered to the DOM, and this subset
 * gets updated as the user scrolls up and down.
 */
export default class ChatContent extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        window_top: {
            state: boolean;
        };
        window_bottom: {
            state: boolean;
        };
    };
    model: any;
    scroll_debounce: any;
    window_top: number;
    window_bottom: number;
    scrollHandler: (ev: Event) => void;
    mark_scrolled_debounce: NodeJS.Timeout;
    initialize(): Promise<void>;
    render(): "" | import("lit").TemplateResult<1>;
    scrollDown(): void;
    #private;
}
import { CustomElement } from "../components/element.js";
//# sourceMappingURL=chat-content.d.ts.map