import { LitElement, html, css } from 'lit-element';
import { renderAvatar, renderRetractionLink, transformBodyText } from './../templates/directives';
import { BootstrapModal } from "../converse-modal.js";
import { __ } from '@converse/headless/i18n';
import dayjs from 'dayjs';
import converse from  "@converse/headless/converse-core";
import tpl_message_versions_modal from "../templates/message_versions_modal.js";


const { Strophe } = converse.env;
const u = converse.env.utils;

const i18n_edit_message = __('Edit this message');
const i18n_edited = __('This message has been edited');
const i18n_show = __('Show more');


const MessageVersionsModal = BootstrapModal.extend({
    // FIXME: this isn't globally unique
    id: "message-versions-modal",
    toHTML () {
        return tpl_message_versions_modal(this.model.toJSON());
    }
});


class Message extends LitElement {

    static get properties () {
        return {
            _converse: { type: Object },
            allow_message_retraction: { type: Boolean },
            correcting: { type: Boolean },
            editable: { type: Boolean },
            from: { type: String },
            has_mentions: { type: Boolean },
            is_delayed: { type: Boolean },
            is_encrypted: { type: Boolean },
            is_me_message: { type: Boolean },
            is_only_emojis: { type: Boolean },
            is_retracted: { type: Boolean },
            is_spoiler: { type: Boolean },
            message_type: { type: String },
            model: { type: Object },
            moderated_by: { type: String },
            moderation_reason: { type: String },
            msgid: { type: String },
            occupant_affiliation: { type: String },
            occupant_role: { type: String },
            oob_url: { type: String },
            pretty_type: { type: String },
            received: { type: String },
            roles: { type: Array },
            sender: { type: String },
            spoiler_hint: { type: String },
            subject: { type: String },
            time: { type: String },
            username: { type: String },
        }
    }

    render () {
        const is_groupchat_message = (this.message_type === 'groupchat');
        return html`
            <div class="message chat-msg ${this.message_type} ${this.getExtraMessageClasses()}
                        ${ this.is_me_message ? 'chat-msg--action' : '' }
                        ${this.isFollowup() ? 'chat-msg--followup' : ''}"
                    data-isodate="${this.time}" data-msgid="${this.msgid}" data-from="${this.from}" data-encrypted="${this.is_encrypted}">

                ${ renderAvatar(this) }
                <div class="chat-msg__content chat-msg__content--${this.sender} ${this.is_me_message ? 'chat-msg__content--action' : ''}">
                    <span class="chat-msg__heading">
                        ${ (this.is_me_message) ? html`<time timestamp="${this.isodate}" class="chat-msg__time">${this.pretty_time}</time>` : '' }
                        <span class="chat-msg__author">${ this.is_me_message ? '**' : ''}${this.username}</span>
                        ${ !this.is_me_message ? this.renderAvatarByline() : '' }
                        ${ this.is_encrypted ? html`<span class="fa fa-lock"></span>` : '' }
                    </span>
                    <div class="chat-msg__body chat-msg__body--${this.message_type} ${this.received ? 'chat-msg__body--received' : '' } ${this.is_delayed ? 'chat-msg__body--delayed' : '' }">
                        <div class="chat-msg__message">
                            ${ this.is_retracted ? this.renderRetraction() : this.renderMessageText() }
                        </div>
                        ${ (this.received && !this.is_me_message && !is_groupchat_message) ? html`<span class="fa fa-check chat-msg__receipt"></span>` : '' }
                        ${ (this.edited) ? html`<i title="${ i18n_edited }" class="fa fa-edit chat-msg__edit-modal" @click=${this.showMessageVersionsModal}></i>` : '' }
                        <div class="chat-msg__actions">
                            ${ this.editable ?
                                html`<button class="chat-msg__action chat-msg__action-edit" title="${i18n_edit_message}">
                                    <fa-icon class="fas fa-pencil-alt" path-prefix="/node_modules" color="var(--text-color-lighten-15-percent)" size="1em"></fa-icon>
                                </button>` : '' }
                            ${ renderRetractionLink(this) }
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    openChatRoomFromURIClicked (ev) {
        ev.preventDefault();
        this._converse.api.rooms.open(ev.target.href);
    }

    registerClickHandlers () {
        const els = this.querySelectorAll('a.open-chatroom');
        Array.from(els).forEach(el => el.addEventListener('click', ev => this.openChatRoomFromURIClicked(ev), false));
    }

    createRenderRoot () {
        // Render without the shadow DOM
        return this;
    }

    isFollowup () {
        const messages = this.model.collection.models;
        const idx = messages.indexOf(this.model);
        const prev_model = idx ? messages[idx-1] : null;
        if (prev_model === null) {
            return false;
        }
        const date = dayjs(this.isodate);
        return this.from === prev_model.get('from') &&
            !this.is_me_message &&
            !u.isMeCommand(prev_model.getMessageText()) &&
            this.message_type !== 'info' &&
            prev_model.get('type') !== 'info' &&
            date.isBefore(dayjs(prev_model.get('time')).add(10, 'minutes')) &&
            this.is_encrypted === prev_model.get('is_encrypted');
    }


    getExtraMessageClasses () {
        const extra_classes = [
            ...(this.is_delayed ? ['delayed'] : []),
            ...(this.is_retracted ? ['chat-msg--retracted'] : [])
        ];
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
        const tpl_spoiler_hint = html`
            <div class="chat-msg__spoiler-hint">
                <span class="spoiler-hint">${this.spoiler_hint}</span>
                <a class="badge badge-info spoiler-toggle" data-toggle-state="closed" href="#"><i class="fa fa-eye"></i>${i18n_show}</a>
            </div>
        `;
        return html`
            ${ this.is_spoiler ? tpl_spoiler_hint : '' }
            ${ this.subject ? html`<div class="chat-msg__subject">${this.subject}</div>` : '' }
            <div class="chat-msg__text ${this.is_only_emojis ? 'chat-msg__text--larger' : ''} ${this.is_spoiler ? 'spoiler collapsed' : ''}">${transformBodyText(this)}</div>
            ${ this.oob_url ? html`<div class="chat-msg__media">${u.getOOBURLMarkup(this._converse, this.oob_url)}</div>` : '' }
        `;
    }

    renderAvatarByline () {
        return html`
            ${ this.roles.map(role => html`<span class="badge badge-secondary">${role}</span>`) }
            <time timestamp="${this.isodate}" class="chat-msg__time">${this.pretty_time}</time>
        `;
    }

    showMessageVersionsModal (ev) {
        ev.preventDefault();
        if (this.message_versions_modal === undefined) {
            this.message_versions_modal = new MessageVersionsModal({'model': this.model});
        }
        this.message_versions_modal.show(ev);
    }
}

customElements.define('converse-chat-message', Message);
