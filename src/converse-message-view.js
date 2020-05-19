/**
 * @module converse-message-view
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "./components/message.js";
import "./utils/html";
import "@converse/headless/converse-emoji";
import tpl_message from "templates/message.js";
import tpl_spinner from "templates/spinner.html";
import { _converse, api, converse } from  "@converse/headless/converse-core";
import { debounce } from 'lodash'
import { render } from "lit-html";

const u = converse.env.utils;


converse.plugins.add('converse-message-view', {

    dependencies: ["converse-modal", "converse-chatboxviews"],

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.settings.update({
            'muc_hats_from_vcard': false,
            'show_images_inline': true,
            'time_format': 'HH:mm',
        });


        /**
         * @class
         * @namespace _converse.MessageView
         * @memberOf _converse
         */
        _converse.MessageView = _converse.ViewWithAvatar.extend({
            className: 'msg-wrapper',
            events: {
                'click .chat-msg__edit-modal': 'showMessageVersionsModal',
                'click .retry': 'onRetryClicked'
            },

            initialize () {
                this.debouncedRender = debounce(() => {
                    // If the model gets destroyed in the meantime,
                    // it no longer has a collection
                    if (this.model.collection) {
                        this.render();
                    }
                }, 50);

                if (this.model.rosterContactAdded) {
                    this.model.rosterContactAdded.then(() => {
                        this.listenTo(this.model.contact, 'change:nickname', this.debouncedRender);
                        this.debouncedRender();
                    });
                }

                this.model.occupant && this.addOccupantListeners();
                this.listenTo(this.model, 'change', this.onChanged);
                this.listenTo(this.model, 'destroy', this.fadeOut);
                this.listenTo(this.model, 'occupantAdded', () => {
                    this.addOccupantListeners();
                    this.debouncedRender();
                });
                this.listenTo(this.model, 'vcard:change', this.debouncedRender);
            },

            async render () {
                await api.waitUntil('emojisInitialized');
                const is_followup = u.hasClass('chat-msg--followup', this.el);
                const is_retracted = this.model.get('retracted') || this.model.get('moderated') === 'retracted';
                const is_groupchat_message = this.model.get('type') === 'groupchat';

                let hats = [];
                if (is_groupchat_message) {
                    if (api.settings.get('muc_hats_from_vcard')) {
                        const role = this.model.vcard ? this.model.vcard.get('role') : null;
                        hats = role ? role.split(',') : [];
                    } else {
                        hats = this.model.occupant?.get('hats') || [];
                    }
                }

                render(tpl_message(
                    Object.assign(
                        this.model.toJSON(), {
                        'is_me_message': this.model.isMeCommand(),
                        'model': this.model,
                        'occupant': this.model.occupant,
                        'username': this.model.getDisplayName(),
                        hats,
                        is_groupchat_message,
                        is_retracted
                    })
                ), this.el);

                if (this.model.collection) {
                    // If the model gets destroyed in the meantime, it no
                    // longer has a collection.
                    this.model.collection.trigger('rendered', this);
                }
                is_followup && u.addClass('chat-msg--followup', this.el);
                this.el.setAttribute('data-isodate', this.model.get('time'));
                this.el.setAttribute('data-msgid', this.model.get('msgid'));
                return this.el;
            },

            async onChanged (item) {
                // Jot down whether it was edited because the `changed`
                // attr gets removed when this.render() gets called further down.
                const edited = item.changed.edited;
                if (this.model.changed.progress) {
                    return this.renderFileUploadProgresBar();
                }
                await this.debouncedRender();
                if (edited) {
                    this.onMessageEdited();
                }
            },

            addOccupantListeners () {
                this.listenTo(this.model.occupant, 'change:affiliation', this.debouncedRender);
                this.listenTo(this.model.occupant, 'change:hats', this.debouncedRender);
                this.listenTo(this.model.occupant, 'change:role', this.debouncedRender);
            },

            fadeOut () {
                if (api.settings.get('animate')) {
                    setTimeout(() => this.remove(), 600);
                    u.addClass('fade-out', this.el);
                } else {
                    this.remove();
                }
            },

            async onRetryClicked () {
                this.showSpinner();
                await this.model.error.retry();
                this.model.destroy();
            },

            showSpinner () {
                this.el.innerHTML = tpl_spinner();
            },

            onMessageEdited () {
                if (this.model.get('is_archived')) {
                    return;
                }
                this.el.addEventListener(
                    'animationend',
                    () => u.removeClass('onload', this.el),
                    {'once': true}
                );
                u.addClass('onload', this.el);
            }
        });
    }
});
