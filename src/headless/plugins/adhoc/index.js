import adhoc_api from './api.js';
import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

Strophe.addNamespace('ADHOC', 'http://jabber.org/protocol/commands');


converse.plugins.add('converse-adhoc', {

    dependencies: ["converse-disco"],

    initialize () {
        Object.assign(this._converse.api, adhoc_api);
    }
});
