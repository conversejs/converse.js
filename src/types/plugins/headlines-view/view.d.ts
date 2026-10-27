export default HeadlinesFeedView;
declare const HeadlinesFeedView_base: typeof BaseChatView & import("../dragresize/types.js").DragResizableConstructor;
declare class HeadlinesFeedView extends HeadlinesFeedView_base {
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {Event} ev
     */
    close(ev: Event): Promise<this>;
    getNotifications(): any[];
    afterShown(): void;
}
import BaseChatView from 'shared/chat/baseview.js';
//# sourceMappingURL=view.d.ts.map