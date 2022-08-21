import './modals/muc-details.js';
import './modals/muc-invite.js';
import './modals/nickname.js';
import tpl_muc_head from './templates/muc-head.js';
import { CustomElement } from 'shared/components/element.js';
import { Model } from '@converse/skeletor/src/model.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core.js";
import { destroyMUC, showModeratorToolsModal } from './utils.js';

import './styles/muc-head.scss';


export default class MUCHeading extends CustomElement {

    async initialize () {
        this.model = _converse.chatboxes.get(this.getAttribute('jid'));
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:change', () => this.requestUpdate());

        this.user_settings = await _converse.api.user.settings.getModel();
        this.listenTo(this.user_settings, 'change:mucs_with_hidden_subject', () => this.requestUpdate());

        await this.model.initialized;
        this.listenTo(this.model.features, 'change:open', () => this.requestUpdate());
        this.model.occupants.forEach(o => this.onOccupantAdded(o));
        this.listenTo(this.model.occupants, 'add', this.onOccupantAdded);
        this.listenTo(this.model.occupants, 'change:affiliation', this.onOccupantAffiliationChanged);
        this.requestUpdate();
    }

    render () {
        return (this.model && this.user_settings) ? tpl_muc_head(this) : '';
    }

    onOccupantAdded (occupant) {
        if (occupant.get('jid') === _converse.bare_jid) {
            this.requestUpdate();
        }
    }

    onOccupantAffiliationChanged (occupant) {
        if (occupant.get('jid') === _converse.bare_jid) {
            this.requestUpdate();
        }
    }

    showRoomDetailsModal (ev) {
        ev.preventDefault();
        api.modal.show('converse-muc-details-modal', { 'model': this.model }, ev);
    }

    showInviteModal (ev) {
        ev.preventDefault();
        api.modal.show('converse-muc-invite-modal', { 'model': new Model(), 'chatroomview': this }, ev);
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
            'handler': ev => api.modal.show('converse-muc-nickname-modal', { 'model': this.model }, ev),
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

        const el = _converse.chatboxviews.get(this.getAttribute('jid'));
        if (el) {
            // This hook is described in src/plugins/chatview/heading.js
            return _converse.api.hook('getHeadingButtons', el, buttons);
        } else {
            return Promise.resolve(buttons); // Happens during tests
        }
    }
}

api.elements.define('converse-muc-heading', MUCHeading);
