export default class TodoLists extends CustomElement {
    render(): import("lit-html").TemplateResult<1>;
    model: Model;
    /** @param {Event} [ev] */
    toggleList(ev?: Event): void;
    getProjects(): any[];
}
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/skeletor';
//# sourceMappingURL=lists.d.ts.map