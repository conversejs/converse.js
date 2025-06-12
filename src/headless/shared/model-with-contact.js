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
         * @typedef {import('../plugins/roster/contact').default} RosterContact
         * @typedef {import('./_converse.js').Profile} Profile
         */

        initialize() {
            super.initialize();
            this.rosterContactAdded = getOpenPromise();
            this.onClosedChanged = () => this.setModelContact(this.get('jid'));
            /**
             * @public
             * @type {RosterContact|Profile}
             */
            this.contact = null;
        }


        /**
         * @param {string} jid
         */
        async setModelContact(jid) {
            if (this.contact?.get('jid') === jid) return;

            if (this.get('closed')) {
                this.off('change:closed', this.onClosedChanged);
                this.on('change:closed', this.onClosedChanged);
                return;
            }

            const { session, state } = _converse;

            let contact;
            if (Strophe.getBareJidFromJid(jid) === session.get('bare_jid')) {
                contact = state.profile;
            } else {
                contact = await api.contacts.get(jid);
                if (!contact && !(await api.blocklist.get()).get(jid)) {
                    contact = await api.contacts.add({ jid }, false, false);
                }
            }

            if (contact) {
                this.contact = contact;
                this.set('nickname', contact.get('nickname'));

                this.listenTo(this.contact, 'vcard:add', (changed) => {
                    this.trigger('contact:change', changed);
                });

                this.listenTo(this.contact, 'vcard:change', (changed) => {
                    this.trigger('contact:change', changed);
                });

                this.listenTo(this.contact, 'change', (changed) => {
                    if (changed.nickname) {
                        this.set('nickname', changed.nickname);
                    }
                    this.trigger('contact:change', changed);
                });

                this.listenTo(this.contact, 'destroy', () => {
                    delete this.contact;
                    this.trigger('contact:destroy');
                });

                this.rosterContactAdded.resolve();
                this.trigger('contact:add', this.contact);
            }
        }
    };
}
