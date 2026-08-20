/**
 * Shown inside a MUC the user has entered which has no messages yet.
 * Rendered by {@link MUCChatContent}.
 */
export default class MUCEmpty extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    render(): import("lit-html").TemplateResult<1>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=empty.d.ts.map