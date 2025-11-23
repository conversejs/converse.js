import { api, converse, constants, _converse } from  '@converse/headless';
import './message-actions.js';
import './message-body.js';
import 'shared/components/dropdown.js';
import 'shared/modals/message-versions.js';
import 'shared/modals/user-details.js';
import 'shared/registry';
import 'plugins/muc-views/modals/occupant.js';
import tplFileProgress from './templates/file-progress.js';
import tplInfoMessage from './templates/info-message.js';
import tplMepMessage from 'plugins/muc-views/templates/mep-message.js';
import tplMessage from './templates/message.js';
import tplMessageText from './templates/message-text.js';
import tplRetraction from './templates/retraction.js';
import tplSpinner from 'templates/spinner.js';
import { ObservableElement } from 'shared/components/observable.js';
import { __ } from 'i18n';

const { Strophe } = converse.env;
const { SUCCESS } = constants;


export default class Message extends ObservableElement {
    /**
     * @typedef {import('shared/components/types').ObservableProperty} ObservableProperty
     */

    constructor () {
        super();
        this.model_with_messages = null;
        this.model = null;
        this.observable = /** @type {ObservableProperty} */ ("once");
        this.show_reaction_picker = false;
    }

    static get properties () {
        return {
            ...super.properties,
            model_with_messages: { type: Object },
            model: { type: Object },
            show_reaction_picker: { type: Boolean, state: true }
        }
    }

    async initialize () {
        super.initialize();
        await this.model_with_messages.initialized;
        await this.model_with_messages.messages.fetched;

        const settings = api.settings.get();
        this.listenTo(settings, 'change:render_media', () => {
            // Reset individual show/hide state of media
            this.model.save('hide_url_previews', undefined)
            this.requestUpdate();
        });

        this.listenTo(this.model_with_messages, 'change:first_unread_id', () => this.requestUpdate());
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.listenTo(this.model, 'contact:change', () => this.requestUpdate());
        this.listenTo(this.model, 'occupant:add', () => this.requestUpdate());
        this.listenTo(this.model, 'occupant:change', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:add',  () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:change', () => this.requestUpdate());
        this.requestUpdate();
    }

    render () {
        if (!this.model) {
            return '';
        } else if (this.show_spinner) {
            return tplSpinner();
        } else if (this.model.get('file') && this.model.get('upload') !== SUCCESS) {
            return this.renderFileProgress();
        } else if (['mep'].includes(this.model.get('type'))) {
            return this.renderMEPMessage();
        } else if (['error', 'info'].includes(this.model.get('type'))) {
            return this.renderInfoMessage();
        } else {
            return this.renderChatMessage();
        }
    }

    renderRetraction () {
        return tplRetraction(this);
    }

    renderMessageText () {
        return tplMessageText(this);
    }

    renderMEPMessage () {
        return tplMepMessage(this);
    }

    renderInfoMessage () {
        return tplInfoMessage(this);
    }

    renderFileProgress () {
        if (!this.model.file) {
            // Can happen when file upload failed and page was reloaded
            return '';
        }
        return tplFileProgress(this);
    }

    renderChatMessage () {
        return tplMessage(this);
    }

    shouldShowAvatar () {
        return api.settings.get('show_message_avatar') &&
            !this.model.isMeCommand() &&
            ['chat', 'groupchat', 'normal'].includes(this.model.get('type'));
    }

    onImgClick (ev) {
        ev.preventDefault();
        api.modal.show('converse-image-modal', { src: ev.target.src }, ev);
    }

    onUnfurlAnimationEnd () {
        if (this.model.get('url_preview_transition') === 'fade-out') {
            this.model.save({
                'hide_url_previews': true,
                'url_preview_transition': 'fade-in'
            });
        }
    }

    async onRetryClicked () {
        this.show_spinner = true;
        this.requestUpdate();
        await api.trigger(this.model.get('retry_event_id'), {'synchronous': true});
        this.model.destroy();
        this.parentElement.removeChild(this);
    }

    hasMentions () {
        const is_groupchat = this.model.get('type') === 'groupchat';
        return is_groupchat && this.model.get('sender') === 'them' && this.model_with_messages.isUserMentioned(this.model);
    }

    getOccupantAffiliation () {
        return this.model.occupant?.get('affiliation');
    }

    getOccupantRole () {
        return this.model.occupant?.get('role');
    }

    getExtraMessageClasses () {
        const is_action = this.model.isMeCommand() || this.model.isRetracted();
        const extra_classes = [
            this.model.isFollowup() ? 'chat-msg--followup' : null,
            this.model.get('is_delayed') ? 'delayed' : null,
            is_action ? 'chat-msg--action' : null,
            this.model.isRetracted() ? 'chat-msg--retracted' : null,
            this.model.get('type'),
            this.shouldShowAvatar() ? 'chat-msg--with-avatar' : null,
        ].map(c => c);

        if (this.model.get('type') === 'groupchat') {
            extra_classes.push(this.getOccupantRole() ?? '');
            extra_classes.push(this.getOccupantAffiliation() ?? '');
            if (this.model.get('sender') === 'them' && this.hasMentions()) {
                extra_classes.push('mentioned');
            }
        }
        this.model.get('correcting') && extra_classes.push('correcting');
        return extra_classes.filter(c => c).join(" ");
    }

    getRetractionText () {
        if (['groupchat', 'mep'].includes(this.model.get('type')) && this.model.get('moderated_by')) {
            const retracted_by_mod = this.model.get('moderated_by');
            if (!this.model.mod) {
                const { occupants } = this.model_with_messages;
                this.model.mod =
                    occupants.findOccupant({'jid': retracted_by_mod}) ||
                    occupants.findOccupant({'nick': Strophe.getResourceFromJid(retracted_by_mod)});
            }
            const modname = this.model.mod ? this.model.mod.getDisplayName() : __('A moderator');
            return __('%1$s has removed a message', modname);
        } else {
            return this.model.get('sender') === 'me' ?
                __('You have removed a message') :
                __('%1$s has removed a message', this.model.getDisplayName());
        }
    }

    showUserModal (ev) {
        if (this.model.get('sender') === 'me') {
            api.modal.show('converse-profile-modal', { model: _converse.state.xmppstatus }, ev);
        } else if (this.model.get('type') === 'groupchat') {
            ev.preventDefault();
            api.modal.show('converse-muc-occupant-modal', { model: this.model.getOccupant(), message: this.model }, ev);
        } else {
            ev.preventDefault();
            api.modal.show('converse-user-details-modal', { model: this.model_with_messages }, ev);
        }
    }

    showMessageVersionsModal (ev) {
        ev.preventDefault();
        api.modal.show('converse-message-versions-modal', {'model': this.model}, ev);
    }

    toggleSpoilerMessage (ev) {
        ev?.preventDefault();
        this.model.save({'is_spoiler_visible': !this.model.get('is_spoiler_visible')});
    }

    onReactionSelected (ev) {
        const plugin = _converse.pluggable.plugins['converse-reactions'];
        plugin?.onReactionSelected(ev);
    }

    onReactionPickerClose () {
        this.show_reaction_picker = false;
    }

    get allowed_reactions () {
        return this.model.collection?.chatbox?.get('allowed_reactions');
    }
}

api.elements.define('converse-chat-message', Message);
