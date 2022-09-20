/**
 * @module converse-register
 * @description
 * This is a Converse.js plugin which add support for in-band registration
 * as specified in XEP-0077.
 * @copyright 2022, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import './panel.js';
import { __ } from 'i18n';
import { _converse, api, converse } from '@converse/headless/core';

// Strophe methods for building stanzas
const { Strophe } = converse.env;

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
        _converse.CONNECTION_STATUS[Strophe.Status.REGIFAIL] = 'REGIFAIL';
        _converse.CONNECTION_STATUS[Strophe.Status.REGISTERED] = 'REGISTERED';
        _converse.CONNECTION_STATUS[Strophe.Status.CONFLICT] = 'CONFLICT';
        _converse.CONNECTION_STATUS[Strophe.Status.NOTACCEPTABLE] = 'NOTACCEPTABLE';

        api.settings.extend({
            'allow_registration': true,
            'domain_placeholder': __(' e.g. conversejs.org'), // Placeholder text shown in the domain input on the registration form
            'providers_link': 'https://compliance.conversations.im/', // Link to XMPP providers shown on registration page
            'registration_domain': ''
        });

        async function setActiveForm (value) {
            await api.waitUntil('controlBoxInitialized');
            const controlbox = _converse.chatboxes.get('controlbox');
            controlbox.set({ 'active-form': value });
        }
        _converse.router.route('converse/login', () => setActiveForm('login'));
        _converse.router.route('converse/register', () => setActiveForm('register'));


        api.listen.on('controlBoxInitialized', view => {
            view.model.on('change:active-form', view.showLoginOrRegisterForm, view);
        });
    }
});
