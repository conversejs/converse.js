/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import _converse from './shared/_converse';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import connection_api from './shared/connection/api.js';
import dayjs from 'dayjs';
import i18n from './shared/i18n';
import pluggable from 'pluggable.js/src/pluggable.js';
import { Model } from '@converse/skeletor/src/model.js';
import { Strophe } from 'strophe.js/src/strophe';
import { settings_api } from './shared/settings/api.js';
import send_api from './shared/api/send.js';
import user_api from './shared/api/user.js';
import events_api from './shared/api/events.js';
import promise_api from './shared/api/promise.js';

export { converse } from './shared/api/public.js';

export { _converse };
export { i18n };


dayjs.extend(advancedFormat);

// Add Strophe Namespaces
Strophe.addNamespace('ACTIVITY', 'http://jabber.org/protocol/activity');
Strophe.addNamespace('CARBONS', 'urn:xmpp:carbons:2');
Strophe.addNamespace('CHATSTATES', 'http://jabber.org/protocol/chatstates');
Strophe.addNamespace('CSI', 'urn:xmpp:csi:0');
Strophe.addNamespace('DELAY', 'urn:xmpp:delay');
Strophe.addNamespace('EME', 'urn:xmpp:eme:0');
Strophe.addNamespace('FASTEN', 'urn:xmpp:fasten:0');
Strophe.addNamespace('FORWARD', 'urn:xmpp:forward:0');
Strophe.addNamespace('HINTS', 'urn:xmpp:hints');
Strophe.addNamespace('HTTPUPLOAD', 'urn:xmpp:http:upload:0');
Strophe.addNamespace('MAM', 'urn:xmpp:mam:2');
Strophe.addNamespace('MARKERS', 'urn:xmpp:chat-markers:0');
Strophe.addNamespace('MENTIONS', 'urn:xmpp:mmn:0');
Strophe.addNamespace('MESSAGE_CORRECT', 'urn:xmpp:message-correct:0');
Strophe.addNamespace('MODERATE', 'urn:xmpp:message-moderate:0');
Strophe.addNamespace('NICK', 'http://jabber.org/protocol/nick');
Strophe.addNamespace('OCCUPANTID', 'urn:xmpp:occupant-id:0');
Strophe.addNamespace('OMEMO', 'eu.siacs.conversations.axolotl');
Strophe.addNamespace('OUTOFBAND', 'jabber:x:oob');
Strophe.addNamespace('PUBSUB', 'http://jabber.org/protocol/pubsub');
Strophe.addNamespace('RAI', 'urn:xmpp:rai:0');
Strophe.addNamespace('RECEIPTS', 'urn:xmpp:receipts');
Strophe.addNamespace('REFERENCE', 'urn:xmpp:reference:0');
Strophe.addNamespace('REGISTER', 'jabber:iq:register');
Strophe.addNamespace('RETRACT', 'urn:xmpp:message-retract:0');
Strophe.addNamespace('ROSTERX', 'http://jabber.org/protocol/rosterx');
Strophe.addNamespace('RSM', 'http://jabber.org/protocol/rsm');
Strophe.addNamespace('SID', 'urn:xmpp:sid:0');
Strophe.addNamespace('SPOILER', 'urn:xmpp:spoiler:0');
Strophe.addNamespace('STANZAS', 'urn:ietf:params:xml:ns:xmpp-stanzas');
Strophe.addNamespace('STYLING', 'urn:xmpp:styling:0');
Strophe.addNamespace('VCARD', 'vcard-temp');
Strophe.addNamespace('VCARDUPDATE', 'vcard-temp:x:update');
Strophe.addNamespace('XFORM', 'jabber:x:data');
Strophe.addNamespace('XHTML', 'http://www.w3.org/1999/xhtml');

_converse.VERSION_NAME = "v10.1.2";

// Make converse pluggable
pluggable.enable(_converse, '_converse', 'pluggable');


/**
 * ### The private API
 *
 * The private API methods are only accessible via the closured {@link _converse}
 * object, which is only available to plugins.
 *
 * These methods are kept private (i.e. not global) because they may return
 * sensitive data which should be kept off-limits to other 3rd-party scripts
 * that might be running in the page.
 *
 * @namespace _converse.api
 * @memberOf _converse
 */
export const api = _converse.api = {
    connection: connection_api,
    settings: settings_api,
    ...send_api,
    ...user_api,
    ...events_api,
    ...promise_api,
};


_converse.shouldClearCache = () => (
    !_converse.config.get('trusted') ||
    api.settings.get('clear_cache_on_logout') ||
    _converse.isTestEnv()
);


_converse.ConnectionFeedback = Model.extend({
    defaults: {
        'connection_status': Strophe.Status.DISCONNECTED,
        'message': ''
    },
    initialize () {
        this.on('change', () => api.trigger('connfeedback', _converse.connfeedback));
    }
});
