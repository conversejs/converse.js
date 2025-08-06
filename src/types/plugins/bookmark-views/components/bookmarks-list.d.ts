export default class BookmarksView extends CustomElement {
    initialize(): Promise<void>;
    liveFilter: import("lodash").DebouncedFunc<(ev: any) => false | Model>;
    model: Model;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {Event} ev
     */
    clearFilter(ev: Event): void;
}
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/headless';
//# sourceMappingURL=bookmarks-list.d.ts.map