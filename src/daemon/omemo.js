/**
 * OMEMO (XEP-0384) as the daemon shows it: which devices a conversation's
 * people have, and how far each is trusted. Reading is open to every access
 * level. Changing trust is the user's alone, so it's full access only.
 *
 * The daemon is an OMEMO device of its own. Its keys live in headless's
 * store, which persists them with the rest of the account's state, so it keeps
 * its identity across restarts. Encryption itself is headless's: a send to a
 * conversation with OMEMO on is encrypted, or it fails.
 * @module @converse/daemon/omemo
 */
import { api, constants, u } from '@converse/headless';
import { ERRORS, RPCError } from './protocol.js';
import { resolveJID } from './resolve.js';

const { TRUSTED, UNDECIDED, UNTRUSTED } = constants;

/** How a device's trust is named in the protocol, by headless's value for it. */
const TRUST_NAMES = { [TRUSTED]: 'trusted', [UNTRUSTED]: 'untrusted', [UNDECIDED]: 'undecided' };

/** The reverse of {@link TRUST_NAMES}, for a trust state the client asks for. */
const TRUST_VALUES = { trusted: TRUSTED, untrusted: UNTRUSTED, undecided: UNDECIDED };

/**
 * @param {import('@converse/headless').ConversePrivateGlobal} _converse
 */
export function omemoMethods(_converse) {
    const ownJID = () => _converse.session.get('bare_jid');

    return {
        /**
         * The OMEMO devices of a conversation's people, or of ours when given the
         * account's own JID, with each one's trust. The daemon's own device is
         * marked `this_device`.
         * @param {Object} params
         * @param {string} params.conversation - A JID, or a contact's name
         * @returns {Promise<import('./types').DeviceList>}
         */
        async 'omemo.devices.list'({ conversation }) {
            const jid = await resolveJID(_converse, conversation, 'conversation');
            const own_id = await ready();
            const list = await api.omemo.devicelists.get(jid, true);
            const own = jid === ownJID();
            const devices = await Promise.all(
                list.devices.models.map((device) => toDeviceDTO(device, { own, own_id })),
            );
            const chat = own ? null : await api.chats.get(jid);
            return {
                conversation: jid,
                encrypted: !!chat?.get('omemo_active'),
                devices,
            };
        },

        /**
         * Sets how far one of a conversation's devices is trusted. Full access
         * only: a restricted client can see trust but never change it.
         * @param {Object} params
         * @param {string} params.conversation - A JID, or a contact's name
         * @param {string} params.device - The device's id, as `omemo.devices.list` gives it
         * @param {'trusted'|'untrusted'|'undecided'} params.trust
         * @returns {Promise<import('./types').DeviceDTO>}
         */
        async 'omemo.devices.trust'({ conversation, device, trust }) {
            const jid = await resolveJID(_converse, conversation, 'conversation');
            if (!Object.hasOwn(TRUST_VALUES, trust)) {
                throw new RPCError(ERRORS.INVALID_PARAMS, '"trust" must be "trusted", "untrusted" or "undecided".');
            }
            const own_id = await ready();
            const list = await api.omemo.devicelists.get(jid, true);
            const model = list.devices.models.find((d) => String(d.get('id')) === String(device));
            if (!model) {
                throw new RPCError(
                    ERRORS.NOT_FOUND,
                    `${jid} has no OMEMO device ${JSON.stringify(String(device))}. ` +
                        'List their devices with "omemo.devices.list", then try again.',
                );
            }
            model.save('trusted', TRUST_VALUES[trust]);
            return toDeviceDTO(model, { own: jid === ownJID(), own_id });
        },
    };

    /**
     * Waits until OMEMO is set up for the account, and returns the daemon's own device id.
     * @returns {Promise<string>}
     */
    async function ready() {
        if (!api.connection.connected()) {
            throw new RPCError(
                ERRORS.NOT_CONNECTED,
                "The daemon isn't connected to the server, so OMEMO devices can't be read. " +
                    'Check "daemon.status", then try again.',
            );
        }
        if (!api.omemo) {
            throw new RPCError(ERRORS.INTERNAL_ERROR, "OMEMO isn't available in this daemon.");
        }
        await api.waitUntil('OMEMOInitialized');
        return String(_converse.state.omemo_store.get('device_id'));
    }
}

/**
 * @param {import('@converse/headless').Device} device
 * @param {Object} context
 * @param {boolean} context.own - Whether the device belongs to the account
 * @param {string} context.own_id - The daemon's own device id
 * @returns {Promise<import('./types').DeviceDTO>}
 */
async function toDeviceDTO(device, { own, own_id }) {
    const id = String(device.get('id'));
    return {
        id,
        this_device: own && id === own_id,
        active: device.get('active') !== false,
        trust: TRUST_NAMES[device.get('trusted')] ?? 'undecided',
        fingerprint: await fingerprintOf(device),
    };
}

/**
 * The device's identity key as hex, which is how people compare fingerprints.
 * A device whose bundle can't be fetched has none yet, so null.
 * @param {import('@converse/headless').Device} device
 * @returns {Promise<string|null>}
 */
async function fingerprintOf(device) {
    try {
        await u.omemo.generateFingerprint(device);
    } catch {
        return null;
    }
    return device.get('bundle')?.fingerprint ?? null;
}
