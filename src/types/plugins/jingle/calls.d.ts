/**
 * Always-present overlay that renders one `<converse-call>` per live call,
 * independent of which chat is open. Mirrors `<converse-toasts>`.
 */
export class Calls extends CustomElement {
    initialize(): Promise<void>;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=calls.d.ts.map