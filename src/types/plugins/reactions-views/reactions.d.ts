export default class Reactions extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        emoji_map: {
            state: boolean;
        };
    };
    /** @type {BaseMessage|null} */
    model: BaseMessage | null;
    emoji_map: {};
    /** @type {Map<string, Promise<string>>} */
    _tooltip_cache: Map<string, Promise<string>>;
    /**
     * @param {string} emoji
     */
    onReactionClick(emoji: string): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
    #private;
}
export type BaseMessage = import("@converse/headless/types/shared/message").default;
export type ChatBoxOrMUC = import("@converse/headless/types/shared/types").ChatBoxOrMUC;
import { CustomElement } from 'shared/components/element.js';
import { nothing } from 'lit';
//# sourceMappingURL=reactions.d.ts.map