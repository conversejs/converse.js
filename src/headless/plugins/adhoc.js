import log from "@converse/headless/log";
import sizzle from 'sizzle';
import { __ } from 'i18n';
import { converse } from "../core.js";
import { getAttributes } from '@converse/headless/shared/parsers';

const { Strophe, u, stx, $iq } = converse.env;
let api;

Strophe.addNamespace('ADHOC', 'http://jabber.org/protocol/commands');


function parseForCommands (stanza) {
    const items = sizzle(`query[xmlns="${Strophe.NS.DISCO_ITEMS}"][node="${Strophe.NS.ADHOC}"] item`, stanza);
    return items.map(getAttributes)
}

function getCommandFields (iq, jid) {
    const cmd_el = sizzle(`command[xmlns="${Strophe.NS.ADHOC}"]`, iq).pop();
    const data = {
        sessionid: cmd_el.getAttribute('sessionid'),
        instructions: sizzle('x[type="form"][xmlns="jabber:x:data"] instructions', cmd_el).pop()?.textContent,
        fields: sizzle('x[type="form"][xmlns="jabber:x:data"] field', cmd_el)
            .map(f => u.xForm2TemplateResult(f, cmd_el, { domain: jid })),
        actions: Array.from(cmd_el.querySelector('actions')?.children).map((a) => a.nodeName.toLowerCase()) ?? []
    }
    return data;
}


const adhoc_api = {
    /**
     * The XEP-0050 Ad-Hoc Commands API
     *
     * This API lets you discover ad-hoc commands available for an entity in the XMPP network.
     *
     * @namespace api.adhoc
     * @memberOf api
     */
    adhoc: {
        /**
         * @method api.adhoc.getCommands
         * @param { String } to_jid
         */
        async getCommands (to_jid) {
            try {
                return parseForCommands(await api.disco.items(to_jid, Strophe.NS.ADHOC));
            } catch (e) {
                if (e === null) {
                    log.error(`Error: timeout while fetching ad-hoc commands for ${to_jid}`);
                } else {
                    log.error(`Error while fetching ad-hoc commands for ${to_jid}`);
                    log.error(e);
                }
                return [];
            }
        },

        /**
         * @method api.adhoc.fetchCommandForm
         */
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
            try {
                return getCommandFields(await api.sendIQ(stanza), jid);

            } catch (e) {
                if (e === null) {
                    log.error(`Error: timeout while trying to execute command for ${jid}`);
                } else {
                    log.error(`Error while trying to execute command for ${jid}`);
                    log.error(e);
                }
                return {
                    instructions: __('An error occurred while trying to fetch the command form'),
                    fields: []
                }
            }
        },

        /**
         * @method api.adhoc.runCommand
         * @param { String } jid
         * @param { String } sessionid
         * @param { 'execute' | 'cancel' | 'prev' | 'next' | 'complete' } action
         * @param { String } node
         * @param { Array<{ string: string }> } inputs
         */
        async runCommand (jid, sessionid, node, action, inputs) {
            const iq =
                stx`<iq type="set" to="${jid}" xmlns="jabber:client">
                    <command sessionid="${sessionid}" node="${node}" action="${action}" xmlns="${Strophe.NS.ADHOC}">
                        <x xmlns="${Strophe.NS.XFORM}" type="submit">
                            ${ inputs.reduce((out, { name, value }) => out + `<field var="${name}"><value>${value}</value></field>`, '') }
                        </x>
                    </command>
                </iq>`;

            const result = await api.sendIQ(iq, null, false);
            if (result === null) {
                log.warn(`A timeout occurred while trying to run an ad-hoc command`);
                return {
                    status: 'error',
                    note: __('A timeout occurred'),
                }
            } else if (u.isErrorStanza(result)) {
                log.error('Error while trying to execute an ad-hoc command');
                log.error(result);
            }

            const command = result.querySelector('command');
            const status = command?.getAttribute('status');
            return {
                status,
                ...(status === 'executing' ? getCommandFields(result) : {}),
                note: result.querySelector('note')?.textContent
            }
        }
    }
}


converse.plugins.add('converse-adhoc', {

    dependencies: ["converse-disco"],

    initialize () {
        const _converse = this._converse;
        api  = _converse.api;
        Object.assign(api, adhoc_api);
    }
});

export default adhoc_api;
