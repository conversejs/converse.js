export default class DropdownBase extends CustomElement {
    /**
     * @param {import('lit').PropertyValues} [changed]
     */
    firstUpdated(changed?: import("lit").PropertyValues): void;
    menu: Element;
    button: HTMLButtonElement;
    dropdown: BootstrapDropdown;
}
import { CustomElement } from "./element.js";
import { default as BootstrapDropdown } from "bootstrap/js/src/dropdown.js";
//# sourceMappingURL=dropdownbase.d.ts.map