/**
 * Custom element which renders a list of headline feeds
 * @class
 * @namespace _converse.HeadlinesFeedsList
 * @memberOf _converse
 */
export class HeadlinesFeedsList {
    initialize(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    renderIfHeadline(model: any): any;
    openHeadline(ev: any): Promise<void>;
}
