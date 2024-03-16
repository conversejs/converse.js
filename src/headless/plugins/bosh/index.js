/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Converse.js plugin which add support for XEP-0206: XMPP Over BOSH
 */
import 'strophe.js/src/bosh';
import { Strophe } from "strophe.js";
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import bosh_api from './api.js';
import { attemptPrebind, clearSession, saveJIDToSession} from './utils.js';


converse.plugins.add('converse-bosh', {

    enabled () {
        return !_converse.api.settings.get("blacklisted_plugins").includes('converse-bosh');
    },

    initialize () {
        api.settings.extend({
            bosh_service_url: undefined,
            prebind_url: null
        });

        Object.assign(api, bosh_api);

        api.listen.on('clearSession', clearSession);
        api.listen.on('setUserJID', saveJIDToSession);
        api.listen.on('login', attemptPrebind);
        api.listen.on('addClientFeatures',
            () => api.disco.own.features.add(Strophe.NS.BOSH)
        );
    }
});
