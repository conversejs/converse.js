export default HeadlinesFeedView;
declare class HeadlinesFeedView extends BaseChatView {
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {Event} ev
     */
    close(ev: Event): Promise<HeadlinesFeedView>;
    getNotifications(): any[];
    afterShown(): void;
}
import BaseChatView from "shared/chat/baseview.js";
//# sourceMappingURL=view.d.ts.map