export default class AppSwitcher extends CustomElement {
    static get properties(): {
        _activeApp: {
            type: StringConstructor;
        };
    };
    _activeApp: string;
    initialize(): void;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    switchApp(ev: MouseEvent): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=app-switcher.d.ts.map