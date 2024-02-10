/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 *
 * @module plugins-omemo-index
 * @typedef {Window & globalThis & {libsignal: any} } WindowWithLibsignal
 */
import './fingerprints.js';
import './profile.js';
import 'shared/modals/user-details.js';
import ConverseMixins from './mixins/converse.js';
import Device from './device.js';
import DeviceList from './devicelist.js';
import DeviceLists from './devicelists.js';
import Devices from './devices.js';
import OMEMOStore from './store.js';
import omemo_api from './api.js';
import { _converse, api, converse, log } from '@converse/headless';
import { shouldClearCache } from '@converse/headless/utils/session.js';
import {
    createOMEMOMessageStanza,
    encryptFile,
    getOMEMOToolbarButton,
    getOutgoingMessageAttributes,
    handleEncryptedFiles,
    handleMessageSendError,
    initOMEMO,
    omemo,
    onChatBoxesInitialized,
    onChatInitialized,
    parseEncryptedMessage,
    registerPEPPushHandler,
    setEncryptedFileURL,
} from './utils.js';

const { Strophe } = converse.env;

converse.env.omemo = omemo;

Strophe.addNamespace('OMEMO_DEVICELIST', Strophe.NS.OMEMO + '.devicelist');
Strophe.addNamespace('OMEMO_VERIFICATION', Strophe.NS.OMEMO + '.verification');
Strophe.addNamespace('OMEMO_WHITELISTED', Strophe.NS.OMEMO + '.whitelisted');
Strophe.addNamespace('OMEMO_BUNDLES', Strophe.NS.OMEMO + '.bundles');


converse.plugins.add('converse-omemo', {
    enabled (_converse) {
        return (
            /** @type WindowWithLibsignal */(window).libsignal &&
            _converse.config.get('trusted') &&
            !api.settings.get('clear_cache_on_logout') &&
            !_converse.api.settings.get('blacklisted_plugins').includes('converse-omemo')
        );
    },

    dependencies: ['converse-chatview', 'converse-pubsub', 'converse-profile'],

    initialize () {
        api.settings.extend({ 'omemo_default': false });
        api.promises.add(['OMEMOInitialized']);

        _converse.NUM_PREKEYS = 100; // Set here so that tests can override

        Object.assign(_converse, ConverseMixins);
        Object.assign(_converse.api, omemo_api);

        _converse.OMEMOStore = OMEMOStore;
        _converse.Device = Device;
        _converse.Devices = Devices;
        _converse.DeviceList = DeviceList;
        _converse.DeviceLists = DeviceLists;

        /******************** Event Handlers ********************/
        api.waitUntil('chatBoxesInitialized').then(onChatBoxesInitialized);

        api.listen.on('getOutgoingMessageAttributes', getOutgoingMessageAttributes);

        api.listen.on('createMessageStanza', async (chat, data) => {
            try {
                data = await createOMEMOMessageStanza(chat, data);
            } catch (e) {
                handleMessageSendError(e, chat);
            }
            return data;
        });

        api.listen.on('afterFileUploaded', (msg, attrs) => msg.file.xep454_ivkey ? setEncryptedFileURL(msg, attrs) : attrs);
        api.listen.on('beforeFileUpload', (chat, file) => chat.get('omemo_active') ? encryptFile(file) : file);

        api.listen.on('parseMessage', parseEncryptedMessage);
        api.listen.on('parseMUCMessage', parseEncryptedMessage);

        api.listen.on('chatBoxViewInitialized', onChatInitialized);
        api.listen.on('chatRoomViewInitialized', onChatInitialized);

        api.listen.on('connected', registerPEPPushHandler);
        api.listen.on('getToolbarButtons', getOMEMOToolbarButton);

        api.listen.on('statusInitialized', initOMEMO);
        api.listen.on('addClientFeatures', () => api.disco.own.features.add(`${Strophe.NS.OMEMO_DEVICELIST}+notify`));

        api.listen.on('afterMessageBodyTransformed', handleEncryptedFiles);

        api.listen.on('userDetailsModalInitialized', contact => {
            const jid = contact.get('jid');
            _converse.generateFingerprints(jid).catch(e => log.error(e));
        });

        api.listen.on('profileModalInitialized', () => {
            _converse.generateFingerprints(_converse.bare_jid).catch(e => log.error(e));
        });

        api.listen.on('clearSession', () => {
            delete _converse.omemo_store
            if (shouldClearCache() && _converse.devicelists) {
                _converse.devicelists.clearStore();
                delete _converse.devicelists;
            }
        });
    }
});
