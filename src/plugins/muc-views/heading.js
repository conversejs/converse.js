import './modals/config.js';
import './modals/muc-details.js';
import './modals/nickname.js';
import tplMUCHead from './templates/muc-head.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless";
import { destroyMUC, showModeratorToolsModal } from './utils.js';

import './styles/muc-head.scss';


export default class MUCHeading extends CustomElement {
    /**
     * @typedef {import('@converse/headless/types/plugins/muc/occupant').default} MUCOccupant
     */

    async initialize () {
        const { chatboxes } = _converse.state;
        this.model = chatboxes.get(this.getAttribute('jid'));
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:add', () => this.requestUpdate());
        this.listenTo(this.model, 'vcard:change', () => this.requestUpdate());

        this.user_settings = await _converse.api.user.settings.getModel();
        this.listenTo(this.user_settings, 'change:mucs_with_hidden_subject', () => this.requestUpdate());

        await this.model.initialized;
        const own_occupant = this.model.occupants.findOccupant({ jid: _converse.session.get('bare_jid') });
        if (own_occupant) this.updateIfOwnOccupant(own_occupant);

        this.listenTo(this.model.occupants, "add", this.updateIfOwnOccupant);
        this.listenTo(this.model.occupants, "change:affiliation", this.updateIfOwnOccupant);
        this.listenTo(this.model.occupants, "change:role", this.updateIfOwnOccupant);
        this.listenTo(this.model.session, "change:connection_status", () => this.requestUpdate());
        this.requestUpdate();
    }

    render () {
        return (this.model && this.user_settings) ? tplMUCHead(this) : '';
    }

    /**
     * @param {MUCOccupant} occupant
     */
    updateIfOwnOccupant (occupant) {
        const bare_jid = _converse.session.get('bare_jid');
        if (occupant.get('jid') === bare_jid) {
            this.requestUpdate();
        }
    }

    /**
     * @param {Event} ev
     */
    showRoomDetailsModal (ev) {
        ev.preventDefault();
        api.modal.show('converse-muc-details-modal', { model: this.model }, ev);
    }

    /**
     * @param {Event} ev
     */
    showNicknameModal (ev) {
        ev.preventDefault();
        api.modal.show('converse-muc-nickname-modal', { model: this.model }, ev);
    }

    /**
     * @param {Event} ev
     */
    toggleTopic (ev) {
        ev?.preventDefault?.();
        this.model.toggleSubjectHiddenState();
    }

    /**
     * @param {Event} ev
     */
    toggleOccupants (ev) {
        ev?.preventDefault?.();
        ev?.stopPropagation?.();
        this.model.save({'hidden_occupants': !this.model.get('hidden_occupants')});
    }

    /**
     * @param {Event} ev
     */
    showConfigModal(ev) {
        ev.preventDefault();
        api.modal.show('converse-muc-config-modal', { model: this.model }, ev);
    }

    /**
     * @param {Event} ev
     */
    close (ev) {
        ev.preventDefault();
        this.model.close();
    }

    /**
     * @param {Event} ev
     */
    destroy (ev) {
        ev.preventDefault();
        destroyMUC(this.model);
    }

    /**
     * Returns a list of objects which represent buttons for the groupchat header.
     * @emits _converse#getHeadingButtons
     *
     * @param {boolean} subject_hidden
     */
    getHeadingButtons (subject_hidden) {
        const buttons = [];
        buttons.push({
            'i18n_text': __('Details'),
            'i18n_title': __('Show more information about this groupchat'),
            'handler': /** @param {Event} ev */(ev) => this.showRoomDetailsModal(ev),
            'a_class': 'show-muc-details-modal',
            'icon_class': 'fa-info-circle',
            'name': 'details'
        });

        if (this.model.getOwnAffiliation() === 'owner') {
            buttons.push({
                'i18n_text': __('Configure'),
                'i18n_title': __('Configure this groupchat'),
                'handler': /** @param {Event} ev */(ev) => this.showConfigModal(ev),
                'a_class': 'configure-chatroom-button',
                'icon_class': 'fa-wrench',
                'name': 'configure'
            });
        }

        buttons.push({
            'i18n_text': __('Nickname'),
            'i18n_title': __("Change the nickname you're using in this groupchat"),
            'handler': /** @param {Event} ev */(ev) => this.showNicknameModal(ev),
            'a_class': 'open-nickname-modal',
            'icon_class': 'fa-smile',
            'name': 'nickname'
        });

        const subject = this.model.get('subject');
        if (subject && subject.text) {
            buttons.push({
                'i18n_text': subject_hidden ? __('Show topic') : __('Hide topic'),
                'i18n_title': subject_hidden
                    ? __('Show the topic message in the heading')
                    : __('Hide the topic in the heading'),
                'handler': /** @param {Event} ev */(ev) => this.toggleTopic(ev),
                'a_class': 'hide-topic',
                'icon_class': 'fa-minus-square',
                'name': 'toggle-topic'
            });
        }

        buttons.push({
            'i18n_text': this.model.get('hidden_occupants') ? __('Show participants') : __('Hide participants'),
            'i18n_title': this.model.get('hidden_occupants')
                ? __('Show the groupchat participants')
                : __('Hide the groupchat participants'),
            'handler': /** @param {Event} ev */(ev) => this.toggleOccupants(ev),
            'icon_class': 'fa-users',
        });

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
                    'handler': (ev) => this.destroy(ev),
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
                'handler': async (ev) => {
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

        const { chatboxviews } = _converse.state;
        const el = chatboxviews.get(this.getAttribute('jid'));
        if (el) {
            // This hook is described in src/plugins/chatview/heading.js
            return _converse.api.hook('getHeadingButtons', el, buttons);
        } else {
            return Promise.resolve(buttons); // Happens during tests
        }
    }
}

api.elements.define('converse-muc-heading', MUCHeading);
