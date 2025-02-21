export default class DropdownBase extends CustomElement {
    firstUpdated(changed: any): void;
    menu: Element | null | undefined;
    button: HTMLButtonElement | null | undefined;
    dropdown: BootstrapDropdown | undefined;
}
import { CustomElement } from './element.js';
import { Dropdown as BootstrapDropdown } from 'bootstrap';
//# sourceMappingURL=dropdownbase.d.ts.map