import { getOpenPromise } from '@converse/openpromise';
import { Strophe } from 'strophe.js';
import _converse from './_converse.js';
import api from './api/index.js';

/**
 * @template {import('./types').ModelExtender} T
 * @param {T} BaseModel
 */
export default function ModelWithContact(BaseModel) {

    return class ModelWithContact extends BaseModel {
        /**
        * @typedef {import('../plugins/vcard/vcard').default} VCard
        * @typedef {import('../plugins/roster/contact').default} RosterContact
        * @typedef {import('./_converse.js').XMPPStatus} XMPPStatus
        */

        initialize() {
            super.initialize();
            this.rosterContactAdded = getOpenPromise();
            /**
            * @public
            * @type {RosterContact|XMPPStatus}
            */
            this.contact = null;

            /**
            * @public
            * @type {VCard}
            */
            this.vcard = null;
        }

        /**
        * @param {string} jid
        */
        async setModelContact(jid) {
            if (this.contact?.get('jid') === jid) return;

            if (Strophe.getBareJidFromJid(jid) === _converse.session.get('bare_jid')) {
                this.contact = _converse.state.xmppstatus;
            } else {
                const contact = await api.contacts.get(jid);
                if (contact) {
                    this.contact = contact;
                    this.set('nickname', contact.get('nickname'));
                }
            }

            this.listenTo(this.contact, 'change', (changed) => {
                if (changed.nickname) {
                    this.set('nickname', changed.nickname);
                }
                this.trigger('contact:change', changed);
            });

            this.rosterContactAdded.resolve();
            this.trigger('contactAdded', this.contact);
        }
    }
}
