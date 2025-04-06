export default class MUCMessageForm extends MessageForm {
    /**
     * @returns {boolean}
     */
    shouldAutoComplete(): boolean;
    initMentionAutoComplete(): void;
    auto_complete: AutoComplete;
    auto_completing: boolean;
    getAutoCompleteList(): any;
    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev: KeyboardEvent): void;
}
import MessageForm from "plugins/chatview/message-form.js";
import AutoComplete from "shared/autocomplete/autocomplete.js";
//# sourceMappingURL=message-form.d.ts.map