export default class BookmarksView {
    initialize(): Promise<void>;
    liveFilter: any;
    model: Model;
    render(): any;
    clearFilter(ev: any): void;
}
import { Model } from "@converse/skeletor/src/model.js";
