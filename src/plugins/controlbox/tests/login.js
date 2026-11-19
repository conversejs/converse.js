import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const u = converse.env.utils;

/** What the controlbox shows while the start-up login waits for credentials. */
let shown_while_starting;

// A credential source of the integrator's own, only used where whitelisted.
// It checks the controlbox before handing over the credentials.
converse.plugins.add('test-waiting-credentials', {
    initialize() {
        this._converse.api.listen.on('beforeAttemptNonPreboundSession', async (_context, payload) => {
            const pane = await u.waitUntil(() => document.querySelector('converse-controlbox .controlbox-pane'));
            shown_while_starting = {
                spinner: !!pane.querySelector('converse-spinner'),
                login_form: !!pane.querySelector('converse-login-form'),
            };
            return { ...payload, credentials: { jid: 'romeo@montague.lit/orchard', password: 'secret' } };
        });
    },
});

describe('The Login Form', function () {
    it(
        'shows the domain name when locked_domain is set',
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            { auto_login: false, allow_registration: false, locked_domain: 'jabber.hot-chilli.eu' },
            async function (_converse) {
                mock.toggleControlBox(_converse);
                const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
                await u.waitUntil(() => cbview.querySelectorAll('div.input-group').length);

                const addons = cbview.querySelectorAll('div.input-group');
                expect(addons.length).toBe(1);

                expect(cbview.querySelector('div.input-group').textContent, 'jabber.hot-chilli.eu');
            },
        ),
    );

    it(
        'contains a checkbox to indicate whether the computer is trusted or not',
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            { auto_login: false, allow_registration: false },
            async function (_converse) {
                mock.toggleControlBox(_converse);
                const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
                await u.waitUntil(() => cbview.querySelectorAll('input[type="checkbox"]').length);

                const checkboxes = cbview.querySelectorAll('input[type="checkbox"]');
                expect(checkboxes.length).toBe(1);

                const checkbox = checkboxes[0];
                const label = cbview.querySelector(`label[for="${checkbox.getAttribute('id')}"]`);
                expect(label.textContent).toBe('This is a trusted device');
                expect(checkbox.checked).toBe(true);

                cbview.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
                cbview.querySelector('input[name="password"]').value = 'secret';

                expect(_converse.config.get('trusted')).toBe(true);
                expect(u.getDefaultStorageType()).toBe('persistent');
                cbview.querySelector('button[type="submit"]').click();
                expect(_converse.config.get('trusted')).toBe(true);
                expect(u.getDefaultStorageType()).toBe('persistent');

                checkbox.click();
                cbview.querySelector('button[type="submit"]').click();
                expect(_converse.config.get('trusted')).toBe(false);
                expect(u.getDefaultStorageType()).toBe('session');
            },
        ),
    );

    it(
        'checkbox can be set to false by default',
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            { auto_login: false, allow_user_trust_override: 'off', allow_registration: false },
            async function (_converse) {
                const connected = vi.fn();
                _converse.api.listen.on('connected', connected);
                mock.toggleControlBox(_converse);
                const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
                await u.waitUntil(() => cbview.querySelectorAll('input[type="checkbox"]').length);

                const checkboxes = cbview.querySelectorAll('input[type="checkbox"]');
                expect(checkboxes.length).toBe(1);

                const checkbox = checkboxes[0];
                const label = cbview.querySelector(`label[for="${checkbox.getAttribute('id')}"]`);
                expect(label.textContent).toBe('This is a trusted device');
                expect(checkbox.checked).toBe(false);

                cbview.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
                cbview.querySelector('input[name="password"]').value = 'secret';

                cbview.querySelector('button[type="submit"]').click();
                expect(_converse.config.get('trusted')).toBe(false);
                expect(u.getDefaultStorageType()).toBe('session');

                checkbox.click();
                cbview.querySelector('button[type="submit"]').click();
                expect(_converse.config.get('trusted')).toBe(true);
                expect(u.getDefaultStorageType()).toBe('persistent');

                // Otherwise the logins carry on into the next test.
                await u.waitUntil(() => connected.mock.calls.length === 2);
            },
        ),
    );

    it(
        'does not show the trusted device checkbox when persistent storage is unavailable',
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            { auto_login: false, allow_registration: false },
            async function (_converse) {
                const is_persistent_storage_available = u.isPersistentStorageAvailable;
                u.isPersistentStorageAvailable = () => false;

                try {
                    mock.toggleControlBox(_converse);
                    const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
                    await u.waitUntil(() => cbview.querySelector('input[name="jid"]'));

                    expect(cbview.querySelectorAll('input[type="checkbox"]').length).toBe(0);

                    cbview.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
                    cbview.querySelector('input[name="password"]').value = 'secret';
                    cbview.querySelector('button[type="submit"]').click();

                    expect(_converse.config.get('trusted')).toBe(false);
                    expect(u.getDefaultStorageType()).toBe('session');
                } finally {
                    u.isPersistentStorageAvailable = is_persistent_storage_available;
                }
            },
        ),
    );

    it(
        'drops the login route from the address bar on login, without a history entry',
        mock.initConverse(
            converse,
            ['chatBoxesInitialized'],
            { auto_login: false, allow_registration: false },
            async function (_converse) {
                mock.toggleControlBox(_converse);
                const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
                await u.waitUntil(() => cbview.querySelector('input[name="jid"]'));

                const { search } = location;
                history.replaceState(null, '', `${location.pathname}${search}#converse/login`);
                const push = vi.spyOn(history, 'pushState');

                cbview.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
                cbview.querySelector('input[name="password"]').value = 'secret';
                cbview.querySelector('button[type="submit"]').click();

                await u.waitUntil(() => location.hash === '');
                expect(push).not.toHaveBeenCalled();
                expect(location.search).toBe(search);
                push.mockRestore();
            },
        ),
    );
});

describe('The Controlbox, while Converse starts up', function () {
    beforeEach(() => (shown_while_starting = null));

    it(
        'shows a spinner rather than the login form',
        mock.initConverse(
            converse,
            [],
            { auto_login: false, view_mode: 'fullscreen', whitelisted_plugins: ['test-waiting-credentials'] },
            async function () {
                expect(shown_while_starting).toEqual({ spinner: true, login_form: false });
            },
        ),
    );
});
