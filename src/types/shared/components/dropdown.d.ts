export default class Dropdown extends DropdownBase {
    static get properties(): {
        icon_classes: {
            type: StringConstructor;
        };
        items: {
            type: ArrayConstructor;
        };
    };
    icon_classes: string;
    items: any[];
    render(): import("lit").TemplateResult<1>;
    firstUpdated(): void;
    onHidden(): void;
    initArrowNavigation(): void;
    navigator: DOMNavigator;
    enableArrowNavigation(ev: any): void;
    /**
     * @param {KeyboardEvent} ev
     */
    handleKeyUp(ev: KeyboardEvent): void;
}
export type DOMNavigatorOptions = any;
import DropdownBase from 'shared/components/dropdownbase.js';
import DOMNavigator from "shared/dom-navigator.js";
//# sourceMappingURL=dropdown.d.ts.map