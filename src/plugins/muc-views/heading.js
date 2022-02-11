import { ElementView } from '@converse/skeletor/src/element.js';
import MUCInviteModal from './modals/muc-invite.js';
import NicknameModal from './modals/nickname.js';
import RoomDetailsModal from './modals/muc-details.js';
import debounce from 'lodash-es/debounce';
import tpl_muc_head from './templates/muc-head.js';
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";
import { destroyMUC, showModeratorToolsModal } from './utils.js';
import {
    getHeadingDropdownItem,
    getHeadingStandaloneButton,
} from 'plugins/chatview/utils.js';
import { render } from 'lit';

import './styles/muc-head.scss';


export default class MUCHeading extends ElementView {

    async connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.getAttribute('jid'));
        this.debouncedRender = debounce(this.render, 100);
        this.listenTo(this.model, 'change', this.debouncedRender);

        const user_settings = await _converse.api.user.settings.getModel();
        this.listenTo(user_settings, 'change:mucs_with_hidden_subject', this.debouncedRender);

        await this.model.initialized;
        this.listenTo(this.model.features, 'change:open', this.debouncedRender);
        this.model.occupants.forEach(o => this.onOccupantAdded(o));
        this.listenTo(this.model.occupants, 'add', this.onOccupantAdded);
        this.listenTo(this.model.occupants, 'change:affiliation', this.onOccupantAffiliationChanged);
        this.render();
    }

    async render () {
        const tpl = await this.generateHeadingTemplate();
        render(tpl, this);
    }

    onOccupantAdded (occupant) {
        if (occupant.get('jid') === _converse.bare_jid) {
            this.debouncedRender();
        }
    }

    onOccupantAffiliationChanged (occupant) {
        if (occupant.get('jid') === _converse.bare_jid) {
            this.debouncedRender();
        }
    }

    showRoomDetailsModal (ev) {
        ev.preventDefault();
        api.modal.show(RoomDetailsModal, { 'model': this.model }, ev);
    }

    showInviteModal (ev) {
        ev.preventDefault();
        api.modal.show(MUCInviteModal, { 'model': new Model(), 'chatroomview': this }, ev);
    }

    toggleTopic (ev) {
        ev?.preventDefault?.();
        this.model.toggleSubjectHiddenState();
    }

    getAndRenderConfigurationForm () {
        this.model.session.set('view', converse.MUC.VIEWS.CONFIG);
    }

    close (ev) {
        ev.preventDefault();
        this.model.close();
    }

    destroy (ev) {
        ev.preventDefault();
        destroyMUC(this.model);
    }

    /**
     * Returns a list of objects which represent buttons for the groupchat header.
     * @emits _converse#getHeadingButtons
     */
    getHeadingButtons (subject_hidden) {
        const buttons = [];
        buttons.push({
            'i18n_text': __('Details'),
            'i18n_title': __('Show more information about this groupchat'),
            'handler': ev => this.showRoomDetailsModal(ev),
            'a_class': 'show-muc-details-modal',
            'icon_class': 'fa-info-circle',
            'name': 'details'
        });

        if (this.model.getOwnAffiliation() === 'owner') {
            buttons.push({
                'i18n_text': __('Configure'),
                'i18n_title': __('Configure this groupchat'),
                'handler': () => this.getAndRenderConfigurationForm(),
                'a_class': 'configure-chatroom-button',
                'icon_class': 'fa-wrench',
                'name': 'configure'
            });
        }

        buttons.push({
            'i18n_text': __('Nickname'),
            'i18n_title': __("Change the nickname you're using in this groupchat"),
            'handler': ev => api.modal.show(NicknameModal, { 'model': this.model }, ev),
            'a_class': 'open-nickname-modal',
            'icon_class': 'fa-smile',
            'name': 'nickname'
        });

        if (this.model.invitesAllowed()) {
            buttons.push({
                'i18n_text': __('Invite'),
                'i18n_title': __('Invite someone to join this groupchat'),
                'handler': ev => this.showInviteModal(ev),
                'a_class': 'open-invite-modal',
                'icon_class': 'fa-user-plus',
                'name': 'invite'
            });
        }

        const subject = this.model.get('subject');
        if (subject && subject.text) {
            buttons.push({
                'i18n_text': subject_hidden ? __('Show topic') : __('Hide topic'),
                'i18n_title': subject_hidden
                    ? __('Show the topic message in the heading')
                    : __('Hide the topic in the heading'),
                'handler': ev => this.toggleTopic(ev),
                'a_class': 'hide-topic',
                'icon_class': 'fa-minus-square',
                'name': 'toggle-topic'
            });
        }

        const conn_status = this.model.session.get('connection_status');
        if (conn_status === converse.ROOMSTATUS.ENTERED) {
            const allowed_commands = this.model.getAllowedCommands();
            if (allowed_commands.includes('modtools')) {
                buttons.push({
                    'i18n_text': __('Moderate'),
                    'i18n_title': __('Moderate this groupchat'),
                    'handler': () => showModeratorToolsModal(this.model),
                    'a_class': 'moderate-chatroom-button',
                    'icon_class': 'fa-user-cog',
                    'name': 'moderate'
                });
            }
            if (allowed_commands.includes('destroy')) {
                buttons.push({
                    'i18n_text': __('Destroy'),
                    'i18n_title': __('Remove this groupchat'),
                    'handler': ev => this.destroy(ev),
                    'a_class': 'destroy-chatroom-button',
                    'icon_class': 'fa-trash',
                    'name': 'destroy'
                });
            }
        }

        if (!api.settings.get('singleton')) {
            buttons.push({
                'i18n_text': __('Leave'),
                'i18n_title': __('Leave and close this groupchat'),
                'handler': async ev => {
                    ev.stopPropagation();
                    const messages = [__('Are you sure you want to leave this groupchat?')];
                    const result = await api.confirm(__('Confirm'), messages);
                    result && this.close(ev);
                },
                'a_class': 'close-chatbox-button',
                'standalone': api.settings.get('view_mode') === 'overlayed',
                'icon_class': 'fa-sign-out-alt',
                'name': 'signout'
            });
        }

        const chatview = _converse.chatboxviews.get(this.getAttribute('jid'));
        if (chatview) {
            return _converse.api.hook('getHeadingButtons', chatview, buttons);
        } else {
            return buttons; // Happens during tests
        }
    }

    /**
     * Returns the groupchat heading TemplateResult to be rendered.
     */
    async generateHeadingTemplate () {
        const subject_hidden = await this.model.isSubjectHidden();
        const heading_btns = await this.getHeadingButtons(subject_hidden);
        const standalone_btns = heading_btns.filter(b => b.standalone);
        const dropdown_btns = heading_btns.filter(b => !b.standalone);
        return tpl_muc_head(
            Object.assign(this.model.toJSON(), {
                _converse,
                subject_hidden,
                'dropdown_btns': dropdown_btns.map(b => getHeadingDropdownItem(b)),
                'standalone_btns': standalone_btns.map(b => getHeadingStandaloneButton(b)),
                'title': this.model.getDisplayName()
            })
        );
    }
}

api.elements.define('converse-muc-heading', MUCHeading);
