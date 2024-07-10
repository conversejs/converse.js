export default class BookmarksView extends CustomElement {
    initialize(): Promise<void>;
    liveFilter: any;
    model: Model;
    render(): import("lit").TemplateResult<1>;
    clearFilter(ev: any): void;
}
import { CustomElement } from "shared/components/element.js";
import { Model } from "@converse/skeletor";
//# sourceMappingURL=bookmarks-list.d.ts.map