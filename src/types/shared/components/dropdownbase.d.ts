export default class DropdownBase extends CustomElement {
    connectedCallback(): void;
    registerEvents(): void;
    clickOutside: (ev: any) => void;
    firstUpdated(changed: any): void;
    menu: Element;
    button: HTMLButtonElement;
    _clickOutside(ev: any): void;
    hideMenu(): void;
    showMenu(): void;
    toggleMenu(ev: any): void;
    handleKeyUp(ev: any): void;
}
import { CustomElement } from "./element.js";
//# sourceMappingURL=dropdownbase.d.ts.map