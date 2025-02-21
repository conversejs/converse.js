export default class BookmarksView extends CustomElement {
    initialize(): Promise<void>;
    liveFilter: import("lodash").DebouncedFunc<(ev: any) => false | Model>;
    model: Model;
    render(): import("lit").TemplateResult<1>;
    /**
     * @param {Event} ev
     */
    clearFilter(ev: Event): void;
}
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/skeletor';
//# sourceMappingURL=bookmarks-list.d.ts.map