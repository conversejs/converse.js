import { api, converse, u } from '@converse/headless';
import { __ } from 'i18n';
import { CustomElement } from 'shared/components/element.js';
import tplMUCChatarea from './templates/muc-chatarea.js';


export default class MUCChatArea extends CustomElement {

    static get properties () {
        return {
            jid: { type: String },
            show_help_messages: { type: Boolean },
            type: { type: String },
        }
    }

    constructor () {
        super();
        this.jid = null;
        this.type = null;
        this.split = null;
    }

    async initialize () {
        this.model = await api.rooms.get(this.jid);
        this.listenTo(this.model, 'change:show_help_messages', () => this.requestUpdate());
        this.listenTo(this.model, 'change:hidden_occupants', () => this.requestUpdate());
        this.listenTo(this.model.session, 'change:connection_status', () => this.requestUpdate());

        this.#hideSidebarIfSmallViewport();
        this.hideSidebarIfSmallViewport = u.debounce(this.#hideSidebarIfSmallViewport.bind(this), 100);
        this.requestUpdate();
    }

    render () {
        return this.model ? tplMUCChatarea(this) : '';
    }

    #hideSidebarIfSmallViewport () {
        if (this.model?.get('hidden_occupants')) return;
        const is_small = window.matchMedia("(max-width: 576px)").matches;
        if (is_small) this.model?.save('hidden_occupants', true);
    }

    connectedCallback () {
        super.connectedCallback();
        window.addEventListener('resize', this.hideSidebarIfSmallViewport, true);
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        window.addEventListener('resize', this.hideSidebarIfSmallViewport, true);
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
}

api.elements.define('converse-muc-chatarea', MUCChatArea);
