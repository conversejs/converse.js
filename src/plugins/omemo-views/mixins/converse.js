import { generateFingerprint, getDevicesForContact, } from '../utils.js';


const ConverseMixins = {

    async generateFingerprints (jid) {
        const devices = await getDevicesForContact(jid);
        return Promise.all(devices.map(d => generateFingerprint(d)));
    },

    getDeviceForContact (jid, device_id) {
        return getDevicesForContact(jid).then(devices => devices.get(device_id));
    },

    async contactHasOMEMOSupport (jid) {
        /* Checks whether the contact advertises any OMEMO-compatible devices. */
        const devices = await getDevicesForContact(jid);
        return devices.length > 0;
    }
}

export default ConverseMixins;
