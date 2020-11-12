/**
 * @module converse-modal
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { View } from '@converse/skeletor/src/view.js';
import { Model } from '@converse/skeletor/src/model.js';
import { render } from 'lit-html';
import { __ } from './i18n';
import bootstrap from "bootstrap.native";
import { converse } from "@converse/headless/converse-core";
import log from "@converse/headless/log";
import tpl_alert_component from "templates/alert.js";
import tpl_alert_modal from "templates/alert_modal.js";
import tpl_prompt from "templates/prompt.js";

const { sizzle } = converse.env;
const u = converse.env.utils;

let _converse;


export const BootstrapModal = View.extend({
    className: "modal",
    events: {
        'click  .nav-item .nav-link': 'switchTab'
    },

    initialize () {
        this.render()

        this.el.setAttribute('tabindex', '-1');
        this.el.setAttribute('role', 'dialog');
        this.el.setAttribute('aria-hidden', 'true');
        const label_id = this.el.querySelector('.modal-title').getAttribute('id');
        label_id && this.el.setAttribute('aria-labelledby', label_id);

        this.insertIntoDOM();
        const Modal = bootstrap.Modal;
        this.modal = new Modal(this.el, {
            backdrop: true,
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
        const body = this.el.querySelector('.modal-alert');
        if (body === null) {
            log.error("Could not find a .modal-alert element in the modal to show an alert message in!");
            return;
        }
        // FIXME: Instead of adding the alert imperatively, we should
        // find a way to let the modal rerender with an alert message
        render(tpl_alert_component({'type': `alert-${type}`, 'message': message}), body);
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

converse.env.BootstrapModal = BootstrapModal; // expose to plugins

export const Confirm = BootstrapModal.extend({
    events: {
        'submit .confirm': 'onConfimation'
    },

    initialize () {
        this.confirmation = u.getResolveablePromise();
        BootstrapModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render)
        this.el.addEventListener('closed.bs.modal', () => this.confirmation.reject(), false);
    },

    toHTML () {
        return tpl_prompt(this.model.toJSON());
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
        const form_data = new FormData(ev.target);
        const fields = (this.model.get('fields') || [])
            .map(field => {
                const value = form_data.get(field.name).trim();
                field.value = value;
                if (field.challenge) {
                    field.challenge_failed = (value !== field.challenge);
                }
                return field;
            });

        if (fields.filter(c => c.challenge_failed).length) {
            this.model.set('fields', fields);
            // Setting an array doesn't trigger a change event
            this.model.trigger('change');
            return;
        }
        this.confirmation.resolve(fields);
        this.modal.hide();
    }
});


export const Alert = BootstrapModal.extend({
    initialize () {
        BootstrapModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render)
    },

    toHTML () {
        return tpl_alert_modal(Object.assign({__}, this.model.toJSON()));
    }
});


converse.plugins.add('converse-modal', {

    initialize () {
        _converse = this._converse

        /************************ BEGIN Event Listeners ************************/
        _converse.api.listen.on('disconnect', () => {
            const container = document.querySelector("#converse-modals");
            if (container) {
                container.innerHTML = '';
            }
        });


        /************************ BEGIN API ************************/
        // We extend the default converse.js API to add methods specific to MUC chat rooms.
        let alert;

        Object.assign(_converse.api, {
            /**
             * Show a confirm modal to the user.
             * @method _converse.api.confirm
             * @param { String } title - The header text for the confirmation dialog
             * @param { (String[]|String) } messages - The text to show to the user
             * @param { Array<Field> } fields - An object representing a fields presented to the user.
             * @property { String } Field.label - The form label for the input field.
             * @property { String } Field.name - The name for the input field.
             * @property { String } [Field.challenge] - A challenge value that must be provided by the user.
             * @property { String } [Field.placeholder] - The placeholder for the input field.
             * @property { Boolean} [Field.required] - Whether the field is required or not
             * @returns { Promise<Array|false> } A promise which resolves with an array of
             *  filled in fields or `false` if the confirm dialog was closed or canceled.
             */
            async confirm (title, messages=[], fields=[]) {
                if (typeof messages === 'string') {
                    messages = [messages];
                }
                const model = new Model({title, messages, fields, 'type': 'confirm'})
                const confirm = new Confirm({model});
                confirm.show();
                let result;
                try {
                    result = await confirm.confirmation;
                } catch (e) {
                    result = false;
                }
                confirm.remove();
                return result;
            },

            /**
             * Show a prompt modal to the user.
             * @method _converse.api.prompt
             * @param { String } title - The header text for the prompt
             * @param { (String[]|String) } messages - The prompt text to show to the user
             * @param { String } placeholder - The placeholder text for the prompt input
             * @returns { Promise<String|false> } A promise which resolves with the text provided by the
             *  user or `false` if the user canceled the prompt.
             */
            async prompt (title, messages=[], placeholder='') {
                if (typeof messages === 'string') {
                    messages = [messages];
                }
                const model = new Model({
                    title,
                    messages,
                    'fields': [{
                        'name': 'reason',
                        'placeholder': placeholder,
                    }],
                    'type': 'prompt'
                })
                const prompt = new Confirm({model});
                prompt.show();
                let result;
                try {
                    result = (await prompt.confirmation).pop()?.value;
                } catch (e) {
                    result = false;
                }
                prompt.remove();
                return result;
            },

            /**
             * Show an alert modal to the user.
             * @method _converse.api.alert
             * @param { ('info'|'warn'|'error') } type - The type of alert.
             * @param { String } title - The header text for the alert.
             * @param { (String[]|String) } messages - The alert text to show to the user.
             */
            alert (type, title, messages) {
                if (typeof messages === 'string') {
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
                    alert = new Alert({model});
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

