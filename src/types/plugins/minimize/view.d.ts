export default class MinimizedChats extends CustomElement {
    initialize(): Promise<void>;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    initToggle(): Promise<void>;
    minchats: MinimizedChatsToggle;
    toggle(ev: any): void;
}
import { CustomElement } from "shared/components/element";
import MinimizedChatsToggle from "./toggle.js";
//# sourceMappingURL=view.d.ts.map