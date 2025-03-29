export default class DropdownBase extends CustomElement {
    firstUpdated(changed: any): void;
    menu: Element;
    button: HTMLButtonElement;
    dropdown: BootstrapDropdown;
}
import { CustomElement } from "./element.js";
import { default as BootstrapDropdown } from "bootstrap/js/src/dropdown.js";
//# sourceMappingURL=dropdownbase.d.ts.map