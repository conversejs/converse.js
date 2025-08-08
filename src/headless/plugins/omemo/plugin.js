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
    createOMEMOMessageStanza,
    encryptFile,
    getOutgoingMessageAttributes,
    handleMessageSendError,
    initOMEMO,
    onChatInitialized,
    registerPEPPushHandler,
    setEncryptedFileURL,
} from './utils.js';

const { u, Strophe } = converse.env;

converse.plugins.add('converse-omemo', {
    dependencies: ['converse-pubsub', 'converse-profile'],

    /**
     * @param {import('../../shared/_converse.js').ConversePrivateGlobal} _converse
     */
    enabled(_converse) {
        /**
         * @typedef {Window & globalThis & {libsignal: any} } WindowWithLibsignal
         */
        return (
            /** @type WindowWithLibsignal */ (window).libsignal &&
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

        api.listen.on(
            'createMessageStanza',
            /**
             * @param {import('../../shared/chatbox.js').default} chat
             * @param {import('../../shared/types').MessageAndStanza} data
             */
            async (chat, data) => {
                try {
                    data = await createOMEMOMessageStanza(chat, data);
                } catch (e) {
                    handleMessageSendError(e, chat);
                }
                return data;
            }
        );

        api.listen.on('connected', registerPEPPushHandler);

        api.listen.on('chatRoomInitialized', onChatInitialized);
        api.listen.on('chatBoxInitialized', onChatInitialized);
        api.listen.on('getOutgoingMessageAttributes', getOutgoingMessageAttributes);

        api.listen.on('statusInitialized', initOMEMO);
        api.listen.on('addClientFeatures', () => api.disco.own.features.add(`${Strophe.NS.OMEMO_DEVICELIST}+notify`));

        api.listen.on('parseMessage', parseEncryptedMessage);
        api.listen.on('parseMUCMessage', parseEncryptedMessage);

        api.listen.on('afterFileUploaded', setEncryptedFileURL);
        api.listen.on(
            'beforeFileUpload',
            /**
             * @param {import('../../shared/chatbox.js').default} chat
             * @param {File} file
             */
            (chat, file) => (chat.get('omemo_active') ? encryptFile(file) : file)
        );

        api.listen.on('clearSession', () => {
            delete _converse.state.omemo_store;
            if (u.shouldClearCache(_converse) && _converse.state.devicelists) {
                _converse.state.devicelists.clearStore();
                delete _converse.state.devicelists;
            }
        });
    },
});
