export default class EmojiDropdown extends DropdownBase {
    static get properties(): {
        chatview: {
            type: ObjectConstructor;
        };
        icon_classes: {
            type: StringConstructor;
        };
        items: {
            type: ArrayConstructor;
        };
    };
    render_emojis: boolean;
    chatview: any;
    initModel(): Promise<void>;
    init_promise: Promise<void>;
    model: any;
    showMenu(): Promise<void>;
}
import DropdownBase from "shared/components/dropdown.js";
//# sourceMappingURL=emoji-dropdown.d.ts.map