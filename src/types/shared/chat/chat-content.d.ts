export default class ChatContent extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    message_heights: Map<any, any>;
    scroll_debounce: NodeJS.Timeout;
    window_top: number;
    window_bottom: number;
    scrollHandler: (ev: Event) => void;
    connectedCallback(): void;
    initialize(): Promise<void>;
    render(): import("lit").TemplateResult<1> | "";
    get totalHeight(): number;
    resetWindow(): void;
    /**
     * @param {import('./message').default} el
     */
    handleMessageVisibility(el: import("./message").default): void;
    /**
     * Calculate the height of the virtual (i.e. not in the DOM)
     * messages above the visible window of chat messages.
     *
     * The topmost (virtual) message has an index of zero, so we count down
     * from `window_top` to zero.
     * @param {Number} window_top
     */
    calculateHeightAbove(window_top: number): number;
    /**
     * Calculate the height of the virutal (i.e. not in the DOM)
     * messages below the visible window of chat messages.
     *
     * The bottom-most (virtual) message has an index equal to the total minus one.
     * So we count up to it from from `window_bottom`.
     * @param {Number} window_bottom
     */
    calculateHeightBelow(window_bottom: number): number;
    scrollDown(): void;
    #private;
}
import { CustomElement } from "../components/element.js";
//# sourceMappingURL=chat-content.d.ts.map