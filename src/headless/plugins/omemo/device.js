import log from '@converse/log';
import _converse from '../../shared/_converse.js';
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';
import { IQError } from '../../shared/errors.js';
import { UNDECIDED } from './constants.js';
import { parseBundle, parseBundleV2 } from './parsers.js';
import { OMEMOVersionAwareModel } from './profiles.js';

const { Strophe, sizzle, stx, u } = converse.env;

/**
 * @extends {OMEMOVersionAwareModel<import('./types').DeviceAttributes>}
 */
class Device extends OMEMOVersionAwareModel {
    defaults() {
        return {
            trusted: UNDECIDED,
            active: true,
        };
    }

    /**
     * @returns {import('./types').CounterpartyPreKey}
     */
    getRandomPreKey() {
        // XXX: assumes that the bundle has already been fetched
        const bundle = this.get('bundle');
        return bundle.prekeys[u.getRandomInt(bundle.prekeys.length)];
    }

    /**
     * Fetch the device's OMEMO bundle from the server.
     * A bundle is a collection of publicly accessible data that can
     * be used to build a session with a device, namely its public IdentityKey,
     * a signed PreKey with corresponding signature, and a list of (single use) PreKeys.
     * @returns {Promise<import('./types').Bundle>}
     */
    async fetchBundleFromServer() {
        const bare_jid = _converse.session.get('bare_jid');
        const device_id = this.get('id');
        const is_v2 = this.isV2();
        const bundle_xmlns = is_v2 ? Strophe.NS.OMEMO2 : Strophe.NS.OMEMO;

        // omemo:2 keeps all bundles in the single `urn:xmpp:omemo:2:bundles` node,
        // addressed by item id = device id; legacy 0.3.0 uses a per-device node.
        const bundle_node = is_v2 ? Strophe.NS.OMEMO2_BUNDLES : `${Strophe.NS.OMEMO_BUNDLES}:${device_id}`;
        const items_el = is_v2
            ? stx`<items node="${bundle_node}"><item id="${device_id}"/></items>`
            : stx`<items node="${bundle_node}"/>`;

        const stanza = stx`
            <iq type="get" from="${bare_jid}" to="${this.get('jid')}" xmlns="jabber:client">
                <pubsub xmlns="${Strophe.NS.PUBSUB}">${items_el}</pubsub>
            </iq>`;

        let iq;
        try {
            iq = await api.sendIQ(stanza);
        } catch (iq) {
            log.error(`Could not fetch bundle for device ${device_id} from ${this.get('jid')}`);
            log.error(iq);
            if (iq && iq.querySelector('error')) {
                throw new IQError('Could not fetch bundle', iq);
            }
            return null;
        }
        if (iq.querySelector('error')) {
            throw new IQError('Could not fetch bundle', iq);
        }

        const publish_el = sizzle(`items[node="${bundle_node}"]`, iq).pop();
        const bundle_el = sizzle(`bundle[xmlns="${bundle_xmlns}"]`, publish_el).pop();
        if (!bundle_el) {
            // The IQ resolved as type="result" but carries no <bundle>.
            // A stale/orphaned device with no published bundle can produce this.
            // Throw a benign, non-actionable IQError so the caller skips this device.
            log.warn(`No OMEMO bundle published for device ${device_id} of ${this.get('jid')}`);
            throw new IQError('Could not fetch bundle', iq);
        }
        const bundle = is_v2 ? parseBundleV2(bundle_el) : parseBundle(bundle_el);
        this.save('bundle', bundle);
        return bundle;
    }

    /**
     * Fetch and save the bundle information associated with
     * this device, if the information is not cached already.
     * @returns {Promise<import('./types').Bundle>}
     */
    getBundle() {
        if (this.get('bundle')) {
            return Promise.resolve(this.get('bundle'));
        } else {
            return this.fetchBundleFromServer();
        }
    }
}

export default Device;
