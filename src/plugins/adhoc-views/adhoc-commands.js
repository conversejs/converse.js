import { api, converse, log } from '@converse/headless';
import 'shared/autocomplete/index.js';
import tplAdhoc from './templates/ad-hoc.js';
import { CustomElement } from 'shared/components/element.js';
import { __ } from 'i18n';
import { getNameAndValue } from 'utils/html.js';

const { Strophe, sizzle } = converse.env;


export default class AdHocCommands extends CustomElement {
   /**
    * @typedef {import('@converse/headless/types/plugins/adhoc/types').AdHocCommandAction} AdHocCommandAction
    * @typedef {import('./types').AdHocCommandUIProps} AdHocCommandUIProps
    */

    static get properties() {
        return {
            alert: { type: String },
            alert_type: { type: String },
            commands: { type: Array },
            fetching: { type: Boolean },
            showform: { type: String },
            view: { type: String },
            note: { type: String },
        };
    }

    constructor() {
        super();
        this.view = 'choose-service';
        this.fetching = false;
        this.showform = '';
        this.note = '';
        this.commands = /** @type {AdHocCommandUIProps[]} */ ([]);
    }

    render() {
        return tplAdhoc(this);
    }

    /**
     * @param {SubmitEvent} ev
     */
    async fetchCommands(ev) {
        ev.preventDefault();

        if (!(ev.target instanceof HTMLFormElement)) {
            this.alert_type = 'danger';
            this.alert = 'Form could not be submitted';
            return;
        }

        this.fetching = true;
        delete this.alert_type;
        delete this.alert;

        const form_data = new FormData(ev.target);
        const jid = /** @type {string} */ (form_data.get('jid')).trim();
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
                this.commands = /** @type {AdHocCommandUIProps[]} */ (await api.adhoc.getCommands(jid));
                this.view = 'list-commands';
            } catch (e) {
                log.error(e);
                this.alert_type = 'danger';
                this.alert = __('Sorry, an error occurred while looking for commands on that entity.');
                this.commands = /** @type {AdHocCommandUIProps[]} */ ([]);
                log.error(e);
                return;
            }
        } else {
            this.commands = [];
            this.alert_type = 'danger';
            this.alert = __("The specified entity doesn't support ad-hoc commands");
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    async toggleCommandForm(ev) {
        ev.preventDefault();
        const node = /** @type {Element} */ (ev.target).getAttribute('data-command-node');
        const cmd = this.commands.filter((c) => c.node === node)[0];
        const { jid } = cmd;

        if (this.showform === node) {
            this.showform = '';
            this.requestUpdate();
        } else {
            try {
                const xform = await api.adhoc.fetchCommandForm(jid, node);
                Object.assign(cmd, xform);
            } catch (e) {
                if (e === null) {
                    log.error(`Error: timeout while trying to execute command for ${jid}`);
                } else {
                    log.error(`Error while trying to execute command for ${jid}`);
                    log.error(e);
                }
                cmd.alert = __('An error occurred while trying to fetch the command form');
                cmd.alert_type = 'danger';
            }
            this.showform = node;
        }
    }

    /**
     * @param {MouseEvent} ev
     */
    executeAction(ev) {
        ev.preventDefault();
        const form = /** @type {HTMLFormElement} */ (ev.target);
        const action = form.getAttribute('data-action');

        if (['execute', 'next', 'prev', 'complete'].includes(action)) {
            this.runCommand(form.form, /** @type {AdHocCommandAction} */ (action));
        } else {
            log.error(`Unknown action: ${action}`);
        }
    }

    /**
     * @param {AdHocCommandUIProps} cmd
     */
    clearCommand(cmd) {
        delete cmd.alert;
        delete cmd.instructions;
        delete cmd.sessionid;
        delete cmd.alert_type;
        delete cmd.status;
        cmd.fields = [];
        cmd.actions = [];
        this.showform = '';
    }

    /**
     * @param {HTMLFormElement} form
     * @param {AdHocCommandAction} action
     */
    async runCommand(form, action) {
        const form_data = new FormData(form);
        const jid = /** @type {string} */ (form_data.get('command_jid')).trim();
        const node = /** @type {string} */ (form_data.get('command_node')).trim();

        const cmd = this.commands.filter((c) => c.node === node)[0];
        delete cmd.alert;
        this.requestUpdate();

        const inputs =
            action === 'prev'
                ? []
                : sizzle(':input:not([type=button]):not([type=submit])', form)
                      .filter(
                          /** @param {HTMLInputElement} i */
                          (i) => !['command_jid', 'command_node'].includes(i.getAttribute('name'))
                      )
                      .map(getNameAndValue)
                      .filter(/** @param {unknown} [n] */ (n) => n);

        const response = await api.adhoc.runCommand(jid, cmd.sessionid, cmd.node, action, inputs);

        const { fields, status, note, instructions, actions } = response;

        if (status === 'error') {
            cmd.status = status;
            cmd.alert_type = 'danger';
            cmd.alert = __(
                'Sorry, an error occurred while trying to execute the command. See the developer console for details'
            );
            return this.requestUpdate();
        }

        if (status === 'executing') {
            Object.assign(cmd, { fields, instructions, actions, status });
            cmd.alert = __('Executing');
            cmd.alert_type = 'primary';
        } else if (status === 'completed') {
            // Mostrar mensaje de completado en el formulario del comando
            cmd.alert = __('Command completed successfully');
            cmd.alert_type = 'primary';
            cmd.status = 'completed';
            if (note) {
                cmd.note = note;
            }
            if (fields && fields.length > 0) {
                // Si hay campos de resultado, mostrarlos
                cmd.fields = fields;
            }
            // Clear actions to only show close button
            cmd.actions = [];
        } else {
            log.error(`Unexpected status for ad-hoc command: ${status}`);
            cmd.alert = __('Command completed');
            cmd.alert_type = 'primary';
        }
        this.requestUpdate();
    }

    /**
     * @param {MouseEvent} ev
     */
    async cancel(ev) {
        ev.preventDefault();
        this.showform = '';
        this.requestUpdate();

        const form_data = new FormData(/** @type {HTMLFormElement} */ (ev.target).form);
        const jid = /** @type {string} */ (form_data.get('command_jid')).trim();
        const node = /** @type {string} */ (form_data.get('command_node')).trim();

        const cmd = this.commands.filter((c) => c.node === node)[0];
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
