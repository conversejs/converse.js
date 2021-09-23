import tpl_muc_chatarea from './templates/muc-chatarea.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { api, converse } from '@converse/headless/core';


const { u } = converse.env;


export default class MUCChatArea extends CustomElement {

    static get properties () {
        return {
            jid: { type: String },
            show_help_messages: { type: Boolean },
            type: { type: String },
        }
    }

    async initialize () {
        this.model = await api.rooms.get(this.jid);
        this.listenTo(this.model, 'change:show_help_messages', () => this.requestUpdate());
        this.listenTo(this.model, 'change:hidden_occupants', () => this.requestUpdate());
        this.listenTo(this.model.session, 'change:connection_status', () => this.requestUpdate());

        // Bind so that we can pass it to addEventListener and removeEventListener
        this.onMouseMove = this._onMouseMove.bind(this);
        this.onMouseUp = this._onMouseUp.bind(this);

        this.requestUpdate(); // Make sure we render again after the model has been attached
    }

    render () {
        return tpl_muc_chatarea({
            'getHelpMessages': () => this.getHelpMessages(),
            'jid': this.jid,
            'model': this.model,
            'onMousedown': ev => this.onMousedown(ev),
            'show_send_button': api.settings.get('show_send_button'),
            'shouldShowSidebar': () => this.shouldShowSidebar(),
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

    onMousedown (ev) {
        if (u.hasClass('dragresize-occupants-left', ev.target)) {
            this.onStartResizeOccupants(ev);
        }
    }

    onStartResizeOccupants (ev) {
        this.resizing = true;
        this.addEventListener('mousemove', this.onMouseMove);
        this.addEventListener('mouseup', this.onMouseUp);

        const sidebar_el = this.querySelector('converse-muc-sidebar');
        const style = window.getComputedStyle(sidebar_el);
        this.width = parseInt(style.width.replace(/px$/, ''), 10);
        this.prev_pageX = ev.pageX;
    }

    _onMouseMove (ev) {
        if (this.resizing) {
            ev.preventDefault();
            const delta = this.prev_pageX - ev.pageX;
            this.resizeSidebarView(delta, ev.pageX);
            this.prev_pageX = ev.pageX;
        }
    }

    _onMouseUp (ev) {
        if (this.resizing) {
            ev.preventDefault();
            this.resizing = false;
            this.removeEventListener('mousemove', this.onMouseMove);
            this.removeEventListener('mouseup', this.onMouseUp);
            const sidebar_el = this.querySelector('converse-muc-sidebar');
            const element_position = sidebar_el.getBoundingClientRect();
            const occupants_width = this.calculateSidebarWidth(element_position, 0);
            u.safeSave(this.model, { occupants_width });
        }
    }

    calculateSidebarWidth (element_position, delta) {
        let occupants_width = element_position.width + delta;
        const room_width = this.clientWidth;
        // keeping display in boundaries
        if (occupants_width < room_width * 0.2) {
            // set pixel to 20% width
            occupants_width = room_width * 0.2;
            this.is_minimum = true;
        } else if (occupants_width > room_width * 0.75) {
            // set pixel to 75% width
            occupants_width = room_width * 0.75;
            this.is_maximum = true;
        } else if (room_width - occupants_width < 250) {
            // resize occupants if chat-area becomes smaller than 250px (min-width property set in css)
            occupants_width = room_width - 250;
            this.is_maximum = true;
        } else {
            this.is_maximum = false;
            this.is_minimum = false;
        }
        return occupants_width;
    }

    resizeSidebarView (delta, current_mouse_position) {
        const sidebar_el = this.querySelector('converse-muc-sidebar');
        const element_position = sidebar_el.getBoundingClientRect();
        if (this.is_minimum) {
            this.is_minimum = element_position.left < current_mouse_position;
        } else if (this.is_maximum) {
            this.is_maximum = element_position.left > current_mouse_position;
        } else {
            const occupants_width = this.calculateSidebarWidth(element_position, delta);
            sidebar_el.style.flex = '0 0 ' + occupants_width + 'px';
        }
    }
}

api.elements.define('converse-muc-chatarea', MUCChatArea);
