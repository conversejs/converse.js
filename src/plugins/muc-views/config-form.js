import log from "@converse/headless/log";
import tpl_muc_config_form from "./templates/muc-config-form.js";
import { CustomElement } from 'shared/components/element';
import { __ } from 'i18n';
import { _converse, api, converse } from "@converse/headless/core";

const { sizzle } = converse.env;
const u = converse.env.utils;


class MUCConfigForm extends CustomElement {

    static get properties () {
        return {
            'jid': { type: String }
        }
    }

    connectedCallback () {
        super.connectedCallback();
        this.model = _converse.chatboxes.get(this.jid);
        this.listenTo(this.model.features, 'change:passwordprotected', () => this.requestUpdate());
        this.listenTo(this.model.session, 'change:config_stanza', () => this.requestUpdate());
        this.getConfig();
    }

    render () {
        return tpl_muc_config_form({
            'model': this.model,
            'closeConfigForm': ev => this.closeForm(ev),
            'submitConfigForm': ev => this.submitConfigForm(ev),
        });
    }

    async getConfig () {
        const iq = await this.model.fetchRoomConfiguration();
        this.model.session.set('config_stanza', iq.outerHTML);
    }

    async submitConfigForm (ev) {
        ev.preventDefault();
        const inputs = sizzle(':input:not([type=button]):not([type=submit])', ev.target);
        const config_array = inputs.map(u.webForm2xForm).filter(f => f);
        try {
            await this.model.sendConfiguration(config_array);
        } catch (e) {
            log.error(e);
            const message =
                __("Sorry, an error occurred while trying to submit the config form.") + " " +
                __("Check your browser's developer console for details.");
            api.alert('error', __('Error'), message);
        }
        await this.model.refreshDiscoInfo();
        this.closeForm();
    }

    closeForm (ev) {
        ev?.preventDefault?.();
        this.model.session.set('view', null);
    }
}

api.elements.define('converse-muc-config-form', MUCConfigForm);

export default MUCConfigForm
