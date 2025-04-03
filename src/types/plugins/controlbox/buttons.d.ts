export default ControlboxButtons;
declare class ControlboxButtons extends CustomElement {
    initialize(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    showUserSettingsModal(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    closeControlBox(ev: MouseEvent): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=buttons.d.ts.map