export default Profile;
declare class Profile extends CustomElement {
    initialize(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     */
    showProfileModal(ev: MouseEvent): void;
    /**
     * @param {MouseEvent} ev
     */
    showStatusChangeModal(ev: MouseEvent): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=statusview.d.ts.map