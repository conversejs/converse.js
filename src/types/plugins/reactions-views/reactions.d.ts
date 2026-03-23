export default class Reactions extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    /**
     * @param {string} emoji
     */
    onReactionClick(emoji: string): void;
    render(): import("lit-html").TemplateResult<1> | typeof nothing;
}
import { CustomElement } from 'shared/components/element.js';
import { nothing } from 'lit';
//# sourceMappingURL=reactions.d.ts.map