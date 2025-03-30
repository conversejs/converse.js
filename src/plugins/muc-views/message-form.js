import { FILTER_CONTAINS, FILTER_STARTSWITH } from "shared/autocomplete/utils.js";
import { MUCOccupant, api, converse, log } from "@converse/headless";
import AutoComplete from "shared/autocomplete/autocomplete.js";
import MessageForm from "plugins/chatview/message-form.js";
import { getAutoCompleteListItem } from "./utils.js";
import tplMUCMessageForm from "./templates/message-form.js";

export default class MUCMessageForm extends MessageForm {
    async initialize() {
        super.initialize();
        await this.model.initialized;
        this.initMentionAutoComplete();
    }

    render() {
        return tplMUCMessageForm(this);
    }

    /**
     * @returns {boolean}
     */
    shouldAutoComplete() {
        const muc = this.model instanceof MUCOccupant ? this.model.collection.chatroom : this.model;
        if (muc) {
            const entered = muc.session.get("connection_status") === converse.ROOMSTATUS.ENTERED;
            return entered && !(muc.features.get("moderated") && muc.getOwnRole() === "visitor");
        }
        log.debug("Could not determine MUC for MUCMessageForm element");
        return false;
    }

    initMentionAutoComplete() {
        this.mention_auto_complete = new AutoComplete(this, {
            auto_first: true,
            min_chars: api.settings.get("muc_mention_autocomplete_min_chars"),
            match_current_word: true,
            list: () => this.getAutoCompleteList(),
            filter:
                api.settings.get("muc_mention_autocomplete_filter") == "contains" ? FILTER_CONTAINS : FILTER_STARTSWITH,
            ac_triggers: ["Tab", "@"],
            include_triggers: [],
            item: (text, input) => getAutoCompleteListItem(this.model, text, input),
        });
        this.mention_auto_complete.on("suggestion-box-selectcomplete", () => (this.auto_completing = false));
    }

    getAutoCompleteList() {
        return this.model.getAllKnownNicknames().map((nick) => ({ label: nick, value: `@${nick}` }));
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onKeyDown(ev) {
        if (this.shouldAutoComplete() && this.mention_auto_complete.onKeyDown(ev)) {
            return;
        }
        super.onKeyDown(ev);
    }

    /**
     * @param {KeyboardEvent} ev
     */
    onKeyUp(ev) {
        if (this.shouldAutoComplete()) this.mention_auto_complete.evaluate(ev);
        super.onKeyUp(ev);
    }
}

api.elements.define("converse-muc-message-form", MUCMessageForm);
