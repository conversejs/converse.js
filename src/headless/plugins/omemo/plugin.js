import converse from '../../shared/api/public.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import Device from './device.js';
import DeviceList from './devicelist.js';
import DeviceLists from './devicelists.js';
import Devices from './devices.js';
import OMEMOStore from './store.js';
import omemo_api from './api.js';
import { parseEncryptedMessage } from './parsers.js';
import {
    createMessageStanzaHandler,
    encryptFile,
    getOutgoingMessageAttributes,
    initOMEMO,
    onChatInitialized,
    registerPEPPushHandler,
    sendOMEMO2Marker,
    setEncryptedFileURL,
} from './utils.js';

const { u, Strophe } = converse.env;

converse.plugins.add('converse-omemo', {
    dependencies: ['converse-pubsub'],

    /**
     * @param {import('../../shared/_converse.js').ConversePrivateGlobal} _converse
     */
    enabled(_converse) {
        return (
            _converse.state.config.get('trusted') &&
            !_converse.api.settings.get('clear_cache_on_logout') &&
            !_converse.api.settings.get('blacklisted_plugins').includes('converse-omemo')
        );
    },

    initialize() {
        api.settings.extend({ omemo_default: false });
        api.promises.add(['OMEMOInitialized']);

        const exports = {
            Device,
            Devices,
            DeviceList,
            DeviceLists,
            OMEMOStore,
        };

        Object.assign(_converse.api, omemo_api);
        Object.assign(_converse, exports); // DEPRECATED
        Object.assign(_converse.exports, exports);

        api.listen.on('connected', registerPEPPushHandler);
        api.listen.on('createMessageStanza', createMessageStanzaHandler);

        api.listen.on('chatRoomInitialized', onChatInitialized);
        api.listen.on('chatBoxInitialized', onChatInitialized);
        api.listen.on('getOutgoingMessageAttributes', getOutgoingMessageAttributes);

        api.listen.on('statusInitialized', initOMEMO);
        api.listen.on('addClientFeatures', () => {
            api.disco.own.features.add(`${Strophe.NS.OMEMO_DEVICELIST}+notify`);
            api.disco.own.features.add(`${Strophe.NS.OMEMO2_DEVICELIST}+notify`);
        });

        api.listen.on('parseMessage', parseEncryptedMessage);
        api.listen.on('parseMUCMessage', parseEncryptedMessage);

        api.listen.on('sendMarker', async (chatbox, data) => {
            if (!chatbox?.get('omemo_active')) return data;
            await sendOMEMO2Marker(chatbox, data.to_jid, data.id, data.type, data.msg_type).catch(() => {});
            return { ...data, handled: true };
        });

        api.listen.on('afterFileUploaded', setEncryptedFileURL);
        api.listen.on(
            'beforeFileUpload',
            /**
             * @param {import('../../shared/chatbox.js').default} chat
             * @param {File} file
             */
            (chat, file) => (chat.get('omemo_active') ? encryptFile(file) : file),
        );

        api.listen.on('clearSession', () => {
            delete _converse.state.omemo_store;
            if (u.shouldClearCache(_converse)) {
                if (_converse.state.devicelists) {
                    _converse.state.devicelists.clearStore();
                    delete _converse.state.devicelists;
                }
                if (_converse.state.devicelists_v2) {
                    _converse.state.devicelists_v2.clearStore();
                    delete _converse.state.devicelists_v2;
                }
                if (_converse.state.omemo_active_states) {
                    _converse.state.omemo_active_states.storage?.clear();
                }
            }
            // Drop the in-memory reference so it's re-fetched from storage on
            // the next login (keeping the remembered states across re-login,
            // unless the cache was cleared above). See #1472.
            delete _converse.state.omemo_active_states;
        });
    },
});
