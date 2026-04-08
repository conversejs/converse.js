/**
 * @module converse-reactions
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description XEP-0444: Message Reactions - Headless core logic
 */

import converse from '../../shared/api/public.js';
import api from '../../shared/api/index.js';
import _converse from '../../shared/_converse.js';
import { parseReactionsMessage } from './parsers.js';
import {
    getDuplicateMessageQueries,
    getErrorAttributesForMessage,
    getUpdatedMessageAttributes,
    onAfterMessageCreated,
    onBeforeMessageCreated,
} from './utils.js';

const { Strophe } = converse.env;

Strophe.addNamespace('REACTIONS', 'urn:xmpp:reactions:0');

converse.plugins.add('converse-reactions', {
    dependencies: ['converse-chat', 'converse-muc', 'converse-pubsub', 'converse-emoji'],

    initialize() {
        api.listen.on('parseMessage', parseReactionsMessage);
        api.listen.on('parseMUCMessage', parseReactionsMessage);

        api.listen.on('getDuplicateMessageQueries', getDuplicateMessageQueries);
        api.listen.on('getUpdatedMessageAttributes', getUpdatedMessageAttributes);
        api.listen.on('getErrorAttributesForMessage', getErrorAttributesForMessage);

        api.listen.on('beforeMessageCreated', onBeforeMessageCreated);
        api.listen.on('afterMessageCreated', onAfterMessageCreated);
    },
});
