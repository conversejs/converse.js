/**
 * @typedef {module:headless-shared-parsers.MediaURLMetadata} MediaURLData
 */
import { html } from 'lit';
import { until } from 'lit/directives/until.js';
import { api, log, _converse, u, constants } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { isMediaURLDomainAllowed, isDomainWhitelisted } from 'utils/url.js';

import './styles/message-actions.scss';

const { getMediaURLs } = u;
const { CHATROOMS_TYPE } = constants;

/**
 * @typedef {Object} MessageActionAttributes
 * An object which represents a message action (as shown in the message dropdown);
 * @property {String} i18n_text
 * @property {Function} handler
 * @property {String} button_class
 * @property {String} icon_class
 * @property {String} name
 */

class MessageActions extends CustomElement {
    static get properties () {
        return {
            is_retracted: { type: Boolean },
            model: { type: Object }
        };
    }

    constructor () {
        super();
        this.model = null;
        this.is_retracted = null;
    }

    initialize () {
        const settings = api.settings.get();
        this.listenTo(settings, 'change:allowed_audio_domains', () => this.requestUpdate());
        this.listenTo(settings, 'change:allowed_image_domains', () => this.requestUpdate());
        this.listenTo(settings, 'change:allowed_video_domains', () => this.requestUpdate());
        this.listenTo(settings, 'change:render_media', () => this.requestUpdate());
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        // This may change the ability to send messages, and therefore the presence of the quote button.
        // See plugins/muc-views/bottom-panel.js
        this.listenTo(this.model.collection.chatbox.features, 'change:moderated', () => this.requestUpdate());
        this.listenTo(this.model.collection.chatbox.occupants, 'add', this.updateIfOwnOccupant);
        this.listenTo(this.model.collection.chatbox.occupants, 'change:role', this.updateIfOwnOccupant);
        this.listenTo(this.model.collection.chatbox.session, 'change:connection_status', () => this.requestUpdate());
    }

    updateIfOwnOccupant (o) {
        const bare_jid = _converse.session.get('bare_jid');
        if (o.get('jid') === bare_jid) {
            this.requestUpdate();
        }
    }

    render () {
        return html`${until(this.renderActions(), '')}`;
    }

    async renderActions () {
        // This can be called before the model has been added to the collection
        // when requesting an update on change:connection_status.
        // This line allows us to pass tests.
        if (!this.model.collection) return '';

        const buttons = await this.getActionButtons();
        const items = buttons.map(b => MessageActions.getActionsDropdownItem(b));
        if (items.length) {
            return html`<converse-dropdown
                class="chat-msg__actions btn-group dropstart"
                .items=${items}
            ></converse-dropdown>`;
        } else {
            return '';
        }
    }

    static getActionsDropdownItem (o) {
        return html`
            <button type="button" class="dropdown-item chat-msg__action ${o.button_class}" @click=${o.handler}>
                <converse-icon
                    class="${o.icon_class}"
                    color="var(--inverse-link-color)"
                    size="1em"
                ></converse-icon>&nbsp;${o.i18n_text}
            </button>
        `;
    }

    /** @param {MouseEvent} ev */
    async onMessageEditButtonClicked (ev) {
        ev.preventDefault();
        const currently_correcting = this.model.collection.findWhere('correcting');
        // TODO: Use state intead of DOM querying
        // Then this code can also be put on the model
        const unsent_text = u.ancestor(this, '.chatbox')?.querySelector('.chat-textarea')?.value;
        if (unsent_text && (!currently_correcting || currently_correcting.getMessageText() !== unsent_text)) {
            const result = await api.confirm(
                __('You have an unsent message which will be lost if you continue. Are you sure?')
            );
            if (!result) return;
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
     * @param {string} [reason] - The reason for retracting the message.
     */
    async retractOtherMessage (reason) {
        const chatbox = this.model.collection.chatbox;
        const result = await chatbox.retractOtherMessage(this.model, reason);
        if (result === null) {
            const err_msg = __(`A timeout occurred while trying to retract the message`);
            api.alert('error', __('Error'), err_msg);
            log.warn(err_msg);
        } else if (u.isErrorStanza(result)) {
            const err_msg = __(`Sorry, you're not allowed to retract this message.`);
            api.alert('error', __('Error'), err_msg);
            log.warn(err_msg);
            log.error(result);
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

    /** @param {MouseEvent} [ev] */
    onMessageRetractButtonClicked (ev) {
        ev?.preventDefault?.();
        const chatbox = this.model.collection.chatbox;
        if (chatbox.get('type') === CHATROOMS_TYPE) {
            this.onMUCMessageRetractButtonClicked();
        } else {
            this.onDirectMessageRetractButtonClicked();
        }
    }

    /** @param {MouseEvent} [ev] */
    onMediaToggleClicked (ev) {
        ev?.preventDefault?.();

        if (this.hasHiddenMedia(this.getMediaURLs())) {
            this.model.save({
                'hide_url_previews': false,
                'url_preview_transition': 'fade-in',
            });
        } else {
            const ogp_metadata = this.model.get('ogp_metadata') || [];
            if (ogp_metadata.length) {
                this.model.set('url_preview_transition', 'fade-out');
            } else {
                this.model.save({
                    'hide_url_previews': true,
                    'url_preview_transition': 'fade-in',
                });
            }
        }
    }

    /**
     * Check whether media is hidden or shown, which is used to determine the toggle text.
     *
     * If `render_media` is an array, check if there are media URLs outside
     * of that array, in which case we consider message media on the whole to be hidden (since
     * those excluded by the whitelist will be, even if the render_media whitelisted URLs are shown).
     * @param { Array<String> } media_urls
     * @returns { Boolean }
     */
    hasHiddenMedia (media_urls) {
        if (typeof this.model.get('hide_url_previews') === 'boolean') {
            return this.model.get('hide_url_previews');
        }
        const render_media = api.settings.get('render_media');
        if (Array.isArray(render_media)) {
            return media_urls.reduce((acc, url) => acc || !isDomainWhitelisted(render_media, url), false);
        } else {
            return !render_media;
        }
    }

    getMediaURLs () {
        const unfurls_to_show = (this.model.get('ogp_metadata') || [])
            .map(o => ({ 'url': o['og:image'], 'is_image': true }))
            .filter(o => isMediaURLDomainAllowed(o));

        const url_strings = getMediaURLs(this.model.get('media_urls') || [], this.model.get('body'));
        const media_urls = /** @type {MediaURLData[]} */(url_strings.filter(o => isMediaURLDomainAllowed(o)));
        return [...new Set([...media_urls.map(o => o.url), ...unfurls_to_show.map(o => o.url)])];
    }

    /**
     * Adds a media rendering toggle to this message's action buttons if necessary.
     *
     * The toggle is only added if the message contains media URLs and if the
     * user is allowed to show or hide media for those URLs.
     *
     * Whether a user is allowed to show or hide domains depends on the config settings:
     * * allowed_audio_domains
     * * allowed_video_domains
     * * allowed_image_domains
     *
     * Whether media is currently shown or hidden is determined by the { @link hasHiddenMedia } method.
     *
     * @param { Array<MessageActionAttributes> } buttons - An array of objects representing action buttons
     */
    addMediaRenderingToggle (buttons) {
        const urls = this.getMediaURLs();
        if (urls.length) {
            const hidden = this.hasHiddenMedia(urls);
            buttons.push({
                'i18n_text': hidden ? __('Show media') : __('Hide media'),
                'handler': ev => this.onMediaToggleClicked(ev),
                'button_class': 'chat-msg__action-hide-previews',
                'icon_class': hidden ? 'fas fa-eye' : 'fas fa-eye-slash',
                'name': 'hide',
            });
        }
    }

    /** @param {MouseEvent} [ev] */
    async onMessageCopyButtonClicked (ev) {
        ev?.preventDefault?.();
        await navigator.clipboard.writeText(this.model.getMessageText());
    }

    /** @param {MouseEvent} [ev] */
    onMessageQuoteButtonClicked (ev) {
        ev?.preventDefault?.();
        const { chatboxviews } = _converse.state;
        const view = chatboxviews.get(this.model.collection.chatbox.get('jid'));
        view?.getMessageForm().insertIntoTextArea(
            this.model.getMessageText().replaceAll(/^/gm, '> '),
            false, false, null, '\n'
        );
    }

    async getActionButtons () {
        const buttons = [];
        if (this.model.get('editable')) {
            buttons.push(/** @type {MessageActionAttributes} */({
                'i18n_text': this.model.get('correcting') ? __('Cancel Editing') : __('Edit'),
                'handler': ev => this.onMessageEditButtonClicked(ev),
                'button_class': 'chat-msg__action-edit',
                'icon_class': 'fa fa-pencil-alt',
                'name': 'edit',
            }));
        }

        const may_be_moderated = ['groupchat', 'mep'].includes(this.model.get('type')) &&
            (await this.model.mayBeModerated());
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

        this.addMediaRenderingToggle(buttons);

        buttons.push({
            'i18n_text': __('Copy'),
            'handler': ev => this.onMessageCopyButtonClicked(ev),
            'button_class': 'chat-msg__action-copy',
            'icon_class': 'fas fa-copy',
            'name': 'copy',
        });

        if (this.model.collection.chatbox.canPostMessages()) {
            buttons.push({
                'i18n_text': __('Quote'),
                'handler': ev => this.onMessageQuoteButtonClicked(ev),
                'button_class': 'chat-msg__action-quote',
                'icon_class': 'fas fa-quote-right',
                'name': 'quote',
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
