export default Profile;
declare class Profile extends CustomElement {
    initialize(): void;
    model: any;
    render(): import("lit-html").TemplateResult<1>;
    /**
     * @param {MouseEvent} ev
     * @param {'status'|'profile'} tab
     */
    showProfileModal(ev: MouseEvent, tab?: "status" | "profile"): void;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=statusview.d.ts.map