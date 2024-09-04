export default class MUCMessageForm extends MessageForm {
    shouldAutoComplete(): boolean;
    initMentionAutoComplete(): void;
    mention_auto_complete: AutoComplete;
    auto_completing: boolean;
    getAutoCompleteList(): any;
    /**
     * @param {Event} ev
     */
    onKeyDown(ev: Event): void;
    /**
     * @param {KeyboardEvent} ev
     */
    onKeyUp(ev: KeyboardEvent): void;
}
import MessageForm from 'plugins/chatview/message-form.js';
import AutoComplete from 'shared/autocomplete/autocomplete.js';
//# sourceMappingURL=message-form.d.ts.map