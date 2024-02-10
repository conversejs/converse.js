import { IQError } from 'shared/errors.js';
import { Model } from '@converse/skeletor';
import { UNDECIDED } from './consts.js';
import { _converse, api, converse, log } from '@converse/headless';
import { getRandomInt } from '@converse/headless/utils/index.js';
import { parseBundle } from './utils.js';

const { Strophe, sizzle, $iq } = converse.env;

/**
 * @namespace _converse.Device
 * @memberOf _converse
 */
class Device extends Model {
    defaults () { // eslint-disable-line class-methods-use-this
        return {
            'trusted': UNDECIDED,
            'active': true
        }
    }

    getRandomPreKey () {
        // XXX: assumes that the bundle has already been fetched
        const bundle = this.get('bundle');
        return bundle.prekeys[getRandomInt(bundle.prekeys.length)];
    }

    async fetchBundleFromServer () {
        const stanza = $iq({
            'type': 'get',
            'from': _converse.bare_jid,
            'to': this.get('jid')
        }).c('pubsub', { 'xmlns': Strophe.NS.PUBSUB })
          .c('items', { 'node': `${Strophe.NS.OMEMO_BUNDLES}:${this.get('id')}` });

        let iq;
        try {
            iq = await api.sendIQ(stanza);
        } catch (iq) {
            log.error(`Could not fetch bundle for device ${this.get('id')} from ${this.get('jid')}`);
            log.error(iq);
            return null;
        }
        if (iq.querySelector('error')) {
            throw new IQError('Could not fetch bundle', iq);
        }
        const publish_el = sizzle(`items[node="${Strophe.NS.OMEMO_BUNDLES}:${this.get('id')}"]`, iq).pop();
        const bundle_el = sizzle(`bundle[xmlns="${Strophe.NS.OMEMO}"]`, publish_el).pop();
        const bundle = parseBundle(bundle_el);
        this.save('bundle', bundle);
        return bundle;
    }

    /**
     * Fetch and save the bundle information associated with
     * this device, if the information is not cached already.
     * @method _converse.Device#getBundle
     */
    getBundle () {
        if (this.get('bundle')) {
            return Promise.resolve(this.get('bundle'));
        } else {
            return this.fetchBundleFromServer();
        }
    }
}

export default Device;
