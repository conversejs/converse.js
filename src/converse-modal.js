// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)
/**
 * @module converse-modal
 */
import "backbone.vdomview";
import bootstrap from "bootstrap.native";
import converse from "@converse/headless/converse-core";
import { Model } from 'skeletor.js/src/model.js';
import { isString } from "lodash";
import tpl_alert from "templates/alert.html";
import tpl_alert_modal from "templates/alert_modal.html";
import tpl_prompt from "templates/prompt.html";

const { Backbone, sizzle } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-modal', {

    initialize () {
        const { _converse } = this;
        const { __ } = _converse;

        _converse.BootstrapModal = Backbone.VDOMView.extend({

            events: {
                'click  .nav-item .nav-link': 'switchTab'
            },

            initialize () {
                this.render().insertIntoDOM();
                this.modal = new bootstrap.Modal(this.el, {
                    backdrop: 'static',
                    keyboard: true
                });
                this.el.addEventListener('hide.bs.modal', () => u.removeClass('selected', this.trigger_el), false);
            },

            insertIntoDOM () {
                const container_el = _converse.chatboxviews.el.querySelector("#converse-modals");
                container_el.insertAdjacentElement('beforeEnd', this.el);
            },

            switchTab (ev) {
                ev.stopPropagation();
                ev.preventDefault();
                sizzle('.nav-link.active', this.el).forEach(el => {
                    u.removeClass('active', this.el.querySelector(el.getAttribute('href')));
                    u.removeClass('active', el);
                });
                u.addClass('active', ev.target);
                u.addClass('active', this.el.querySelector(ev.target.getAttribute('href')))
            },

            alert (message, type='primary') {
                const body = this.el.querySelector('.modal-body');
                body.insertAdjacentHTML(
                    'afterBegin',
                    tpl_alert({
                        'type': `alert-${type}`,
                        'message': message
                    })
                );
                const el = body.firstElementChild;
                setTimeout(() => {
                    u.addClass('fade-out', el);
                    setTimeout(() => u.removeElement(el), 600);
                }, 5000);
            },

            show (ev) {
                if (ev) {
                    ev.preventDefault();
                    this.trigger_el = ev.target;
                    this.trigger_el.classList.add('selected');
                }
                this.modal.show();
            }
        });

        _converse.Confirm = _converse.BootstrapModal.extend({
            events: {
                'submit .confirm': 'onConfimation'
            },

            initialize () {
                this.confirmation = u.getResolveablePromise();
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change', this.render)
                this.el.addEventListener('closed.bs.modal', () => this.confirmation.reject(), false);
            },

            toHTML () {
                return tpl_prompt(Object.assign({__}, this.model.toJSON()));
            },

            afterRender () {
                if (!this.close_handler_registered) {
                    this.el.addEventListener('closed.bs.modal', () => {
                        if (!this.confirmation.isResolved) {
                            this.confirmation.reject()
                        }
                    }, false);
                    this.close_handler_registered = true;
                }
            },

            onConfimation (ev) {
                ev.preventDefault();
                this.confirmation.resolve(true);
                this.modal.hide();
            }
        });


        _converse.Prompt = _converse.Confirm.extend({
            toHTML () {
                return tpl_prompt(Object.assign({__}, this.model.toJSON()));
            },

            onConfimation (ev) {
                ev.preventDefault();
                const form_data = new FormData(ev.target);
                this.confirmation.resolve(form_data.get('reason'));
                this.modal.hide();
            }
        });


        _converse.Alert = _converse.BootstrapModal.extend({
            initialize () {
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change', this.render)
            },

            toHTML () {
                return tpl_alert_modal(
                    Object.assign({__}, this.model.toJSON()));
            }
        });


        /************************ BEGIN Event Listeners ************************/
        _converse.api.listen.on('disconnect', () => {
            const container = document.querySelector("#converse-modals");
            if (container) {
                container.innerHTML = '';
            }
        });


        /************************ BEGIN API ************************/
        // We extend the default converse.js API to add methods specific to MUC chat rooms.
        let alert, prompt, confirm;

        Object.assign(_converse.api, {

            /**
             * Show a confirm modal to the user.
             * @method _converse.api.confirm
             * @param { String } title - The header text for the confirmation dialog
             * @param { (String[]|String) } messages - The text to show to the user
             * @returns { Promise } A promise which resolves with true or false
             */
            async confirm (title, messages=[]) {
                if (isString(messages)) {
                    messages = [messages];
                }
                if (confirm === undefined) {
                    const model = new Model({
                        'title': title,
                        'messages': messages,
                        'type': 'confirm'
                    })
                    confirm = new _converse.Confirm({model});
                } else {
                    confirm.confirmation = u.getResolveablePromise();
                    confirm.model.set({
                        'title': title,
                        'messages': messages,
                        'type': 'confirm'
                    });
                }
                confirm.show();
                try {
                    return await confirm.confirmation;
                } catch (e) {
                    return false;
                }
            },

            /**
             * Show a prompt modal to the user.
             * @method _converse.api.prompt
             * @param { String } title - The header text for the prompt
             * @param { (String[]|String) } messages - The prompt text to show to the user
             * @param { String } placeholder - The placeholder text for the prompt input
             * @returns { Promise } A promise which resolves with the text provided by the
             *  user or `false` if the user canceled the prompt.
             */
            async prompt (title, messages=[], placeholder='') {
                if (isString(messages)) {
                    messages = [messages];
                }
                if (prompt === undefined) {
                    const model = new Model({
                        'title': title,
                        'messages': messages,
                        'placeholder': placeholder,
                        'type': 'prompt'
                    })
                    prompt = new _converse.Prompt({model});
                } else {
                    prompt.confirmation = u.getResolveablePromise();
                    prompt.model.set({
                        'title': title,
                        'messages': messages,
                        'type': 'prompt'
                    });
                }
                prompt.show();
                try {
                    return await prompt.confirmation;
                } catch (e) {
                    return false;
                }
            },

            /**
             * Show an alert modal to the user.
             * @method _converse.api.alert
             * @param { ('info'|'warn'|'error') } type - The type of alert.
             * @param { String } title - The header text for the alert.
             * @param { (String[]|String) } messages - The alert text to show to the user.
             */
            alert (type, title, messages) {
                if (isString(messages)) {
                    messages = [messages];
                }
                let level;
                if (type === 'error') {
                    level = 'alert-danger';
                } else if (type === 'info') {
                    level = 'alert-info';
                } else if (type === 'warn') {
                    level = 'alert-warning';
                }

                if (alert === undefined) {
                    const model = new Model({
                        'title': title,
                        'messages': messages,
                        'level': level,
                        'type': 'alert'
                    })
                    alert = new _converse.Alert({model});
                } else {
                    alert.model.set({
                        'title': title,
                        'messages': messages,
                        'level': level
                    });
                }
                alert.show();
            }
        });
    }
});

