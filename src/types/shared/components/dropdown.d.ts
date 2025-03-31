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
    connectedCallback(): void;
    registerEvents(): void;
    onKeyDown: (ev: any) => void;
    onDropdownHide(): void;
    initArrowNavigation(): void;
    navigator: DOMNavigator;
    disableArrowNavigation(): void;
    /**
     * @param {KeyboardEvent} [ev]
     */
    enableArrowNavigation(ev?: KeyboardEvent): void;
    /**
     * @param {KeyboardEvent} ev
     */
    onEnterPressed(ev: KeyboardEvent): void;
    #private;
}
export type DOMNavigatorOptions = any;
import DropdownBase from "shared/components/dropdownbase.js";
import { DOMNavigator } from "shared/dom-navigator";
//# sourceMappingURL=dropdown.d.ts.map