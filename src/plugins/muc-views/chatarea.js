import debounce from 'lodash-es/debounce';
import tpl_muc_chatarea from './templates/muc-chatarea.js';
import { CustomElement } from 'components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';


const { u } = converse.env;


export default class MUCChatArea extends CustomElement {

    static get properties () {
        return {
            jid: { type: String },
            show_help_messages: { type: Boolean },
            type: { type: String },
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.jid);
        this.markScrolled = debounce(this._markScrolled, 100);
        this.listenTo(this.model, 'change:show_help_messages', () => this.requestUpdate());
    }

    render () {
        return tpl_muc_chatarea({
            'help_messages': this.getHelpMessages(),
            'jid': this.jid,
            'model': this.model,
            'occupants': this.model.occupants,
            'show_help_messages': this.model.get('show_help_messages'),
            'show_send_button': _converse.show_send_button,
            'show_sidebar': this.shouldShowSidebar(),
            'type': this.type,
        });
    }

    shouldShowSidebar () {
        return (
            !this.model.get('hidden_occupants') &&
            this.model.session.get('connection_status') === converse.ROOMSTATUS.ENTERED
        );
    }

    getHelpMessages () {
        const setting = api.settings.get('muc_disable_slash_commands');
        const disabled_commands = Array.isArray(setting) ? setting : [];
        return [
            `<strong>/admin</strong>: ${__("Change user's affiliation to admin")}`,
            `<strong>/ban</strong>: ${__('Ban user by changing their affiliation to outcast')}`,
            `<strong>/clear</strong>: ${__('Clear the chat area')}`,
            `<strong>/close</strong>: ${__('Close this groupchat')}`,
            `<strong>/deop</strong>: ${__('Change user role to participant')}`,
            `<strong>/destroy</strong>: ${__('Remove this groupchat')}`,
            `<strong>/help</strong>: ${__('Show this menu')}`,
            `<strong>/kick</strong>: ${__('Kick user from groupchat')}`,
            `<strong>/me</strong>: ${__('Write in 3rd person')}`,
            `<strong>/member</strong>: ${__('Grant membership to a user')}`,
            `<strong>/modtools</strong>: ${__('Opens up the moderator tools GUI')}`,
            `<strong>/mute</strong>: ${__("Remove user's ability to post messages")}`,
            `<strong>/nick</strong>: ${__('Change your nickname')}`,
            `<strong>/op</strong>: ${__('Grant moderator role to user')}`,
            `<strong>/owner</strong>: ${__('Grant ownership of this groupchat')}`,
            `<strong>/register</strong>: ${__('Register your nickname')}`,
            `<strong>/revoke</strong>: ${__("Revoke the user's current affiliation")}`,
            `<strong>/subject</strong>: ${__('Set groupchat subject')}`,
            `<strong>/topic</strong>: ${__('Set groupchat subject (alias for /subject)')}`,
            `<strong>/voice</strong>: ${__('Allow muted user to post messages')}`
        ]
            .filter(line => disabled_commands.every(c => !line.startsWith(c + '<', 9)))
            .filter(line => this.model.getAllowedCommands().some(c => line.startsWith(c + '<', 9)));
    }

    /**
     * Called when the chat content is scrolled up or down.
     * We want to record when the user has scrolled away from
     * the bottom, so that we don't automatically scroll away
     * from what the user is reading when new messages are received.
     *
     * Don't call this method directly, instead, call `markScrolled`,
     * which debounces this method by 100ms.
     * @private
     */
    _markScrolled (ev) {
        let scrolled = true;
        let scrollTop = null;
        const msgs_container = this.querySelector('.chat-content__messages');
        const is_at_bottom =
            msgs_container.scrollTop + msgs_container.clientHeight >= msgs_container.scrollHeight - 62; // sigh...

        if (is_at_bottom) {
            scrolled = false;
            this.onScrolledDown();
        } else if (msgs_container.scrollTop === 0) {
            /**
             * Triggered once the chat's message area has been scrolled to the top
             * @event _converse#chatBoxScrolledUp
             * @property { _converse.ChatBoxView | _converse.ChatRoomView } view
             * @example _converse.api.listen.on('chatBoxScrolledUp', obj => { ... });
             */
            api.trigger('chatBoxScrolledUp', this);
        } else {
            scrollTop = ev.target.scrollTop;
        }
        u.safeSave(this.model, { scrolled, scrollTop });
    }

    onScrolledDown () {
        if (!this.model.isHidden()) {
            this.model.clearUnreadMsgCounter();
            // Clear location hash if set to one of the messages in our history
            const hash = window.location.hash;
            hash && this.model.messages.get(hash.slice(1)) && _converse.router.history.navigate();
        }
        /**
         * Triggered once the chat's message area has been scrolled down to the bottom.
         * @event _converse#chatBoxScrolledDown
         * @type {object}
         * @property { _converse.ChatBox | _converse.ChatRoom } chatbox - The chat model
         * @example _converse.api.listen.on('chatBoxScrolledDown', obj => { ... });
         */
        api.trigger('chatBoxScrolledDown', { 'chatbox': this.model });
    }
}

api.elements.define('converse-muc-chatarea', MUCChatArea);
