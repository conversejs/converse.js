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
    clearSession,
    getDuplicateMessageQueries,
    getErrorAttributesForMessage,
    getUpdatedMessageAttributes,
    onAfterMessageCreated,
    onBeforeMessageCreated,
    registerPEPPushHandler,
} from './utils.js';
import PopularReactions from './popular-model.js';

const { Strophe } = converse.env;

Strophe.addNamespace('REACTIONS', 'urn:xmpp:reactions:0');
Strophe.addNamespace('REACTIONS_POPULAR', 'urn:xmpp:reactions:popular:0');

converse.plugins.add('converse-reactions', {
    dependencies: ['converse-chat', 'converse-muc', 'converse-pubsub'],

    initialize() {
        api.listen.on('parseMessage', parseReactionsMessage);
        api.listen.on('parseMUCMessage', parseReactionsMessage);

        api.listen.on('connected', () => {
            registerPEPPushHandler();
            if (_converse.state.popular_reactions) {
                return;
            }
            const popular_reactions = new PopularReactions();
            Object.assign(_converse.state, { popular_reactions });
        });

        api.listen.on('clearSession', clearSession);

        api.listen.on('getDuplicateMessageQueries', getDuplicateMessageQueries);
        api.listen.on('getUpdatedMessageAttributes', getUpdatedMessageAttributes);
        api.listen.on('getErrorAttributesForMessage', getErrorAttributesForMessage);

        api.listen.on('beforeMessageCreated', onBeforeMessageCreated);
        api.listen.on('afterMessageCreated', onAfterMessageCreated);
    },
});
