import 'shared/autocomplete/index.js';
import log from "@converse/headless/log";
import tpl_adhoc from './templates/ad-hoc.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { api, converse } from "@converse/headless/core";
import { fetchCommandForm } from './utils.js';

const { Strophe, $iq, sizzle, u } = converse.env;


export default class AdHocCommands extends CustomElement {

    static get properties () {
        return {
            'alert': { type: String },
            'alert_type': { type: String },
            'nonce': { type: String }, // Used to force re-rendering
            'showform': { type: String },
            'view': { type: String },
        }
    }

    constructor () {
        super();
        this.view = 'choose-service';
        this.showform = '';
        this.commands = [];
    }

    render () {
        return tpl_adhoc({
            'alert': this.alert,
            'alert_type': this.alert_type,
            'commands': this.commands,
            'fetchCommands': ev => this.fetchCommands(ev),
            'hideCommandForm': ev => this.hideCommandForm(ev),
            'runCommand': ev => this.runCommand(ev),
            'showform': this.showform,
            'toggleCommandForm': ev => this.toggleCommandForm(ev),
            'view': this.view,
        });
    }

    async fetchCommands (ev) {
        ev.preventDefault();
        delete this.alert_type;
        delete this.alert;

        const form_data = new FormData(ev.target);
        const jid = form_data.get('jid').trim();
        let supported;
        try {
            supported = await api.disco.supports(Strophe.NS.ADHOC, jid)
        } catch (e) {
            log.error(e);
        }
        if (supported) {
            try {
                this.commands = await api.adhoc.getCommands(jid);
                this.view = 'list-commands';
            } catch (e) {
                log.error(e);
                this.alert_type = 'danger';
                this.alert = __('Sorry, an error occurred while looking for commands on that entity.');
                this.commands = [];
                log.error(e);
                return;
            }
        } else {
            this.alert_type = 'danger';
            this.alert = __("The specified entity doesn't support ad-hoc commands");
        }
    }

    async toggleCommandForm (ev) {
        ev.preventDefault();
        const node = ev.target.getAttribute('data-command-node');
        const cmd = this.commands.filter(c => c.node === node)[0];
        this.showform !== node && await fetchCommandForm(cmd);
        this.showform = node;
    }

    hideCommandForm (ev) {
        ev.preventDefault();
        this.showform = ''
    }

    async runCommand (ev) {
        ev.preventDefault();
        const form_data = new FormData(ev.target);
        const jid = form_data.get('command_jid').trim();
        const node = form_data.get('command_node').trim();

        const cmd = this.commands.filter(c => c.node === node)[0];
        cmd.alert = null;
        this.nonce = u.getUniqueId();

        const inputs = sizzle(':input:not([type=button]):not([type=submit])', ev.target);
        const config_array = inputs
            .filter(i => !['command_jid', 'command_node'].includes(i.getAttribute('name')))
            .map(u.webForm2xForm)
            .filter(n => n);

        const iq = $iq({to: jid, type: "set"})
            .c("command", {
                'sessionid': cmd.sessionid,
                'node': cmd.node,
                'xmlns': Strophe.NS.ADHOC
            }).c("x", {xmlns: Strophe.NS.XFORM, type: "submit"});
        config_array.forEach(node => iq.cnode(node).up());

        let result;
        try {
            result = await api.sendIQ(iq);
        } catch (e) {
            cmd.alert_type = 'danger';
            cmd.alert = __('Sorry, an error occurred while trying to execute the command. See the developer console for details');
            log.error('Error while trying to execute an ad-hoc command');
            log.error(e);
        }

        if (result) {
            cmd.alert = result.querySelector('note')?.textContent;
        } else {
            cmd.alert = 'Done';
        }
        cmd.alert_type = 'primary';
        this.nonce = u.getUniqueId();
    }
}

api.elements.define('converse-adhoc-commands', AdHocCommands);
