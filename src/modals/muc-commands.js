import { BootstrapModal } from "../converse-modal.js";
import { __ } from '@converse/headless/i18n';
import { api } from "@converse/headless/converse-core";
import log from "@converse/headless/log";
import sizzle from "sizzle";
import tpl_muc_commands_modal from "../templates/muc_commands_modal.js";

const { Strophe, $iq } = window.converse.env;
const u = window.converse.env.utils;


export default BootstrapModal.extend({
    id: "muc-commands-modal",

    initialize () {
        this.commands = [];
        BootstrapModal.prototype.initialize.apply(this, arguments);
        this.listenTo(this.model, 'change', this.render);
        this.getCommands();
    },

    toHTML () {
        return tpl_muc_commands_modal(Object.assign(
            this.model.toJSON(), {
                'commands': this.commands,
                'display_name': __('Ad-hoc commands for %1$s', this.model.getDisplayName()),
                'toggleCommandForm': ev => this.toggleCommandForm(ev)
            })
        );
    },

    async getCommands () {
        this.commands = await api.adhoc.getCommands(Strophe.getDomainFromJid(this.model.get('jid')));
        this.render();
    },

    async toggleCommandForm (ev) {
        ev.preventDefault();
        const node = ev.target.getAttribute('data-command-node');
        this.commands.filter(c => (c.node !== node)).forEach(c => (c.show_form = false));
        const cmd = this.commands.filter(c => c.node === node)[0];
        cmd.show_form = !cmd.show_form;
        cmd.show_form && await this.fetchCommandForm(cmd);
        this.render();
    },

    async fetchCommandForm (command) {
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
        command.fields;
        try {
            const iq = await api.sendIQ(stanza);
            command.fields = sizzle('field', iq).map(f => u.xForm2webForm(f, iq))
        } catch (e) {
            if (e === null) {
                log.error(`Error: timeout while trying to execute command for ${jid}`);
            } else {
                log.error(`Error while trying to execute command for ${jid}`);
                log.error(e);
            }
            command.fields = [];
        }

        /*
        <iq xmlns="jabber:client" id="72c21b57-5e9f-4b63-9e53-c6e69ed3337e:sendIQ" type="result" from="conference.chat.example.org" to="arzu.horsten@chat.example.org/converse.js-138545405">
            <command xmlns="http://jabber.org/protocol/commands" node="http://prosody.im/protocol/hats#add" sessionid="141a571b-37e2-4891-824f-72ca4b64806f" status="executing">
                <x xmlns="jabber:x:data" type="form">
                    <title>Add a hat</title>
                    <instructions>Assign a hat to a room member</instructions>
                    <field label="User JID" type="jid-single" var="user"><required/></field>
                    <field label="Room JID" type="jid-single" var="room"><required/></field>
                    <field label="Hat title" type="text-single" var="title"/>
                    <field label="Hat URI" type="text-single" var="uri"><required/></field>
                </x>
                <actions execute="complete"><next/><complete/></actions>
            </command>
        </iq>
        */


    }
});
