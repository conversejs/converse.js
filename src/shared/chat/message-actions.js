import log from '@converse/headless/log';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core.js';
import { getMediaURLs } from '@converse/headless/shared/chat/utils.js';
import { html } from 'lit';
import { isMediaURLDomainAllowed } from '@converse/headless/utils/url.js';
import { until } from 'lit/directives/until.js';

const { Strophe, u } = converse.env;

class MessageActions extends CustomElement {
    static get properties () {
        return {
            correcting: { type: Boolean },
            editable: { type: Boolean },
            hide_url_previews: { type: Boolean },
            is_retracted: { type: Boolean },
            message_type: { type: String },
            model: { type: Object },
            unfurls: { type: Number },
        };
    }

    render () {
        return html`${until(this.renderActions(), '')}`;
    }

    async renderActions () {
        // We want to let the message actions menu drop upwards if we're at the
        // bottom of the message history, and down otherwise. This is to avoid
        // the menu disappearing behind the bottom panel (toolbar, textarea etc).
        // That's difficult to know from state, so we're making an approximation here.
        const should_drop_up = this.model.collection.length > 2 && this.model === this.model.collection.last();

        const buttons = await this.getActionButtons();
        const items = buttons.map(b => MessageActions.getActionsDropdownItem(b));
        if (items.length) {
            return html`<converse-dropdown
                class="chat-msg__actions ${should_drop_up ? 'dropup dropup--left' : 'dropleft'}"
                .items=${items}
            ></converse-dropdown>`;
        } else {
            return '';
        }
    }

    static getActionsDropdownItem (o) {
        return html`
            <button class="chat-msg__action ${o.button_class}" @click=${o.handler}>
                <converse-icon
                    class="${o.icon_class}"
                    path-prefix="${api.settings.get('assets_path')}"
                    color="var(--text-color-lighten-15-percent)"
                    size="1em"
                ></converse-icon>
                ${o.i18n_text}
            </button>
        `;
    }

    onMessageEditButtonClicked (ev) {
        ev.preventDefault();
        const currently_correcting = this.model.collection.findWhere('correcting');
        // TODO: Use state intead of DOM querying
        // Then this code can also be put on the model
        const unsent_text = u.ancestor(this, '.chatbox')?.querySelector('.chat-textarea')?.value;
        if (unsent_text && (!currently_correcting || currently_correcting.get('message') !== unsent_text)) {
            if (!confirm(__('You have an unsent message which will be lost if you continue. Are you sure?'))) {
                return;
            }
        }
        if (currently_correcting !== this.model) {
            currently_correcting?.save('correcting', false);
            this.model.save('correcting', true);
        } else {
            this.model.save('correcting', false);
        }
    }

    async onDirectMessageRetractButtonClicked () {
        if (this.model.get('sender') !== 'me') {
            return log.error("onMessageRetractButtonClicked called for someone else's message!");
        }
        const retraction_warning = __(
            'Be aware that other XMPP/Jabber clients (and servers) may ' +
                'not yet support retractions and that this message may not ' +
                'be removed everywhere.'
        );
        const messages = [__('Are you sure you want to retract this message?')];
        if (api.settings.get('show_retraction_warning')) {
            messages[1] = retraction_warning;
        }
        const result = await api.confirm(__('Confirm'), messages);
        if (result) {
            const chatbox = this.model.collection.chatbox;
            chatbox.retractOwnMessage(this.model);
        }
    }

    /**
     * Retract someone else's message in this groupchat.
     * @private
     * @param { _converse.Message } message - The message which we're retracting.
     * @param { string } [reason] - The reason for retracting the message.
     */
    async retractOtherMessage (reason) {
        const chatbox = this.model.collection.chatbox;
        const result = await chatbox.retractOtherMessage(this.model, reason);
        if (result === null) {
            const err_msg = __(`A timeout occurred while trying to retract the message`);
            api.alert('error', __('Error'), err_msg);
            log(err_msg, Strophe.LogLevel.WARN);
        } else if (u.isErrorStanza(result)) {
            const err_msg = __(`Sorry, you're not allowed to retract this message.`);
            api.alert('error', __('Error'), err_msg);
            log(err_msg, Strophe.LogLevel.WARN);
            log(result, Strophe.LogLevel.WARN);
        }
    }

    async onMUCMessageRetractButtonClicked () {
        const retraction_warning = __(
            'Be aware that other XMPP/Jabber clients (and servers) may ' +
                'not yet support retractions and that this message may not ' +
                'be removed everywhere.'
        );

        if (this.model.mayBeRetracted()) {
            const messages = [__('Are you sure you want to retract this message?')];
            if (api.settings.get('show_retraction_warning')) {
                messages[1] = retraction_warning;
            }
            if (await api.confirm(__('Confirm'), messages)) {
                const chatbox = this.model.collection.chatbox;
                chatbox.retractOwnMessage(this.model);
            }
        } else if (await this.model.mayBeModerated()) {
            if (this.model.get('sender') === 'me') {
                let messages = [__('Are you sure you want to retract this message?')];
                if (api.settings.get('show_retraction_warning')) {
                    messages = [messages[0], retraction_warning, messages[1]];
                }
                !!(await api.confirm(__('Confirm'), messages)) && this.retractOtherMessage();
            } else {
                let messages = [
                    __('You are about to retract this message.'),
                    __('You may optionally include a message, explaining the reason for the retraction.'),
                ];
                if (api.settings.get('show_retraction_warning')) {
                    messages = [messages[0], retraction_warning, messages[1]];
                }
                const reason = await api.prompt(__('Message Retraction'), messages, __('Optional reason'));
                reason !== false && this.retractOtherMessage(reason);
            }
        } else {
            const err_msg = __(`Sorry, you're not allowed to retract this message`);
            api.alert('error', __('Error'), err_msg);
        }
    }

    onMessageRetractButtonClicked (ev) {
        ev?.preventDefault?.();
        const chatbox = this.model.collection.chatbox;
        if (chatbox.get('type') === _converse.CHATROOMS_TYPE) {
            this.onMUCMessageRetractButtonClicked();
        } else {
            this.onDirectMessageRetractButtonClicked();
        }
    }

    onHidePreviewsButtonClicked (ev) {
        ev?.preventDefault?.();
        if (this.hide_url_previews) {
            this.model.save({
                'hide_url_previews': false,
                'url_preview_transition': 'fade-in',
            });
        } else {
            const ogp_metadata = this.model.get('ogp_metadata') || [];
            const unfurls_to_show = api.settings.get('muc_show_ogp_unfurls') && ogp_metadata.length;
            if (unfurls_to_show) {
                this.model.set('url_preview_transition', 'fade-out');
            } else {
                this.model.save({
                    'hide_url_previews': true,
                    'url_preview_transition': 'fade-in',
                });
            }
        }
    }

    async getActionButtons () {
        const buttons = [];
        if (this.editable) {
            buttons.push({
                'i18n_text': this.correcting ? __('Cancel Editing') : __('Edit'),
                'handler': ev => this.onMessageEditButtonClicked(ev),
                'button_class': 'chat-msg__action-edit',
                'icon_class': 'fa fa-pencil-alt',
                'name': 'edit',
            });
        }
        const may_be_moderated = this.model.get('type') === 'groupchat' && (await this.model.mayBeModerated());
        const retractable = !this.is_retracted && (this.model.mayBeRetracted() || may_be_moderated);
        if (retractable) {
            buttons.push({
                'i18n_text': __('Retract'),
                'handler': ev => this.onMessageRetractButtonClicked(ev),
                'button_class': 'chat-msg__action-retract',
                'icon_class': 'fas fa-trash-alt',
                'name': 'retract',
            });
        }

        if (!this.model.collection) {
            // While we were awaiting, this model got removed from the
            // collection (happens during tests)
            return [];
        }
        const ogp_metadata = this.model.get('ogp_metadata') || [];
        const unfurls_to_show = api.settings.get('muc_show_ogp_unfurls') && ogp_metadata.length;
        const media_urls = getMediaURLs(this.model.get('media_urls') || [], this.model.get('body'));
        const media_to_show = media_urls.reduce((result, o) => result || isMediaURLDomainAllowed(o), false);
        if (unfurls_to_show || media_to_show) {
            let title;
            const hidden_preview = this.hide_url_previews;
            if (ogp_metadata.length > 1) {
                if (typeof hidden_preview === 'boolean') {
                    title = hidden_preview ? __('Show URL previews') : __('Hide URL previews');
                } else {
                    title = api.settings.get('render_media') ? __('Hide URL previews') : __('Show URL previews');
                }
            } else if (ogp_metadata.length === 1) {
                if (typeof hidden_preview === 'boolean') {
                    title = hidden_preview ? __('Show URL preview') : __('Hide URL preview');
                } else {
                    title = api.settings.get('render_media') ? __('Hide URL previews') : __('Show URL previews');
                }
            } else  {
                if (typeof hidden_preview === 'boolean') {
                    title = hidden_preview ? __('Show media') : __('Hide media');
                } else {
                    title = api.settings.get('render_media') ? __('Hide media') : __('Show media');
                }
            }
            buttons.push({
                'i18n_text': title,
                'handler': ev => this.onHidePreviewsButtonClicked(ev),
                'button_class': 'chat-msg__action-hide-previews',
                'icon_class': this.hide_url_previews ? 'fas fa-eye' : 'fas fa-eye-slash',
                'name': 'hide',
            });
        }

        /**
         * *Hook* which allows plugins to add more message action buttons
         * @event _converse#getMessageActionButtons
         * @example
         *  api.listen.on('getMessageActionButtons', (el, buttons) => {
         *      buttons.push({
         *          'i18n_text': 'Foo',
         *          'handler': ev => alert('Foo!'),
         *          'button_class': 'chat-msg__action-foo',
         *          'icon_class': 'fa fa-check',
         *          'name': 'foo'
         *      });
         *      return buttons;
         *  });
         */
        return api.hook('getMessageActionButtons', this, buttons);
    }
}

api.elements.define('converse-message-actions', MessageActions);
