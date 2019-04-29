// Converse.js
// https://conversejs.org
//
// Copyright (c) 2013-2019, the Converse.js developers
// Licensed under the Mozilla Public License (MPLv2)

import "backbone.vdomview";
import bootstrap from "bootstrap.native";
import converse from "@converse/headless/converse-core";
import tpl_alert_modal from "templates/alert_modal.html";

const { Strophe, Backbone, _ } = converse.env;
const u = converse.env.utils;


converse.plugins.add('converse-modal', {

    initialize () {
        const { _converse } = this;

        _converse.BootstrapModal = Backbone.VDOMView.extend({

            initialize () {
                this.render().insertIntoDOM();
                this.modal = new bootstrap.Modal(this.el, {
                    backdrop: 'static',
                    keyboard: true
                });
                this.el.addEventListener('hide.bs.modal', (event) => {
                    if (!_.isNil(this.trigger_el)) {
                        this.trigger_el.classList.remove('selected');
                    }
                }, false);
            },

            insertIntoDOM () {
                const container_el = _converse.chatboxviews.el.querySelector("#converse-modals");
                container_el.insertAdjacentElement('beforeEnd', this.el);
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
                this.model.on('change', this.render, this);
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
        let alert 

        Object.assign(_converse.api, {
            'alert': {
                'show' (type, title, messages) {
                    if (_.isString(messages)) {
                        messages = [messages];
                    }
                    if (type === Strophe.LogLevel.ERROR) {
                        type = 'alert-danger';
                    } else if (type === Strophe.LogLevel.INFO) {
                        type = 'alert-info';
                    } else if (type === Strophe.LogLevel.WARN) {
                        type = 'alert-warning';
                    }

                    if (_.isUndefined(alert)) {
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
            }
        });
    }
});

