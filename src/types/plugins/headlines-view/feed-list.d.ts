/**
 * Custom element which renders a list of headline feeds
 * @class
 * @namespace _converse.HeadlinesFeedsList
 * @memberOf _converse
 */
export class HeadlinesFeedsList extends CustomElement {
    initialize(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    renderIfHeadline(model: any): void;
    openHeadline(ev: any): Promise<void>;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=feed-list.d.ts.map