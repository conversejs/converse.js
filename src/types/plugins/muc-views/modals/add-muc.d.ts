export default class AddMUCModal extends BaseModal {
    muc_roomid_policy_error_msg: any;
    renderModal(): import("lit-html").TemplateResult<1>;
    getModalTitle(): any;
    parseRoomDataFromEvent(form: any): {
        jid: string;
        nick: any;
    };
    openChatRoom(ev: any): void;
    checkRoomidPolicy(): boolean;
}
import BaseModal from "plugins/modal/modal.js";
//# sourceMappingURL=add-muc.d.ts.map