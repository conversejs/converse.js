/**
 * @description
 * This is a Converse.js plugin which add support for in-band registration
 * as specified in XEP-0077.
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import { api, converse, constants } from '@converse/headless';
import './panel.js';
import { __ } from 'i18n';
import { routeToForm } from './utils.js';

// Strophe methods for building stanzas
const { Strophe } = converse.env;
const { CONNECTION_STATUS } = constants;

// Add Strophe Namespaces
Strophe.addNamespace('REGISTER', 'jabber:iq:register');

// Add Strophe Statuses
const i = Object.keys(Strophe.Status).reduce((max, k) => Math.max(max, Strophe.Status[k]), 0);
Strophe.Status.REGIFAIL = i + 1;
Strophe.Status.REGISTERED = i + 2;
Strophe.Status.CONFLICT = i + 3;
Strophe.Status.NOTACCEPTABLE = i + 5;

converse.plugins.add('converse-register', {

    dependencies: ['converse-controlbox'],

    enabled () {
        return true;
    },

    initialize () {
        CONNECTION_STATUS[Strophe.Status.REGIFAIL] = 'REGIFAIL';
        CONNECTION_STATUS[Strophe.Status.REGISTERED] = 'REGISTERED';
        CONNECTION_STATUS[Strophe.Status.CONFLICT] = 'CONFLICT';
        CONNECTION_STATUS[Strophe.Status.NOTACCEPTABLE] = 'NOTACCEPTABLE';

        api.settings.extend({
            'allow_registration': true,
            'domain_placeholder': __(' e.g. conversejs.org'), // Placeholder text shown in the domain input on the registration form
            'providers_link': 'https://compliance.conversations.im/', // Link to XMPP providers shown on registration page
            'registration_domain': ''
        });

        routeToForm();
        addEventListener('hashchange', routeToForm);
    }
});
