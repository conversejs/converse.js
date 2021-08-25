import './message-actions.js';
import './message-body.js';
import 'shared/components/dropdown.js';
import 'shared/registry';
import MessageVersionsModal from 'modals/message-versions.js';
import OccupantModal from 'modals/occupant.js';
import UserDetailsModal from 'modals/user-details.js';
import filesize from 'filesize';
import log from '@converse/headless/log';
import tpl_message from './templates/message.js';
import tpl_message_text from './templates/message-text.js';
import tpl_spinner from 'templates/spinner.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from  '@converse/headless/core';
import { getHats } from './utils.js';
import { html } from 'lit';
import { renderAvatar } from 'shared/directives/avatar';

const { Strophe, dayjs } = converse.env;


export default class Message extends CustomElement {

    static get properties () {
        return {
            jid: { type: String },
            mid: { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.initialize();
    }

    async initialize () {
        await this.setModels();
        if (!this.model) {
            // Happen during tests due to a race condition
            log.error('Could not find module for converse-chat-message');
            return;
        }

        this.listenTo(this.chatbox, 'change:first_unread_id', this.requestUpdate);
        this.listenTo(this.model, 'change', this.requestUpdate);
        this.model.vcard && this.listenTo(this.model.vcard, 'change', this.requestUpdate);

        if (this.model.get('type') === 'groupchat') {
            if (this.model.occupant) {
                this.listenTo(this.model.occupant, 'change', this.requestUpdate);
            } else {
                this.listenTo(this.model, 'occupantAdded', () => {
                    this.listenTo(this.model.occupant, 'change', this.requestUpdate)
                });
            }
        }
    }

    async setModels () {
        this.chatbox = await api.chatboxes.get(this.jid);
        await this.chatbox.initialized;
        await this.chatbox.messages.fetched;
        this.model = this.chatbox.messages.get(this.mid);
        this.model && this.requestUpdate();
    }

    render () {
        if (!this.model) {
            return '';
        } else if (this.show_spinner) {
            return tpl_spinner();
        } else if (this.model.get('file') && this.model.get('upload') !== _converse.SUCCESS) {
            return this.renderFileProgress();
        } else if (['error', 'info'].includes(this.model.get('type'))) {
            return this.renderInfoMessage();
        } else {
            return this.renderChatMessage();
        }
    }

    getProps () {
        return Object.assign(
            this.model.toJSON(),
            this.getDerivedMessageProps()
        );
    }

    renderInfoMessage () {
        const isodate = dayjs(this.model.get('time')).toISOString();
        const i18n_retry = __('Retry');
        return html`
            <div class="message chat-info chat-${this.model.get('type')}"
                data-isodate="${isodate}"
                data-type="${this.data_name}"
                data-value="${this.data_value}">

                <div class="chat-info__message">
                    ${ this.model.getMessageText() }
                </div>
                ${ this.model.get('reason') ? html`<q class="reason">${this.model.get('reason')}</q>` : `` }
                ${ this.model.get('error_text') ? html`<q class="reason">${this.model.get('error_text')}</q>` : `` }
                ${ this.model.get('retry_event_id') ? html`<a class="retry" @click=${this.onRetryClicked}>${i18n_retry}</a>` : '' }
            </div>`;
    }

    renderFileProgress () {
        if (!this.model.file) {
            // Can happen when file upload failed and page was reloaded
            return '';
        }
        const i18n_uploading = __('Uploading file:');
        const filename = this.model.file.name;
        const size = filesize(this.model.file.size);
        return html`
            <div class="message chat-msg">
                ${ renderAvatar(this.getAvatarData()) }
                <div class="chat-msg__content">
                    <span class="chat-msg__text">${i18n_uploading} <strong>${filename}</strong>, ${size}</span>
                    <progress value="${this.model.get('progress')}"/>
                </div>
            </div>`;
    }

    renderChatMessage () {
        return tpl_message(this, this.getProps());
    }

    shouldShowAvatar () {
        return api.settings.get('show_message_avatar') && !this.model.isMeCommand() && this.type !== 'headline';
    }

    getAvatarData () {
        const image_type = this.model.vcard?.get('image_type') || _converse.DEFAULT_IMAGE_TYPE;
        const image_data = this.model.vcard?.get('image') || _converse.DEFAULT_IMAGE;
        const image = "data:" + image_type + ";base64," + image_data;
        return {
            'classes': 'chat-msg__avatar',
            'height': 36,
            'width': 36,
            image,
        };
    }

    onUnfurlAnimationEnd () {
        if (this.model.get('url_preview_transition') === 'fade-out') {
            this.model.save({
                'hide_url_previews': !this.model.get('hide_url_previews'),
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

    isRetracted () {
        return this.model.get('retracted') || this.model.get('moderated') === 'retracted';
    }

    hasMentions () {
        const is_groupchat = this.model.get('type') === 'groupchat';
        return is_groupchat && this.model.get('sender') === 'them' && this.chatbox.isUserMentioned(this.model);
    }

    getOccupantAffiliation () {
        return this.model.occupant?.get('affiliation');
    }

    getOccupantRole () {
        return this.model.occupant?.get('role');
    }

    getExtraMessageClasses () {
        const extra_classes = [
            this.model.isFollowup() ? 'chat-msg--followup' : null,
            this.model.get('is_delayed') ? 'delayed' : null,
            this.model.isMeCommand() ? 'chat-msg--action' : null,
            this.isRetracted() ? 'chat-msg--retracted' : null,
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

    getDerivedMessageProps () {
        const format = api.settings.get('time_format');
        return {
            'pretty_time': dayjs(this.model.get('edited') || this.model.get('time')).format(format),
            'has_mentions': this.hasMentions(),
            'hats': getHats(this.model),
            'is_first_unread': this.chatbox.get('first_unread_id') === this.model.get('id'),
            'is_me_message': this.model.isMeCommand(),
            'is_retracted': this.isRetracted(),
            'username': this.model.getDisplayName(),
            'should_show_avatar': this.shouldShowAvatar(),
        }
    }

    getRetractionText () {
        if (this.model.get('type') === 'groupchat' && this.model.get('moderated_by')) {
            const retracted_by_mod = this.model.get('moderated_by');
            const chatbox = this.model.collection.chatbox;
            if (!this.model.mod) {
                this.model.mod =
                    chatbox.occupants.findOccupant({'jid': retracted_by_mod}) ||
                    chatbox.occupants.findOccupant({'nick': Strophe.getResourceFromJid(retracted_by_mod)});
            }
            const modname = this.model.mod ? this.model.mod.getDisplayName() : 'A moderator';
            return __('%1$s has removed this message', modname);
        } else {
            return __('%1$s has removed this message', this.model.getDisplayName());
        }
    }

    renderRetraction () {
        const retraction_text = this.isRetracted() ? this.getRetractionText() : null;
        return html`
            <div>${retraction_text}</div>
            ${ this.model.get('moderation_reason') ?
                    html`<q class="chat-msg--retracted__reason">${this.model.get('moderation_reason')}</q>` : '' }
        `;
    }

    renderMessageText () {
        return tpl_message_text(this);
    }

    showUserModal (ev) {
        if (this.model.get('sender') === 'me') {
            api.modal.show(_converse.ProfileModal, {model: this.model}, ev);
        } else if (this.model.get('type') === 'groupchat') {
            ev.preventDefault();
            api.modal.show(OccupantModal, { 'model': this.model.occupant }, ev);
        } else {
            ev.preventDefault();
            const chatbox = this.model.collection.chatbox;
            api.modal.show(UserDetailsModal, { model: chatbox }, ev);
        }
    }

    showMessageVersionsModal (ev) {
        ev.preventDefault();
        api.modal.show(MessageVersionsModal, {'model': this.model}, ev);
    }

    toggleSpoilerMessage (ev) {
        ev?.preventDefault();
        this.model.save({'is_spoiler_visible': !this.model.get('is_spoiler_visible')});
    }
}

api.elements.define('converse-chat-message', Message);
