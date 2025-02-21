export default class MinimizedChats extends CustomElement {
    initialize(): Promise<void>;
    model: any;
    render(): import("lit").TemplateResult<1>;
    initToggle(): Promise<void>;
    minchats: MinimizedChatsToggle;
    /**
     * @param {Event} [ev]
     */
    toggle(ev?: Event): void;
}
import { CustomElement } from 'shared/components/element';
import MinimizedChatsToggle from './toggle.js';
//# sourceMappingURL=view.d.ts.map