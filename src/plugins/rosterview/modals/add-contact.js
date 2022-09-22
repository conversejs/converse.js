import 'shared/autocomplete/index.js';
import BaseModal from "plugins/modal/modal.js";
import compact from 'lodash-es/compact';
import debounce from 'lodash-es/debounce';
import tpl_add_contact_modal from "./templates/add-contact.js";
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const { Strophe } = converse.env;
const u = converse.env.utils;

export default class AddContactModal extends BaseModal {

    initialize () {
        super.initialize();
        this.listenTo(this.model, 'change', () => this.render());
        this.render();
        this.addEventListener('shown.bs.modal', () => this.querySelector('input[name="jid"]')?.focus(), false);
    }

    renderModal () {
        return tpl_add_contact_modal(this);
    }

    getModalTitle () { // eslint-disable-line class-methods-use-this
        return __('Add a Contact');
    }

    afterRender () {
        if (typeof api.settings.get('xhr_user_search_url') === 'string') {
            this.initXHRAutoComplete();
        } else {
            this.initJIDAutoComplete();
        }
    }

    initJIDAutoComplete () {
        if (!api.settings.get('autocomplete_add_contact')) {
            return;
        }
        const el = this.querySelector('.suggestion-box__jid').parentElement;
        this.jid_auto_complete = new _converse.AutoComplete(el, {
            'data': (text, input) => `${input.slice(0, input.indexOf("@"))}@${text}`,
            'filter': _converse.FILTER_STARTSWITH,
            'list': [...new Set(_converse.roster.map(item => Strophe.getDomainFromJid(item.get('jid'))))]
        });
    }

    initGroupAutoComplete () {
        if (!api.settings.get('autocomplete_add_contact')) {
            return;
        }
        const el = this.querySelector('.suggestion-box__jid').parentElement;
        this.jid_auto_complete = new _converse.AutoComplete(el, {
            'data': (text, input) => `${input.slice(0, input.indexOf("@"))}@${text}`,
            'filter': _converse.FILTER_STARTSWITH,
            'list': [...new Set(_converse.roster.map(item => Strophe.getDomainFromJid(item.get('jid'))))]
        });
    }

    initXHRAutoComplete () {
        if (!api.settings.get('autocomplete_add_contact')) {
            return this.initXHRFetch();
        }
        const el = this.querySelector('.suggestion-box__name').parentElement;
        this.name_auto_complete = new _converse.AutoComplete(el, {
            'auto_evaluate': false,
            'filter': _converse.FILTER_STARTSWITH,
            'list': []
        });
        const xhr = new window.XMLHttpRequest();
        // `open` must be called after `onload` for mock/testing purposes.
        xhr.onload = () => {
            if (xhr.responseText) {
                const r = xhr.responseText;
                this.name_auto_complete.list = JSON.parse(r).map(i => ({'label': i.fullname || i.jid, 'value': i.jid}));
                this.name_auto_complete.auto_completing = true;
                this.name_auto_complete.evaluate();
            }
        };
        const input_el = this.querySelector('input[name="name"]');
        input_el.addEventListener('input', debounce(() => {
            xhr.open("GET", `${api.settings.get('xhr_user_search_url')}q=${encodeURIComponent(input_el.value)}`, true);
            xhr.send()
        } , 300));
        this.name_auto_complete.on('suggestion-box-selectcomplete', ev => {
            this.querySelector('input[name="name"]').value = ev.text.label;
            this.querySelector('input[name="jid"]').value = ev.text.value;
        });
    }

    initXHRFetch () {
        this.xhr = new window.XMLHttpRequest();
        this.xhr.onload = () => {
            if (this.xhr.responseText) {
                const r = this.xhr.responseText;
                const list = JSON.parse(r).map(i => ({'label': i.fullname || i.jid, 'value': i.jid}));
                if (list.length !== 1) {
                    const el = this.querySelector('.invalid-feedback');
                    el.textContent = __('Sorry, could not find a contact with that name')
                    u.addClass('d-block', el);
                    return;
                }
                const jid = list[0].value;
                if (this.validateSubmission(jid)) {
                    const form = this.querySelector('form');
                    const name = list[0].label;
                    this.afterSubmission(form, jid, name);
                }
            }
        };
    }

    validateSubmission (jid) {
        const el = this.querySelector('.invalid-feedback');
        if (!jid || compact(jid.split('@')).length < 2) {
            u.addClass('is-invalid', this.querySelector('input[name="jid"]'));
            u.addClass('d-block', el);
            return false;
        } else if (_converse.roster.get(Strophe.getBareJidFromJid(jid))) {
            el.textContent = __('This contact has already been added')
            u.addClass('d-block', el);
            return false;
        }
        u.removeClass('d-block', el);
        return true;
    }

    afterSubmission (_form, jid, name, group) {
        if (group && !Array.isArray(group)) {
            group = [group];
        }
        _converse.roster.addAndSubscribe(jid, name, group);
        this.model.clear();
        this.modal.hide();
    }

    addContactFromForm (ev) {
        ev.preventDefault();
        const data = new FormData(ev.target);
        const jid = (data.get('jid') || '').trim();

        if (!jid && typeof api.settings.get('xhr_user_search_url') === 'string') {
            const input_el = this.querySelector('input[name="name"]');
            this.xhr.open("GET", `${api.settings.get('xhr_user_search_url')}q=${encodeURIComponent(input_el.value)}`, true);
            this.xhr.send()
            return;
        }
        if (this.validateSubmission(jid)) {
            this.afterSubmission(ev.target, jid, data.get('name'), data.get('group'));
        }
    }
}

api.elements.define('converse-add-contact-modal', AddContactModal);
