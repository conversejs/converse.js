/**
 * @description
 * Converse.js plugin which adds support for querying the software version of
 * an XMPP entity, as specified in XEP-0092: Software Version.
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import version_api from './api.js';

// Strophe already defines `Strophe.NS.VERSION` as 'jabber:iq:version'.

converse.plugins.add('converse-version', {
    initialize() {
        Object.assign(api, version_api);
    },
});
