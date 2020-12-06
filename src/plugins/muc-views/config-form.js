import log from "@converse/headless/log";
import tpl_muc_config_form from "templates/muc_config_form.js";
import { View } from '@converse/skeletor/src/view.js';
import { __ } from 'i18n';
import { api, converse } from "@converse/headless/core";

const { sizzle } = converse.env;
const u = converse.env.utils;


const MUCConfigForm = View.extend({
    className: 'chatroom-form-container muc-config-form',

    initialize (attrs) {
        this.chatroomview = attrs.chatroomview;
        this.listenTo(this.chatroomview.model.features, 'change:passwordprotected', this.render);
        this.listenTo(this.chatroomview.model.features, 'change:config_stanza', this.render);
        this.render();
    },

    toHTML () {
        const stanza = u.toStanza(this.model.get('config_stanza'));
        const whitelist = api.settings.get('roomconfig_whitelist');
        let fields = sizzle('field', stanza);
        if (whitelist.length) {
            fields = fields.filter(f => whitelist.includes(f.getAttribute('var')));
        }
        const password_protected = this.model.features.get('passwordprotected');
        const options = {
            'new_password': !password_protected,
            'fixed_username': this.model.get('jid')
        };
        return tpl_muc_config_form({
            'closeConfigForm': ev => this.closeConfigForm(ev),
            'fields': fields.map(f => u.xForm2webForm(f, stanza, options)),
            'instructions': stanza.querySelector('instructions')?.textContent,
            'submitConfigForm': ev => this.submitConfigForm(ev),
            'title': stanza.querySelector('title')?.textContent
        });
    },

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
        this.chatroomview.closeForm();
    },

    closeConfigForm (ev) {
        ev.preventDefault();
        this.chatroomview.closeForm();
    }
});

export default MUCConfigForm
