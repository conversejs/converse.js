import log from '@converse/headless/log';
import { _converse, api, converse } from "@converse/headless/core";
import { getCommandFields, parseForCommands } from './utils.js';

const { Strophe, $iq, u, stx } = converse.env;


export default {
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
                const { __ } = _converse;
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
                        ${ !['cancel', 'prev'].includes(action) ? stx`
                            <x xmlns="${Strophe.NS.XFORM}" type="submit">
                                ${ inputs.reduce((out, { name, value }) => out + `<field var="${name}"><value>${value}</value></field>`, '') }
                            </x>` : '' }
                    </command>
                </iq>`;

            const result = await api.sendIQ(iq, null, false);
            if (result === null) {
                log.warn(`A timeout occurred while trying to run an ad-hoc command`);
                const { __ } = _converse;
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
