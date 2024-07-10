export default Profile;
declare class Profile extends CustomElement {
    initialize(): void;
    model: any;
    render(): import("lit").TemplateResult<1>;
    showProfileModal(ev: any): void;
    showStatusChangeModal(ev: any): void;
    showUserSettingsModal(ev: any): void;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=statusview.d.ts.map