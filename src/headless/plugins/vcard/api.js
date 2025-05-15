/**
 * @typedef {import('@converse/skeletor').Model} Model
 */
import log from "@converse/log";
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from "../../shared/api/public.js";
import { createStanza, fetchVCard } from './utils.js';

const { Strophe, dayjs, u, stx } = converse.env;

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
         * @param {import("./types").VCardData} data A map of VCard keys and values
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
            if (!jid) throw Error("No jid provided for the VCard data");
            debugger;
            api.waitUntil('VCardsInitialized');

            let vcard = _converse.state.vcards.get(jid);
            const old_vcard_attrs = vcard?.attributes ?? null;
            if (vcard && old_vcard_attrs.image !== data.image) {
                // Optimistically update the vcard with image data. Otherwise some servers (e.g. Ejabberd)
                // could send a XEP-0153 vcard:update presence which would cause us to refetch the vcard again.
                const buffer = u.base64ToArrayBuffer(data.image);
                const hash_ab = await crypto.subtle.digest('SHA-1', buffer);
                vcard.save({
                    image: data.image,
                    image_type: data.image_type,
                    image_hash: u.arrayBufferToHex(hash_ab),
                });
            }

            let result;
            const vcard_el = stx`
                <vCard xmlns="vcard-temp">
                    <FN>${data.fn ?? ''}</FN>
                    <NICKNAME>${data.nickname ?? ''}</NICKNAME>
                    <URL>${data.url ?? ''}</URL>
                    <ROLE>${data.role ?? ''}</ROLE>
                    <EMAIL><INTERNET/><PREF/><USERID>${data.email ?? ''}</USERID></EMAIL>
                    <PHOTO>
                        <TYPE>${data.image_type ?? ''}</TYPE>
                        <BINVAL>${data.image ?? ''}</BINVAL>
                    </PHOTO>
                </vCard>`;
            try {
                result = await api.sendIQ(createStanza("set", jid, vcard_el));
            } catch (e) {
                if (old_vcard_attrs) vcard.save(old_vcard_attrs);
                throw (e);
            }

            vcard = await api.vcard.update(jid, true);
            if (u.isOwnJID(jid)) {
                // Send out a XEP-0153 presence with the image hash
                const node = stx`<x xmlns="${Strophe.NS.VCARD_UPDATE}">
                    <photo>${vcard.get('image_hash') ?? ''}</photo>
                </x>`;
                api.user.presence.send({}, node);
            }
            return result;
        },

        /**
         * @method _converse.api.vcard.get
         * @param {Model|string} model Either a `Model` instance, or a string JID.
         *     If a `Model` instance is passed in, then it must have either a `jid`
         *     attribute or a `muc_jid` attribute.
         * @param {boolean} [force] A boolean indicating whether the vcard should be
         *     fetched from the server even if it's been fetched before.
         * @returns {Promise<import("./types").VCardResult|null>} A Promise which resolves
         *     with the VCard data for a particular JID or for a `Model` instance which
         *     represents an entity with a JID (such as a roster contact, chat or chatroom occupant).
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
        async get(model, force) {
            api.waitUntil("VCardsInitialized");

            if (typeof model === "string") return fetchVCard(model);

            const error_date = model.get("vcard_error");
            if (error_date) {
                // For a VCard fetch that returned an error, we check how long ago
                // it was fetched. If it was longer ago than the last 21 days plus
                // some jitter (to prevent an IQ fetch flood), we try again.
                const { random, round } = Math;
                const subtract_flag = round(random());
                const recent_date = dayjs()
                    .subtract(21, "days")
                    .subtract(round(random() * 24) * subtract_flag, "hours")
                    .add(round(random() * 24) * (!subtract_flag ? 1 : 0), "hours");

                const tried_recently = dayjs(error_date).isAfter(recent_date);
                if (!force && tried_recently) return null;
            }

            const vcard_updated = model.get("vcard_updated");
            if (vcard_updated) {
                // For a successful VCard fetch, we check how long ago it was fetched.
                // If it was longer ago than the last 7 days plus some jitter
                // (to prevent an IQ fetch flood), we try again.
                const { random, round } = Math;
                const subtract_flag = round(random());
                const recent_date = dayjs()
                    .subtract(7, "days")
                    .subtract(round(random() * 24) * subtract_flag, "hours")
                    .add(round(random() * 24) * (!subtract_flag ? 1 : 0), "hours");
                const updated_recently = dayjs(vcard_updated).isAfter(recent_date);
                if (!force && updated_recently) return null;
            }

            const jid = model.get("jid");
            if (!jid) {
                log.error("No JID to get vcard for");
                return null;
            }
            return fetchVCard(jid);
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
            api.waitUntil('VCardsInitialized');
            const data = await this.get(model, force);
            if (data === null) {
                log.debug('api.vcard.update: null data returned, not updating the vcard');
                return;
            }
            model = typeof model === 'string' ? _converse.state.vcards.get(model) : model;
            if (!model) {
                log.error(`Could not find a VCard model for ${model}`);
                return;
            }
            if (Object.keys(data).length) {
                delete data['stanza']
                u.safeSave(model, data);
            }
            return model;
        }
    }
}
