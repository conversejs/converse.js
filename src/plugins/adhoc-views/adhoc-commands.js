import 'shared/autocomplete/index.js';
import log from '@converse/headless/log';
import tplAdhoc from './templates/ad-hoc.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { api, converse } from '@converse/headless/core.js';
import { getNameAndValue } from 'utils/html.js';

const { Strophe, sizzle } = converse.env;


export default class AdHocCommands extends CustomElement {
    static get properties () {
        return {
            'alert': { type: String },
            'alert_type': { type: String },
            'commands': { type: Array },
            'fetching': { type: Boolean },
            'showform': { type: String },
            'view': { type: String },
        };
    }

    constructor () {
        super();
        this.view = 'choose-service';
        this.fetching = false;
        this.showform = '';
        this.commands = [];
    }

    render () {
        return tplAdhoc(this)
    }

    async fetchCommands (ev) {
        ev.preventDefault();
        delete this.alert_type;
        delete this.alert;

        this.fetching = true;

        const form_data = new FormData(ev.target);
        const jid = form_data.get('jid').trim();
        let supported;
        try {
            supported = await api.disco.supports(Strophe.NS.ADHOC, jid);
        } catch (e) {
            log.error(e);
        } finally {
            this.fetching = false;
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
        if (this.showform === node) {
            this.showform = '';
            this.requestUpdate();
        } else {
            const form = await api.adhoc.fetchCommandForm(cmd);
            cmd.sessionid = form.sessionid;
            cmd.instructions = form.instructions;
            cmd.fields = form.fields;
            cmd.actions = form.actions;
            this.showform = node;
        }
    }

    executeAction (ev) {
        ev.preventDefault();

        const action = ev.target.getAttribute('data-action');

        if (['execute', 'next', 'prev', 'complete'].includes(action)) {
            this.runCommand(ev.target.form, action);
        } else {
            log.error(`Unknown action: ${action}`);
        }
    }

    clearCommand (cmd) {
        delete cmd.alert;
        delete cmd.instructions;
        delete cmd.sessionid;
        delete cmd.alert_type;
        cmd.fields = [];
        cmd.acions = [];
        this.showform = '';
    }

    async runCommand (form, action) {
        const form_data = new FormData(form);
        const jid = form_data.get('command_jid').trim();
        const node = form_data.get('command_node').trim();

        const cmd = this.commands.filter(c => c.node === node)[0];
        delete cmd.alert;
        this.requestUpdate();

        const inputs = action === 'prev' ? [] :
            sizzle(':input:not([type=button]):not([type=submit])', form)
                .filter(i => !['command_jid', 'command_node'].includes(i.getAttribute('name')))
                .map(getNameAndValue)
                .filter(n => n);

        const response = await api.adhoc.runCommand(jid, cmd.sessionid, cmd.node, action, inputs);

        const { fields, status, note, instructions, actions } = response;

        if (status === 'error') {
            cmd.alert_type = 'danger';
            cmd.alert = __(
                'Sorry, an error occurred while trying to execute the command. See the developer console for details'
            );
            return this.requestUpdate();
        }

        if (status === 'executing') {
            cmd.alert = __('Executing');
            cmd.fields = fields;
            cmd.instructions = instructions;
            cmd.alert_type = 'primary';
            cmd.actions = actions;
        } else if (status === 'completed') {
            this.alert_type = 'primary';
            this.alert = __('Completed');
            this.note = note;
            this.clearCommand(cmd);
        } else {
            log.error(`Unexpected status for ad-hoc command: ${status}`);
            cmd.alert = __('Completed');
            cmd.alert_type = 'primary';
        }
        this.requestUpdate();
    }

    async cancel (ev) {
        ev.preventDefault();
        this.showform = '';
        this.requestUpdate();

        const form_data = new FormData(ev.target.form);
        const jid = form_data.get('command_jid').trim();
        const node = form_data.get('command_node').trim();

        const cmd = this.commands.filter(c => c.node === node)[0];
        delete cmd.alert;
        this.requestUpdate();

        const { status } = await api.adhoc.runCommand(jid, cmd.sessionid, cmd.node, 'cancel', []);

        if (status === 'error') {
            cmd.alert_type = 'danger';
            cmd.alert = __(
                'An error occurred while trying to cancel the command. See the developer console for details'
            );
        } else if (status === 'canceled') {
            this.alert_type = '';
            this.alert = '';
            this.clearCommand(cmd);
        } else {
            log.error(`Unexpected status for ad-hoc command: ${status}`);
            cmd.alert = __('Error: unexpected result');
            cmd.alert_type = 'danger';
        }
        this.requestUpdate();
    }
}

api.elements.define('converse-adhoc-commands', AdHocCommands);
