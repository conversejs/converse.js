(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define([
            "converse-core",
            "bootstrap",
            "underscore",
            "backbone",
            "backbone.vdomview"
        ], factory);
   }
}(this, function (converse, bootstrap, _, Backbone) {
    "use strict";


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
                    ev.preventDefault();
                    this.trigger_el = ev.target;
                    this.trigger_el.classList.add('selected');
                    this.modal.show();
                }
            });
        }
    });
}));
