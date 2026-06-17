/**
 * A single call's card: ringing/calling/connecting/active/ended. Reads the
 * `Call` model and delegates every action straight to its methods.
 */
export default class CallView extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    timer: number;
    dismiss_timer: number;
    render(): import("lit-html").TemplateResult<1>;
    /** Run the call timer while active, and clean up the card once it's over. */
    onStateChanged(): void;
    /** @param {Event} [ev] */
    accept(ev?: Event): void;
    /** @param {Event} [ev] */
    reject(ev?: Event): void;
    /** @param {Event} [ev] */
    hangup(ev?: Event): void;
    /** @param {Event} [ev] */
    toggleMute(ev?: Event): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=call.d.ts.map