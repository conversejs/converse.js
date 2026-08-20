/**
 * A button that puts a string on the clipboard, showing a brief checkmark once
 * it has. Meant for the opaque identifiers we show but nobody wants to retype:
 * an OMEMO fingerprint, a JID.
 */
export class CopyButton extends CustomElement {
    static get properties(): {
        text: {
            type: StringConstructor;
        };
        label: {
            type: StringConstructor;
        };
        copied: {
            type: BooleanConstructor;
            state: boolean;
        };
    };
    text: string;
    label: string;
    copied: boolean;
    timeout: number;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    copy(ev: MouseEvent): Promise<void>;
}
import { CustomElement } from './element.js';
//# sourceMappingURL=copy-button.d.ts.map