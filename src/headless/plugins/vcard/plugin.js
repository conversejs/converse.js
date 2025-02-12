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

    // Overrides mentioned here will be picked up by converse.js's
    // plugin architecture they will replace existing methods on the
    // relevant objects or classes.
    // New functions which don't exist yet can also be added.
    overrides: {
        XMPPStatus: {
            getNickname () {
                const { _converse } = this.__super__;
                const { xmppstatus } = _converse.state;
                const nick = this.__super__.getNickname.apply(this);
                if (!nick && xmppstatus?.vcard) {
                    return xmppstatus.vcard.get('nickname');
                } else {
                    return nick;
                }
            },

            getFullname () {
                const { _converse } = this.__super__;
                const { xmppstatus } = _converse.state;
                const fullname = this.__super__.getFullname.apply(this);
                if (!fullname && xmppstatus?.vcard) {
                    return xmppstatus.vcard.get('fullname');
                } else {
                    return fullname;
                }
            }
        },

        RosterContact: {
            getDisplayName () {
                if (!this.get('nickname') && this.vcard) {
                    return this.vcard.getDisplayName();
                } else {
                    return this.__super__.getDisplayName.apply(this);
                }
            },
            getFullname () {
                if (this.vcard) {
                    return this.vcard.get('fullname');
                } else {
                    return this.__super__.getFullname.apply(this);
                }
            }
        }
    },

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
