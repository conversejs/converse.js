export default class MUCMessageForm extends MessageForm {
    /** The room being composed in, which for an occupant form is its parent room. */
    getMUC(): any;
    /**
     * Whether mentions apply right now: only once the room has been entered, and never as a
     * visitor in a moderated room, who cannot post anyway.
     * @returns {boolean}
     */
    shouldAutoComplete(): boolean;
}
import MessageForm from 'plugins/chatview/message-form.js';
//# sourceMappingURL=message-form.d.ts.map