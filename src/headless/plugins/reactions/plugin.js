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
        api.listen.on('getUpdatedMessageAttributes', (message, attrs, original_attrs) => {
            const incoming_reactions = original_attrs?.reactions;
            if (!incoming_reactions) {
                return attrs;
            }

            const reactions = message.get('reactions') || {};

            for (const jid in incoming_reactions) {
                if (incoming_reactions[jid]?.length) {
                    reactions[jid] = incoming_reactions[jid];
                } else {
                    delete reactions[jid];
                }
            }
            return { ...attrs, ...{ reactions } };
        });

        api.listen.on('getErrorAttributesForMessage', (message, new_attrs, attrs) => {
            if (attrs.reaction_to_id) {
                const my_jid = Strophe.getBareJidFromJid(api.connection.get().jid);
                const reactions = { ...message.get('reactions') };
                delete reactions[my_jid];
                new_attrs.reactions = reactions;
            }
            return new_attrs;
        });
    },
});
