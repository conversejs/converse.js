import "./autocomplete.js"
import log from "@converse/headless/log";
import sizzle from "sizzle";
import { CustomElement } from './element.js';
import { __ } from '../i18n';
import { api, converse } from "@converse/headless/converse-core";
import { html } from "lit-html";
import { unsafeHTML } from 'lit-html/directives/unsafe-html.js';

const { Strophe, $iq } = converse.env;
const u = converse.env.utils;


const tpl_command_form = (o, command) => {
    const i18n_hide = __('Hide');
    const i18n_run = __('Execute');
    return html`
        <form @submit=${o.runCommand}>
            ${ command.alert ? html`<div class="alert alert-${command.alert_type}" role="alert">${command.alert}</div>` : '' }
            <fieldset class="form-group">
                <input type="hidden" name="command_node" value="${command.node}"/>
                <input type="hidden" name="command_jid" value="${command.jid}"/>

                <p class="form-help">${command.instructions}</p>
                <!-- Fields are generated internally, with xForm2webForm -->
                ${ command.fields.map(field =>  unsafeHTML(field)) }
            </fieldset>
            <fieldset>
                <input type="submit" class="btn btn-primary" value="${i18n_run}">
                <input type="button" class="btn btn-secondary button-cancel" value="${i18n_hide}" @click=${o.hideCommandForm}>
            </fieldset>
        </form>
    `;
}


const tpl_command = (o, command) => html`
    <li class="room-item list-group-item">
        <div class="available-chatroom d-flex flex-row">
            <a class="open-room available-room w-100"
               @click=${o.toggleCommandForm}
               data-command-node="${command.node}"
               data-command-jid="${command.jid}"
               data-command-name="${command.name}"
               title="${command.name}"
               href="#">${command.name || command.jid}</a>
        </div>
        ${ command.node === o.showform ? tpl_command_form(o, command) : '' }
    </li>
`;


async function getAutoCompleteList () {
    const models = [...(await api.rooms.get()), ...(await api.contacts.get())];
    const jids = [...new Set(models.map(o => Strophe.getDomainFromJid(o.get('jid'))))];
    return jids;
}

const tpl_adhoc = (o) => {
    const i18n_choose_service = __('On which entity do you want to run commands?');
    const i18n_choose_service_instructions = __(
        'Certain XMPP services and entities allow privileged users to execute ad-hoc commands on them.');
    const i18n_commands_found = __('Commands found');
    const i18n_fetch_commands = __('List available commands');
    const i18n_jid_placeholder = __('XMPP Address');
    const i18n_no_commands_found = __('No commands found');
    return html`
        ${ o.alert ? html`<div class="alert alert-${o.alert_type}" role="alert">${o.alert}</div>` : '' }
        <form class="converse-form" @submit=${o.fetchCommands}>
            <fieldset class="form-group">
                <label>
                    ${i18n_choose_service}
                    <p class="form-help">${i18n_choose_service_instructions}</p>
                    <converse-autocomplete
                        .getAutoCompleteList="${getAutoCompleteList}"
                        placeholder="${i18n_jid_placeholder}"
                        name="jid"/>
                </label>
            </fieldset>
            <fieldset class="form-group">
                <input type="submit" class="btn btn-primary" value="${i18n_fetch_commands}">
            </fieldset>
            ${ o.view === 'list-commands' ? html`
            <fieldset class="form-group">
                <ul class="list-group">
                    <li class="list-group-item active">${ o.commands.length ? i18n_commands_found : i18n_no_commands_found }:</li>
                    ${ o.commands.map(cmd => tpl_command(o, cmd)) }
                </ul>
            </fieldset>`
            : '' }

        </form>
    `;
}


async function fetchCommandForm (command) {
    const node = command.node;
    const jid = command.jid;
    const stanza = $iq({
        'type': 'set',
        'to': jid
    }).c('command', {
        'xmlns': Strophe.NS.ADHOC,
        'node': node,
        'action': 'execute'
    });
    try {
        const iq = await api.sendIQ(stanza);
        const cmd_el = sizzle(`command[xmlns="${Strophe.NS.ADHOC}"]`, iq).pop();
        command.sessionid = cmd_el.getAttribute('sessionid');
        command.instructions = sizzle('x[type="form"][xmlns="jabber:x:data"] instructions', cmd_el).pop()?.textContent;
        command.fields = sizzle('x[type="form"][xmlns="jabber:x:data"] field', cmd_el)
            .map(f => u.xForm2webForm(f, cmd_el));

    } catch (e) {
        if (e === null) {
            log.error(`Error: timeout while trying to execute command for ${jid}`);
        } else {
            log.error(`Error while trying to execute command for ${jid}`);
            log.error(e);
        }
        command.fields = [];
    }
}


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
