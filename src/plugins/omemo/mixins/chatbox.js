import log from '@converse/headless/log';
import { __ } from 'i18n';
import { api, converse } from '@converse/headless/core';
import { getSessionCipher } from '../utils.js';

const { Strophe, sizzle } = converse.env;

/**
 * Mixin object that contains OMEMO-related methods for
 * {@link _converse.ChatBox} or {@link _converse.ChatRoom} objects.
 *
 * @typedef {Object} OMEMOEnabledChatBox
 */
export const OMEMOEnabledChatBox = {
    encryptKey (plaintext, device) {
        return getSessionCipher(device.get('jid'), device.get('id'))
            .encrypt(plaintext)
            .then(payload => ({ 'payload': payload, 'device': device }));
    },

    handleMessageSendError (e) {
        if (e.name === 'IQError') {
            this.save('omemo_supported', false);

            const err_msgs = [];
            if (sizzle(`presence-subscription-required[xmlns="${Strophe.NS.PUBSUB_ERROR}"]`, e.iq).length) {
                err_msgs.push(
                    __(
                        "Sorry, we're unable to send an encrypted message because %1$s " +
                            'requires you to be subscribed to their presence in order to see their OMEMO information',
                        e.iq.getAttribute('from')
                    )
                );
            } else if (sizzle(`remote-server-not-found[xmlns="urn:ietf:params:xml:ns:xmpp-stanzas"]`, e.iq).length) {
                err_msgs.push(
                    __(
                        "Sorry, we're unable to send an encrypted message because the remote server for %1$s could not be found",
                        e.iq.getAttribute('from')
                    )
                );
            } else {
                err_msgs.push(__('Unable to send an encrypted message due to an unexpected error.'));
                err_msgs.push(e.iq.outerHTML);
            }
            api.alert('error', __('Error'), err_msgs);
            log.error(e);
        } else if (e.user_facing) {
            api.alert('error', __('Error'), [e.message]);
            log.error(e);
        } else {
            throw e;
        }
    }
};

