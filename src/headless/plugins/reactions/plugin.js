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

            const reactions = { ...(message.get('reactions') || {}) };

            for (const jid in incoming_reactions) {
                if (incoming_reactions[jid]?.length) {
                    reactions[jid] = incoming_reactions[jid];
                } else {
                    delete reactions[jid];
                }
            }
            return { ...attrs, reactions };
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

        /**
         * When a reaction stanza arrives for a message that isn't in local
         * state yet (e.g. during MAM catch-up where messages arrive out of
         * order), store it as a dangling reaction so it can be applied once
         * the original message arrives.
         */
        api.listen.on('beforeMessageCreated', (chatbox, attrs, data) => {
            if (!attrs.reaction_to_id) return data;

            // If the target message already exists, the normal getDuplicateMessage
            // flow will have matched it and updateMessage will be called instead
            // so we only reach here if the target is missing.
            attrs.dangling_reaction = true;
            chatbox.createMessage(attrs);
            return { ...data, handled: true };
        });

        /**
         * When a new message is created, check whether any dangling reactions
         * were waiting for it. If so, merge their reactions onto the new
         * message and destroy the placeholders.
         */
        api.listen.on('afterMessageCreated', async (chatbox, message) => {
            const msgid = message.get('msgid');
            const origin_id = message.get('origin_id');
            if (!msgid && !origin_id) return;

            const danglings = chatbox.messages.models.filter(
                (m) =>
                    m.get('dangling_reaction') &&
                    (m.get('reaction_to_id') === msgid || m.get('reaction_to_id') === origin_id),
            );
            if (!danglings.length) return;

            const reactions = { ...(message.get('reactions') || {}) };
            for (const dangling of danglings) {
                const incoming = dangling.get('reactions') || {};
                for (const jid in incoming) {
                    if (incoming[jid]?.length) {
                        reactions[jid] = incoming[jid];
                    } else {
                        delete reactions[jid];
                    }
                }
                dangling.destroy();
            }
            message.save({ reactions });
        });
    },
});
