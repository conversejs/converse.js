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
import { isString } from "lodash";
import tpl_alert from "templates/alert.html";
import tpl_alert_modal from "templates/alert_modal.html";

const { Backbone, sizzle } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-modal', {

    initialize () {
        const { _converse } = this;

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

        _converse.Alert = _converse.BootstrapModal.extend({

            initialize () {
                _converse.BootstrapModal.prototype.initialize.apply(this, arguments);
                this.listenTo(this.model, 'change', this.render)
            },

            toHTML () {
                return tpl_alert_modal(this.model.toJSON());
            }
        });

        _converse.api.listen.on('afterTearDown', () => {
            if (!_converse.chatboxviews) {
                return;
            }
            const container = _converse.chatboxviews.el.querySelector("#converse-modals");
            if (container) {
                container.innerHTML = '';
            }
        });


        /************************ BEGIN API ************************/
        // We extend the default converse.js API to add methods specific to MUC chat rooms.
        let alert;

        Object.assign(_converse.api, {
            /**
             * Show an alert modal to the user.
             * @method _converse.api.alert
             * @param { ('info'|'warn'|'error') } type - The type of alert.
             * @returns { String } title - The header text for the alert.
             * @returns { (String[]|String) } messages - The alert text to show to the user.
             */
            alert (type, title, messages) {
                if (isString(messages)) {
                    messages = [messages];
                }
                if (type === 'error') {
                    type = 'alert-danger';
                } else if (type === 'info') {
                    type = 'alert-info';
                } else if (type === 'warn') {
                    type = 'alert-warning';
                }

                if (alert === undefined) {
                    const model = new Backbone.Model({
                        'title': title,
                        'messages': messages,
                        'type': type
                    })
                    alert = new _converse.Alert({'model': model});
                } else {
                    alert.model.set({
                        'title': title,
                        'messages': messages,
                        'type': type
                    });
                }
                alert.show();
            }
        });
    }
});

