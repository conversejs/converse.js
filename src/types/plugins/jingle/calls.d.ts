/**
 * Always-present overlay that renders one `<converse-call>` per live call,
 * independent of which chat is open. Mirrors `<converse-toasts>`.
 */
export class Calls extends CustomElement {
    model: any;
    /** Ended calls still on screen. They have already left `_converse.state.calls`. */
    ended: any[];
    dismiss_timers: any[];
    initialize(): Promise<void>;
    /** @param {import('@converse/headless').Call} call */
    onRemoved(call: import("@converse/headless").Call): void;
    render(): import("lit-html").TemplateResult<1>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=calls.d.ts.map