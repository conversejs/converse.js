/**
 * @description
 * Converse.js plugin which adds support for XEP-0191: Blocking
 * Allows users to block other users, which hides their messages.
 */
import blocking_api from './api.js';
import { _converse, api, converse } from '@converse/headless/core.js';
import { onConnected } from './utils.js';
import { Model } from '@converse/skeletor/src/model.js';

const { Strophe } = converse.env;

const SetModel = Model.extend({
    defaults: {
        'set': new Set(),
        'len': 0,
    },
});

Strophe.addNamespace('BLOCKING', 'urn:xmpp:blocking');

converse.plugins.add('converse-blocking', {
    dependencies: ['converse-disco'],

    enabled () {
        return !api.settings.get('blacklisted_plugins').includes('converse-blocking');
    },

    initialize () {
        _converse.blocked = new SetModel();
        Object.assign(api, blocking_api);

        api.listen.on('discoInitialized', onConnected);
        api.listen.on('reconnected', onConnected);
    },
});
