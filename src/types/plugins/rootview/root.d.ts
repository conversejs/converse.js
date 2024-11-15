/**
 * `converse-root` is an optional custom element which can be used to
 * declaratively insert the Converse UI into the DOM.
 *
 * It can be inserted into the DOM before or after Converse has loaded or been
 * initialized.
 */
export default class ConverseRoot extends CustomElement {
    render(): import("lit").TemplateResult<1>;
    initialize(): void;
    setThemeAttributes(): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=root.d.ts.map