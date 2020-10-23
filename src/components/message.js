import './message-body.js';
import '../converse-registry';
import './dropdown.js';
import './message-actions.js';
import { getDerivedMessageProps } from './message-history';
import MessageVersionsModal from '../modals/message-versions.js';
import dayjs from 'dayjs';
import filesize from 'filesize';
import tpl_chat_message from '../templates/chat_message.js';
import tpl_spinner from '../templates/spinner.js';
import { CustomElement } from './element.js';
import { __ } from '../i18n';
import { _converse, api, converse } from  '@converse/headless/converse-core';
import { html } from 'lit-element';
import { renderAvatar } from './../templates/directives/avatar';

const { Strophe } = converse.env;
const u = converse.env.utils;


export default class Message extends CustomElement {

    static get properties () {
        return {
            chatview: { type: Object},
            correcting: { type: Boolean },
            editable: { type: Boolean },
            edited: { type: String },
            error: { type: String },
            error_text: { type: String },
            from: { type: String },
            has_mentions: { type: Boolean },
            hats: { type: Array },
            is_delayed: { type: Boolean },
            is_encrypted: { type: Boolean },
            is_first_unread: { type: Boolean },
            is_me_message: { type: Boolean },
            is_only_emojis: { type: Boolean },
            is_retracted: { type: Boolean },
            is_spoiler: { type: Boolean },
            is_spoiler_visible: { type: Boolean },
            message_type: { type: String },
            model: { type: Object },
            moderated_by: { type: String },
            moderation_reason: { type: String },
            msgid: { type: String },
            occupant_affiliation: { type: String },
            occupant_role: { type: String },
            oob_url: { type: String },
            progress: { type: Number },
            reason: { type: String },
            received: { type: String },
            retractable: { type: Boolean },
            retry_event_id: { type: String },
            sender: { type: String },
            show_spinner: { type: Boolean },
            spoiler_hint: { type: String },
            subject: { type: String },
            time: { type: String },
            username: { type: String }
        }
    }

    render () {
        const format = api.settings.get('time_format');
        this.pretty_time = dayjs(this.edited || this.time).format(format);
        if (this.show_spinner) {
            return tpl_spinner();
        } else if (this.model.get('file') && !this.model.get('oob_url')) {
            return this.renderFileProgress();
        } else if (['error', 'info'].includes(this.message_type)) {
            return this.renderInfoMessage();
        } else {
            return this.renderChatMessage();
        }
    }

    connectedCallback () {
        super.connectedCallback();
        // Listen to changes and update properties (which will trigger a
        // re-render if necessary).
        this.listenTo(this.model, 'change', (model) => {
            const chatbox = this.model.collection.chatbox;
            Object.assign(this, getDerivedMessageProps(chatbox, this.model));
            Object.keys(model.changed)
                .filter(p => Object.keys(Message.properties).includes(p))
                .forEach(p => (this[p] = model.changed[p]));
        });
        const vcard = this.model.vcard;
        vcard && this.listenTo(vcard, 'change', () => this.requestUpdate());
    }

    updated () {
        // XXX: This is ugly but tests rely on this event.
        // For "normal" chat messages the event is fired in
        // src/templates/directives/body.js
        if (
            this.show_spinner ||
            (this.model.get('file') && !this.model.get('oob_url')) ||
            (['error', 'info'].includes(this.message_type))
        ) {
            this.model.collection?.trigger('rendered', this.model);
        }
    }

    renderInfoMessage () {
        const isodate = dayjs(this.model.get('time')).toISOString();
        const i18n_retry = __('Retry');
        return html`
            <div class="message chat-info chat-${this.message_type}"
                data-isodate="${isodate}"
                data-type="${this.data_name}"
                data-value="${this.data_value}">

                <div class="chat-info__message">
                    ${ this.model.getMessageText() }
                </div>
                ${ this.reason ? html`<q class="reason">${this.reason}</q>` : `` }
                ${ this.error_text ? html`<q class="reason">${this.error_text}</q>` : `` }
                ${ this.retry_event_id ? html`<a class="retry" @click=${this.onRetryClicked}>${i18n_retry}</a>` : '' }
            </div>
        `;
    }

    renderFileProgress () {
        const i18n_uploading = __('Uploading file:');
        const filename = this.model.file.name;
        const size = filesize(this.model.file.size);
        return html`
            <div class="message chat-msg">
                ${ renderAvatar(this.getAvatarData()) }
                <div class="chat-msg__content">
                    <span class="chat-msg__text">${i18n_uploading} <strong>${filename}</strong>, ${size}</span>
                    <progress value="${this.progress}"/>
                </div>
            </div>`;
    }

    renderChatMessage () {
        return tpl_chat_message(this);
    }

    shouldShowAvatar () {
        return api.settings.get('show_message_avatar') && !this.is_me_message && this.type !== 'headline';
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

    async onRetryClicked () {
        this.show_spinner = true;
        await api.trigger(this.retry_event_id, {'synchronous': true});
        this.model.destroy();
        this.parentElement.removeChild(this);
    }

    isFollowup () {
        const messages = this.model.collection.models;
        const idx = messages.indexOf(this.model);
        const prev_model = idx ? messages[idx-1] : null;
        if (prev_model === null) {
            return false;
        }
        const date = dayjs(this.time);
        return this.from === prev_model.get('from') &&
            !this.is_me_message &&
            !prev_model.isMeCommand() &&
            this.message_type !== 'info' &&
            prev_model.get('type') !== 'info' &&
            date.isBefore(dayjs(prev_model.get('time')).add(10, 'minutes')) &&
            !!this.is_encrypted === !!prev_model.get('is_encrypted');
    }

    getExtraMessageClasses () {
        const extra_classes = [
            this.isFollowup() ? 'chat-msg--followup' : null,
            this.is_delayed ? 'delayed' : null,
            this.is_me_message ? 'chat-msg--action' : null,
            this.is_retracted ? 'chat-msg--retracted' : null,
            this.message_type,
            this.shouldShowAvatar() ? 'chat-msg--with-avatar' : null,
        ].map(c => c);

        if (this.message_type === 'groupchat') {
            this.occupant_role && extra_classes.push(this.occupant_role);
            this.occupant_affiliation && extra_classes.push(this.occupant_affiliation);
            if (this.sender === 'them' && this.has_mentions) {
                extra_classes.push('mentioned');
            }
        }
        this.correcting && extra_classes.push('correcting');
        return extra_classes.filter(c => c).join(" ");
    }

    getRetractionText () {
        if (this.message_type === 'groupchat' && this.moderated_by) {
            const retracted_by_mod = this.moderated_by;
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
        const retraction_text = this.is_retracted ? this.getRetractionText() : null;
        return html`
            <div>${retraction_text}</div>
            ${ this.moderation_reason ? html`<q class="chat-msg--retracted__reason">${this.moderation_reason}</q>` : '' }
        `;
    }

    renderMessageText () {
        const i18n_edited = __('This message has been edited');
        const i18n_show = __('Show more');
        const is_groupchat_message = (this.message_type === 'groupchat');
        const i18n_show_less = __('Show less');

        const tpl_spoiler_hint = html`
            <div class="chat-msg__spoiler-hint">
                <span class="spoiler-hint">${this.spoiler_hint}</span>
                <a class="badge badge-info spoiler-toggle" href="#" @click=${this.toggleSpoilerMessage}>
                    <i class="fa ${this.is_spoiler_visible ? 'fa-eye-slash' : 'fa-eye'}"></i>
                    ${ this.is_spoiler_visible ? i18n_show_less : i18n_show }
                </a>
            </div>
        `;
        const spoiler_classes = this.is_spoiler ? `spoiler ${this.is_spoiler_visible ? '' : 'hidden'}` : '';
        return html`
            ${ this.is_spoiler ? tpl_spoiler_hint : '' }
            ${ this.subject ? html`<div class="chat-msg__subject">${this.subject}</div>` : '' }
            <span>
                <converse-chat-message-body
                    class="chat-msg__text ${this.is_only_emojis ? 'chat-msg__text--larger' : ''} ${spoiler_classes}"
                    .model="${this.model}"
                    ?is_me_message="${this.is_me_message}"
                    ?is_only_emojis="${this.is_only_emojis}"
                    ?is_spoiler="${this.is_spoiler}"
                    ?is_spoiler_visible="${this.is_spoiler_visible}"
                    text="${this.model.getMessageText()}"></converse-chat-message-body>
                ${ (this.received && !this.is_me_message && !is_groupchat_message) ? html`<span class="fa fa-check chat-msg__receipt"></span>` : '' }
                ${ (this.edited) ? html`<i title="${ i18n_edited }" class="fa fa-edit chat-msg__edit-modal" @click=${this.showMessageVersionsModal}></i>` : '' }
            </span>
            ${ this.oob_url ? html`<div class="chat-msg__media">${u.getOOBURLMarkup(_converse, this.oob_url)}</div>` : '' }
            <div class="chat-msg__error">${ this.error_text || this.error }</div>
        `;
    }

    renderAvatarByline () {
        return html`
            ${ this.hats.map(h => html`<span class="badge badge-secondary">${h.title}</span>`) }
            <time timestamp="${this.edited || this.time}" class="chat-msg__time">${this.pretty_time}</time>
        `;
    }

    showMessageVersionsModal (ev) {
        ev.preventDefault();
        if (this.message_versions_modal === undefined) {
            this.message_versions_modal = new MessageVersionsModal({'model': this.model});
        }
        this.message_versions_modal.show(ev);
    }

    toggleSpoilerMessage (ev) {
        ev?.preventDefault();
        this.model.save({'is_spoiler_visible': !this.model.get('is_spoiler_visible')});
    }
}

api.elements.define('converse-chat-message', Message);
