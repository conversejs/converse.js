/**
 * @typedef {import('./utils').AdHocCommand} AdHocCommand
 * @typedef {import('./utils').AdHocCommandResult} AdHocCommandResult
 */
import log from '../../log.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { parseCommandResult, parseForCommands } from './utils.js';

const { Strophe, $iq, u, stx } = converse.env;

/**
 * @typedef {'execute'| 'cancel' |'prev'|'next'|'complete'} AdHocCommandAction
 */

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
         * @param {string} to_jid
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
         * @param {string} jid
         * @param {string} node
         * @returns {Promise<AdHocCommandResult>}
         */
        async fetchCommandForm (jid, node) {
            const stanza = $iq({
                type: 'set',
                to: jid
            }).c('command', {
                xmlns: Strophe.NS.ADHOC,
                action: 'execute',
                node,
            });
            return parseCommandResult(await api.sendIQ(stanza));
        },

        /**
         * @method api.adhoc.runCommand
         * @param {String} jid
         * @param {String} sessionid
         * @param {AdHocCommandAction} action
         * @param {String} node
         * @param {Array<{ [k:string]: string }>} inputs
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
                ...(status === 'executing' ? parseCommandResult(result) : {}),
                note: result.querySelector('note')?.textContent
            }
        }
    }
}
