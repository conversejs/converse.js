/**
 * @module converse-reactions
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description XEP-0444: Message Reactions - Headless core logic
 */

import converse from '../../shared/api/public.js';
import api from '../../shared/api/index.js';
import { parseReactionsMessage } from './parsers.js';

const { Strophe } = converse.env;

Strophe.addNamespace('REACTIONS', 'urn:xmpp:reactions:0');

converse.plugins.add('converse-reactions', {
    dependencies: ['converse-chat', 'converse-muc'],

    /**
     * Initializes the headless reactions plugin.
     * Hooks into message parsing to extract reactions, and into
     * getUpdatedMessageAttributes to merge incoming reactions with
     * existing ones on the original message.
     */
    initialize() {
        api.listen.on('parseMessage', parseReactionsMessage);
        api.listen.on('parseMUCMessage', parseReactionsMessage);

        /**
         * This hook handler merges the incoming single-JID reactions
         * with all existing reactions from other JIDs, so that no
         * reactions are lost when the message is saved.
         */
        api.listen.on('getUpdatedMessageAttributes', (message, attrs) => {
            if (!attrs.reactions) {
                return attrs;
            }

            const existing_reactions = message.get('reactions') || {};
            const merged = { ...existing_reactions, ...attrs.reactions };

            for (const jid in merged) {
                if (!merged[jid]?.length) {
                    delete merged[jid];
                }
            }

            return { ...attrs, reactions: merged };
        });
    },
});
