export default class EmojiDropdown extends DropdownBase {
    static get properties(): {
        icon_classes: {
            type: StringConstructor;
        };
        items: {
            type: ArrayConstructor;
        };
        model: {
            type: ObjectConstructor;
        };
    };
    render_emojis: boolean;
    state: EmojiPicker;
    model: any;
    initModel(): Promise<void>;
    init_promise: Promise<void>;
    connectedCallback(): void;
    onShown(): Promise<void>;
}
import DropdownBase from "shared/components/dropdown.js";
import { EmojiPicker } from "@converse/headless";
//# sourceMappingURL=emoji-dropdown.d.ts.map