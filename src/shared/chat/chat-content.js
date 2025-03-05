import { html } from "lit";
import { api } from "@converse/headless";
import tplSpinner from "templates/spinner.js";
import { CustomElement } from "../components/element.js";
import { onScrolledDown } from "./utils.js";
import "./message-history";

import "./styles/chat-content.scss";

// Default estimated height for messages
const ESTIMATED_MESSAGE_HEIGHT = 40; // px
const VISIBLE_BUFFER = 20; // Number of extra messages to render above/below

/**
 * Implements a virtualized list of chat messages, which means only a subset of
 * messages, the `WINDOW_SIZE`, gets rendered to the DOM, and this subset
 * gets updated as the user scrolls up and down.
 */
export default class ChatContent extends CustomElement {
    /**
     * @typedef {import('../../plugins/chatview/chat.js').default} ChatView
     * @typedef {import('../../plugins/muc-views/muc.js').default} MUCView
     * @typedef {import('../../plugins/muc-views/occupant').default} MUCOccupantView
     */
    constructor() {
        super();
        this.model = null;
        this.message_heights = new Map(); // Cache of actual message heights
        this.scrollTop = 0;
        this.scroll_debounce = null;

        // Index of the top message in the virtualized list window.
        // If all messages are shown, this value is equal to zero.
        this.window_top = 0;

        // Index of the bottom message in the virtualized list window.
        // If all messages are shown, this value is equal to the total minus one.
        this.window_bottom = 0;

        this.scrollHandler = /** @param {Event} ev */ (ev) => {
            if (this.scroll_debounce) {
                clearTimeout(this.scroll_debounce);
            }
            this.scroll_debounce = setTimeout(() => {
                this.#markScrolled(ev);
                this.#setWindowOnScroll();
            }, 250);
        };
    }

    static get properties() {
        return {
            model: { type: Object },
            window_top: { state: true },
            window_bottom: { state: true },
        };
    }

    async initialize() {
        await this.model.initialized;
        this.listenTo(this.model.messages, "add", () => this.requestUpdate());
        this.listenTo(this.model.messages, "change", () => this.requestUpdate());
        this.listenTo(this.model.messages, "remove", () => this.requestUpdate());
        this.listenTo(this.model.messages, "rendered", () => this.requestUpdate());
        this.listenTo(this.model.messages, "reset", () => this.requestUpdate());
        this.listenTo(this.model.notifications, "change", () => this.requestUpdate());
        this.listenTo(this.model.ui, "change", () => this.requestUpdate());
        this.listenTo(this.model.ui, "change:scrolled", () => this.scrollDown());

        this.#setWindow();

        // Listen for message visibility changes
        api.listen.on("visibilityChanged", ({ el }) => this.handleMessageVisibility(el));
        this.requestUpdate();
    }

    render() {
        if (!this.model) return "";

        let window_top = 0;
        let window_bottom = 0;
        /** @type {Array<import('@converse/headless').BaseMessage>} */
        let visible_messages = [];

        // Calculate visible range
        const total_messages = this.model.messages.length;
        if (total_messages) {
            window_bottom = Math.min(total_messages - 1, this.window_bottom + VISIBLE_BUFFER);
            window_top = Math.max(0, this.window_top - VISIBLE_BUFFER);
            visible_messages = this.model.messages.slice(window_top, window_bottom + 1);
        }

        // Calculate placeholder heights
        let height_above = 0;
        let height_below = 0;
        if (total_messages) {
            height_above = window_top > 0 ? this.calculateHeightAbove(window_top) : 0;
            height_below = window_bottom < total_messages - 1 ? this.calculateHeightBelow(window_bottom) : 0;
        }

        return html`
            <div
                class="chat-content__messages"
                style="height: ${this.totalHeight ? this.totalHeight + "px" : "100%"}"
                @scroll="${/** @param {Event} ev */ (ev) => this.scrollHandler(ev)}"
            >
                <div style="height: ${height_below + "px"}"></div>
                <div class="chat-content__notifications">${this.model.getNotificationsText()}</div>
                <converse-message-history .model=${this.model} .messages=${visible_messages}></converse-message-history>
                <div style="height: ${height_above + "px"}"></div>
            </div>
            ${this.model.ui?.get("chat-content-spinner-top") ? tplSpinner() : ""}
        `;
    }

    get totalHeight() {
        return this.calculateHeightAbove(this.model.messages.length - 1);
    }

    /**
     * Called when the chat content is scrolled up or down.
     * We want to record when the user has scrolled away from
     * the bottom, so that we don't automatically scroll away
     * from what the user is reading when new messages are received.
     * @param {Event} ev
     */
    #markScrolled(ev) {
        let scrolled = true;

        const el = /** @type {ChatView|MUCView|MUCOccupantView} */ (ev.target);
        const is_at_bottom = Math.floor(el.scrollTop) === 0;
        const is_at_top =
            Math.ceil(el.clientHeight - el.scrollTop) >= el.scrollHeight - Math.ceil(el.scrollHeight / 20);

        if (is_at_bottom) {
            scrolled = false;
            onScrolledDown(this.model);
        } else if (is_at_top) {
            /**
             * Triggered once the chat's message area has been scrolled to the top
             * @event _converse#chatBoxScrolledUp
             * @property { _converse.ChatBoxView | MUCView } view
             * @example _converse.api.listen.on('chatBoxScrolledUp', obj => { ... });
             */
            api.trigger("chatBoxScrolledUp", el);
        }
        if (this.model.get("scolled") !== scrolled) {
            this.model.ui.set({ scrolled });
        }
    }

    /**
     * Scroll event handler, which sets new window bounds based on whether the
     * scrollbar is at the top or bottom, or otherwise based on which
     * messages are visible within the scrollable area.
     */
    #setWindowOnScroll() {
        const total_messages = this.model.messages.length;
        const container = /** @type {HTMLElement} */ (this.querySelector(".chat-content__messages"));

        const is_at_top =
            Math.ceil(container.clientHeight - container.scrollTop) >=
            container.scrollHeight - Math.ceil(container.scrollHeight / 20);

        if (is_at_top) {
            this.window_top = Math.max(0, this.window_top - VISIBLE_BUFFER);
            return;
        }

        const is_at_bottom = Math.floor(container.scrollTop) === 0;
        if (is_at_bottom) {
            this.window_bottom = Math.min(total_messages - 1, this.window_bottom + VISIBLE_BUFFER);
            return;
        }

        this.#setWindow();
    }

    /**
     * Determine and set the `window_bottom` and `window_top` indexes for the virtualized list window.
     */
    #setWindow() {
        const total_messages = this.model.messages.length;
        const container = /** @type {HTMLElement} */ (this.querySelector(".chat-content__messages"));

        // Because we use `flex-direction: reverse`, scrollTop is zero when
        // scrolled down and minus this.totalHeight when scrolled all the way up.
        // Note, this is the opposite of our window, where the top index is
        // zero and the bottom index is the total number of messages.
        const scroll_bottom = Math.round(Math.abs(container.scrollTop));
        const container_height = container.offsetHeight;
        const scroll_top = scroll_bottom + container_height;

        // Find new window bottom, which is the first visible message (from the bottom).
        let height = 0;
        let new_window_bottom = total_messages - 1;
        let i;

        for (i = total_messages - 1; i >= 0; i--) {
            const message = this.model.messages.at(i);
            const message_height = this.message_heights.get(message.get("id")) || ESTIMATED_MESSAGE_HEIGHT;
            if (height + message_height > scroll_bottom) {
                new_window_bottom = i;
                break;
            }
            height += message_height;
        }

        // Find new window top, which is last visible message (from the bottom).
        let new_window_top = new_window_bottom;

        for (let j = i - 1; j >= 0; j--) {
            const message = this.model.messages.at(j);
            const message_height = this.message_heights.get(message.get("id")) || ESTIMATED_MESSAGE_HEIGHT;
            if (height + message_height >= scroll_top) {
                new_window_top = j;
                break;
            }
            height += message_height;
        }

        if (new_window_bottom !== this.window_bottom || new_window_top !== this.window_top) {
            this.window_bottom = new_window_bottom;
            this.window_top = new_window_top;
        }
    }

    /**
     * @param {import('./message').default} el
     */
    handleMessageVisibility(el) {
        // FIXME: only set for messages inside this chat content
        if (el.model) {
            // Cache actual message height
            this.message_heights.set(
                el.model.get("id"),
                /** @type {HTMLElement} */ (el.firstElementChild).offsetHeight
            );
        }
    }

    /**
     * Calculate the height of the virtual (i.e. not in the DOM)
     * messages above the visible window of chat messages.
     *
     * The message indexes decrease as one moves up (i.e. the topmost
     * message has index zero). So we count down from window_top to
     * determine the height.
     * @param {Number} window_top
     */
    calculateHeightAbove(window_top) {
        let height = 0;
        for (let i = window_top - 1; i >= 0; i--) {
            const message = this.model.messages.at(i);
            height += this.message_heights.get(message.get("id")) || ESTIMATED_MESSAGE_HEIGHT;
        }
        return height;
    }

    /**
     * Calculate the height of the virutal (i.e. not in the DOM)
     * messages below the visible window of chat messages.
     *
     * The bottom-most (virtual) message has an index equal to the total minus one.
     * So we count up to it from from `window_bottom`.
     * @param {Number} window_bottom
     */
    calculateHeightBelow(window_bottom) {
        const total = this.model.messages.length;

        let height = 0;
        for (let i = window_bottom; i < total - 1; i++) {
            const message = this.model.messages.at(i);
            height += this.message_heights.get(message.get("id")) || ESTIMATED_MESSAGE_HEIGHT;
        }
        return height;
    }

    scrollDown() {
        if (this.model.ui.get("scrolled")) {
            return;
        }
        if (this.scrollTo) {
            const behavior = this.scrollTop ? "smooth" : "auto";
            this.scrollTo({ "top": 0, behavior });
        } else {
            this.scrollTop = 0;
        }
        /**
         * Triggered once the converse-chat-content element has been scrolled down to the bottom.
         * @event _converse#chatBoxScrolledDown
         * @type {object}
         * @property { _converse.ChatBox | _converse.ChatRoom } chatbox - The chat model
         * @example _converse.api.listen.on('chatBoxScrolledDown', obj => { ... });
         */
        api.trigger("chatBoxScrolledDown", { chatbox: this.model });
    }
}

api.elements.define("converse-chat-content", ChatContent);
