import bootstrap from "bootstrap.native";
import log from "@converse/headless/log";
import tpl_alert_component from "./templates/modal-alert.js";
import { View } from '@converse/skeletor/src/view.js';
import { api, converse } from "@converse/headless/core";
import { render } from 'lit';

import './styles/_modal.scss';

const { sizzle } = converse.env;
const u = converse.env.utils;


const BaseModal = View.extend({
    className: "modal",
    persistent: false, // Whether this modal should persist in the DOM once it's been closed
    events: {
        'click  .nav-item .nav-link': 'switchTab'
    },

    initialize (options) {
        if (!this.id) {
            throw new Error("Each modal class must have a unique id attribute");
        }
        // Allow properties to be set via passed in options
        Object.assign(this, options);

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
        this.el.addEventListener('hide.bs.modal', () => this.onHide(), false);
    },

    onHide () {
        u.removeClass('selected', this.trigger_el);
        !this.persistent && api.modal.remove(this);
    },

    insertIntoDOM () {
        const container_el = document.querySelector("#converse-modals");
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
            !u.hasClass('chat-image', this.trigger_el) && u.addClass('selected', this.trigger_el);
        }
        this.modal.show();
    }
});

export default BaseModal;
