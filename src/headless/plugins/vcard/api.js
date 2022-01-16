import log from "@converse/headless/log";
import { _converse, api, converse } from "../../core.js";
import { createStanza, getVCard } from './utils.js';

const { dayjs, u } = converse.env;

export default {
    /**
     * The XEP-0054 VCard API
     *
     * This API lets you access and update user VCards
     *
     * @namespace _converse.api.vcard
     * @memberOf _converse.api
     */
    vcard: {
        /**
         * Enables setting new values for a VCard.
         *
         * Sends out an IQ stanza to set the user's VCard and if
         * successful, it updates the {@link _converse.VCard}
         * for the passed in JID.
         *
         * @method _converse.api.vcard.set
         * @param {string} jid The JID for which the VCard should be set
         * @param {object} data A map of VCard keys and values
         * @example
         * let jid = _converse.bare_jid;
         * _converse.api.vcard.set( jid, {
         *     'fn': 'John Doe',
         *     'nickname': 'jdoe'
         * }).then(() => {
         *     // Succes
         * }).catch((e) => {
         *     // Failure, e is your error object
         * }).
         */
        async set (jid, data) {
            if (!jid) {
                throw Error("No jid provided for the VCard data");
            }
            const div = document.createElement('div');
            const vcard_el = u.toStanza(`
                <vCard xmlns="vcard-temp">
                    <FN>${data.fn}</FN>
                    <NICKNAME>${data.nickname}</NICKNAME>
                    <URL>${data.url}</URL>
                    <ROLE>${data.role}</ROLE>
                    <EMAIL><INTERNET/><PREF/><USERID>${data.email}</USERID></EMAIL>
                    <PHOTO>
                        <TYPE>${data.image_type}</TYPE>
                        <BINVAL>${data.image}</BINVAL>
                    </PHOTO>
                </vCard>`, div);
            let result;
            try {
                result = await api.sendIQ(createStanza("set", jid, vcard_el));
            } catch (e) {
                throw (e);
            }
            await api.vcard.update(jid, true);
            return result;
        },

        /**
         * @method _converse.api.vcard.get
         * @param {Model|string} model Either a `Model` instance, or a string JID.
         *     If a `Model` instance is passed in, then it must have either a `jid`
         *     attribute or a `muc_jid` attribute.
         * @param {boolean} [force] A boolean indicating whether the vcard should be
         *     fetched even if it's been fetched before.
         * @returns {promise} A Promise which resolves with the VCard data for a particular JID or for
         *     a `Model` instance which represents an entity with a JID (such as a roster contact,
         *     chat or chatroom occupant).
         *
         * @example
         * const { api } = _converse;
         * api.waitUntil('rosterContactsFetched').then(() => {
         *     api.vcard.get('someone@example.org').then(
         *         (vcard) => {
         *             // Do something with the vcard...
         *         }
         *     );
         * });
         */
         get (model, force) {
            if (typeof model === 'string') {
                return getVCard(model);
            }
            const error_date = model.get('vcard_error');
            const already_tried_today = error_date && dayjs(error_date).isSame(new Date(), "day");
            if (force || !model.get('vcard_updated') && !already_tried_today) {
                const jid = model.get('jid');
                if (!jid) {
                    log.error("No JID to get vcard for");
                }
                return getVCard(jid);
            } else {
                return Promise.resolve({});
            }
        },

        /**
         * Fetches the VCard associated with a particular `Model` instance
         * (by using its `jid` or `muc_jid` attribute) and then updates the model with the
         * returned VCard data.
         *
         * @method _converse.api.vcard.update
         * @param {Model} model A `Model` instance
         * @param {boolean} [force] A boolean indicating whether the vcard should be
         *     fetched again even if it's been fetched before.
         * @returns {promise} A promise which resolves once the update has completed.
         * @example
         * const { api } = _converse;
         * api.waitUntil('rosterContactsFetched').then(async () => {
         *     const chatbox = await api.chats.get('someone@example.org');
         *     api.vcard.update(chatbox);
         * });
         */
        async update (model, force) {
            const data = await this.get(model, force);
            model = typeof model === 'string' ? _converse.vcards.findWhere({'jid': model}) : model;
            if (!model) {
                log.error(`Could not find a VCard model for ${model}`);
                return;
            }
            delete data['stanza']
            model.save(data);
        }
    }
}
