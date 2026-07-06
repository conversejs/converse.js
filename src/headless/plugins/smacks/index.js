/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 * @description Converse.js plugin which adds support for XEP-0198: Stream Management.
 *
 * Stream Management itself (counters, the unacked queue, <enable/>/<resume/>
 * negotiation and stanza re-sending) is implemented natively by Strophe and
 * activated through the `enableStreamManagement` connection option, which
 * `api.connection.init` derives from the `enable_smacks` setting. This
 * plugin only registers the settings and re-emits Strophe's failure hook as
 * a Converse event.
 */
import api from '../../shared/api/index.js';
import converse from '../../shared/api/public.js';

const { Strophe } = converse.env;

Strophe.addNamespace('SM', 'urn:xmpp:sm:3');

converse.plugins.add('converse-smacks', {
    initialize() {
        // Configuration values for this plugin
        // ====================================
        // Refer to docs/source/configuration.rst for explanations of these
        // configuration settings.
        api.settings.extend({
            enable_smacks: true,
            smacks_max_unacked_stanzas: 5,
        });

        api.listen.on('connectionInitialized', () => {
            const { sm } = api.connection.get();
            if (!sm) {
                return;
            }
            sm.onResumed = () => {
                /**
                 * Triggered when the previous XEP-0198 stream was resumed.
                 * Fires while the <resumed/> nonza is being processed
                 * (before the server's replay of queued stanzas is handled)
                 * so it can be used to register handlers for those stanzas
                 * (resource binding, and therefore `beforeResourceBinding`,
                 * is skipped on resumption).
                 * @event _converse#streamResumed
                 */
                api.trigger('streamResumed');
            };

            /**
             * @param {Element} _el
             * @param {boolean} resume_failed
             */
            sm.onFailed = (_el, resume_failed) => {
                if (resume_failed) {
                    /**
                     * Triggered when the XEP-0198 stream could not be resumed.
                     * @event _converse#streamResumptionFailed
                     */
                    api.trigger('streamResumptionFailed');
                }
            };
        });
    },
});
