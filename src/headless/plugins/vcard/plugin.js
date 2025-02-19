/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "../status/index.js";
import VCard from './vcard.js';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import vcard_api from './api.js';
import VCards from "./vcards";
import {
    clearVCardsSession,
    initVCardCollection,
    onOccupantAvatarChanged,
    setVCardOnMUCMessage,
    setVCardOnModel,
    setVCardOnOccupant,
} from './utils.js';

const { Strophe } = converse.env;


converse.plugins.add('converse-vcard', {

    dependencies: ["converse-status", "converse-roster"],

    initialize () {
        api.promises.add('VCardsInitialized');

        const exports = { VCard, VCards };
        Object.assign(_converse, exports); // XXX DEPRECATED
        Object.assign(_converse.exports, exports);

        api.listen.on('chatRoomInitialized', (m) => {
            setVCardOnModel(m)
            m.occupants.forEach(setVCardOnOccupant);
            m.listenTo(m.occupants, 'add', setVCardOnOccupant);
            m.listenTo(m.occupants, 'change:image_hash', o => onOccupantAvatarChanged(o));
        });

        api.listen.on('chatBoxInitialized', m => setVCardOnModel(m));
        api.listen.on('chatRoomMessageInitialized', m => setVCardOnMUCMessage(m));
        api.listen.on('addClientFeatures', () => api.disco.own.features.add(Strophe.NS.VCARD));
        api.listen.on('clearSession', () => clearVCardsSession());
        api.listen.on('messageInitialized', m => setVCardOnModel(m));
        api.listen.on('rosterContactInitialized', m => setVCardOnModel(m));
        api.listen.on('statusInitialized', initVCardCollection);

        Object.assign(_converse.api, vcard_api);
    }
});
