/**
 * @module converse-headless-reactions
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description XEP-0444: Message Reactions - Headless core logic
 */

import converse from '../../shared/api/public.js';
import api from '../../shared/api/index.js';
import { parseReactionsMessage } from './parsers.js';

const { Strophe } = converse.env;

converse.plugins.add('converse-headless-reactions', {
    dependencies: ['converse-chat', 'converse-muc'],

    /**
     * Initializes the headless reactions plugin
     * Hooks into message parsing to extract and store reactions
     */
    initialize() {
        // Register namespace
        Strophe.addNamespace('REACTIONS', 'urn:xmpp:reactions:0');

        // Hook into message parsing for 1:1 chats and MUCs
        // This runs when messages are received/parsed
        api.listen.on('parseMessage', parseReactionsMessage);
        api.listen.on('parseMUCMessage', parseReactionsMessage);
    }
});
