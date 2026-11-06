import { afterEach, describe, it, expect, vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../dist/converse.js';

const { u } = converse.env;

/** Open the page with `hash`, as a page load does: without a `hashchange`. */
const openWith = (hash) => history.replaceState(null, '', `${location.pathname}${location.search}${hash}`);
const clearHash = () => openWith('');

/** Logged out, with shareable links pointing at the page the specs run on. */
const settings = () => ({
    auto_login: false,
    allow_registration: true,
    discover_connection_methods: false,
    xmpp_providers_url: '',
    shareable_link_url: `${location.origin}${location.pathname}`,
});

/**
 * Pretend to be a browser on another platform.
 * @param {string|undefined} platform The User-Agent Client Hints platform, if any
 * @param {string} [user_agent]
 */
function stubPlatform(platform, user_agent = '') {
    vi.spyOn(Navigator.prototype, 'userAgentData', 'get').mockReturnValue(platform ? { platform } : undefined);
    vi.spyOn(Navigator.prototype, 'userAgent', 'get').mockReturnValue(user_agent);
}

async function getControlBox(_converse) {
    const toggle = await u.waitUntil(() => document.querySelector('.toggle-controlbox'));
    if (!u.isVisible(document.querySelector('#controlbox'))) {
        if (!u.isVisible(toggle)) u.removeClass('hidden', toggle);
        toggle.click();
    }
    return u.waitUntil(() => _converse.api.controlbox.get());
}

describe('A pending invitation', function () {
    afterEach(() => vi.restoreAllMocks());

    it('is shown above the login form when the page was opened with one', async function () {
        openWith('#mercutio@montague.lit');
        await mock.initConverse(converse, [], settings(), async function (_converse) {
            const cbview = await getControlBox(_converse);
            const card = await u.waitUntil(() =>
                cbview.querySelector('converse-pending-invitation .pending-invitation'),
            );
            expect(card.textContent).toContain("You're invited to chat with");
            expect(card.querySelector('converse-copy-button').text).toBe('mercutio@montague.lit');
            expect(card.querySelector('.pending-invitation__open-app').getAttribute('href')).toBe(
                'xmpp:mercutio@montague.lit',
            );
            expect(cbview.querySelector('converse-login-form')).not.toBeNull();

            clearHash();
        })();
    });

    describe('suggests an XMPP app', function () {
        /** @param {any} _converse */
        async function getSuggestedApps(_converse) {
            const cbview = await getControlBox(_converse);
            const card = await u.waitUntil(() =>
                cbview.querySelector('converse-pending-invitation .pending-invitation'),
            );
            return [...card.querySelectorAll('.pending-invitation__apps a')].map((a) => a.textContent.trim());
        }

        const MAC_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)';
        const cases = [
            ['Android', 'Android', '', 'Conversations'],
            ['iOS', undefined, 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'Monal'],
            ['iPadOS', undefined, MAC_UA, 'Monal', 5],
            ['macOS', undefined, MAC_UA, 'Converse Desktop', 0],
            ['Windows', 'Windows', '', 'Converse Desktop'],
            ['Linux', 'Linux', '', 'Converse Desktop'],
        ];
        for (const [name, hint, user_agent, app, touch_points] of cases) {
            it(`for ${name}`, async function () {
                stubPlatform(hint, user_agent);
                if (touch_points !== undefined) {
                    vi.spyOn(Navigator.prototype, 'maxTouchPoints', 'get').mockReturnValue(touch_points);
                }
                openWith('#mercutio@montague.lit');
                await mock.initConverse(converse, [], settings(), async function (_converse) {
                    expect(await getSuggestedApps(_converse)).toEqual([app, 'More apps']);
                    clearHash();
                })();
            });
        }

        it('of each kind when the platform is unknown', async function () {
            stubPlatform('Chrome OS');
            openWith('#mercutio@montague.lit');
            await mock.initConverse(converse, [], settings(), async function (_converse) {
                expect(await getSuggestedApps(_converse)).toEqual([
                    'Conversations',
                    'Converse Desktop',
                    'Monal',
                    'Gajim',
                    'Dino',
                    'More apps',
                ]);
                const platforms = document.querySelector('.pending-invitation__platforms');
                expect(platforms.textContent).toBe('(Android)');
                clearHash();
            })();
        });
    });

    it('suggests the apps the shareable_link_apps setting lists', async function () {
        stubPlatform('Linux');
        openWith('#mercutio@montague.lit');
        const shareable_link_apps = [
            { name: 'Our App', url: 'https://example.org/app' },
            { name: 'Their App', url: 'https://example.org/theirs', platforms: ['Android'] },
        ];
        await mock.initConverse(converse, [], { ...settings(), shareable_link_apps }, async function (_converse) {
            const cbview = await getControlBox(_converse);
            const card = await u.waitUntil(() =>
                cbview.querySelector('converse-pending-invitation .pending-invitation'),
            );
            const links = [...card.querySelectorAll('.pending-invitation__apps a')];
            // None is for Linux, so all of them.
            expect(links.map((a) => a.textContent.trim())).toEqual(['Our App', 'Their App', 'More apps']);
            expect(links[0].getAttribute('href')).toBe('https://example.org/app');
            expect(card.querySelector('.pending-invitation__platforms').textContent).toBe('(Android)');
            clearHash();
        })();
    });

    it('suggests no apps when shareable_link_apps is empty', async function () {
        openWith('#mercutio@montague.lit');
        await mock.initConverse(converse, [], { ...settings(), shareable_link_apps: [] }, async function (_converse) {
            const cbview = await getControlBox(_converse);
            const card = await u.waitUntil(() =>
                cbview.querySelector('converse-pending-invitation .pending-invitation'),
            );
            expect(card.querySelector('.pending-invitation__open-app')).not.toBeNull();
            expect(card.querySelector('.pending-invitation__apps')).toBeNull();
            clearHash();
        })();
    });

    it('is acted on straight away when the session is restored', async function () {
        openWith('#mercutio@montague.lit');
        const { shareable_link_url } = settings();
        await mock.initConverse(converse, [], { shareable_link_url }, async function (_converse) {
            await mock.waitForRoster(_converse, 'current', 1);
            await u.waitUntil(() => _converse.state.chatboxes.get('mercutio@montague.lit')?.get('hidden') === false);
            expect(document.querySelector('converse-pending-invitation .pending-invitation')).toBeNull();
            expect(location.hash).toBe('');
        })();
    });

    it('offers no other app for a link the browser handed to this Converse', async function () {
        openWith(`#converse/action?uri=${encodeURIComponent('xmpp:mercutio@montague.lit')}`);
        await mock.initConverse(converse, [], settings(), async function (_converse) {
            const cbview = await getControlBox(_converse);
            const card = await u.waitUntil(() =>
                cbview.querySelector('converse-pending-invitation .pending-invitation'),
            );
            expect(card.textContent).toContain('Log in to chat with');
            expect(card.querySelector('converse-copy-button').text).toBe('mercutio@montague.lit');
            // This Converse is the XMPP app it would open.
            expect(card.querySelector('.pending-invitation__open-app')).toBeNull();
            expect(card.querySelector('.pending-invitation__apps')).toBeNull();
            clearHash();
        })();
    });

    it("isn't shown for a link the browser handed over that names no valid address", async function () {
        openWith(`#converse/action?uri=${encodeURIComponent('xmpp:not a jid')}`);
        await mock.initConverse(converse, [], settings(), async function (_converse) {
            const cbview = await getControlBox(_converse);
            await u.waitUntil(() => cbview.querySelector('converse-login-form'));
            expect(cbview.querySelector('converse-pending-invitation').textContent.trim()).toBe('');
            clearHash();
        })();
    });

    it('names the groupchat a join link is for', async function () {
        openWith('#coven@chat.shakespeare.lit?join');
        await mock.initConverse(converse, [], settings(), async function (_converse) {
            const cbview = await getControlBox(_converse);
            const card = await u.waitUntil(() =>
                cbview.querySelector('converse-pending-invitation .pending-invitation'),
            );
            expect(card.textContent).toContain("You're invited to join the groupchat");
            expect(card.querySelector('converse-copy-button').text).toBe('coven@chat.shakespeare.lit');
            expect(card.querySelector('.pending-invitation__open-app').getAttribute('href')).toBe(
                'xmpp:coven@chat.shakespeare.lit?join',
            );
            clearHash();
        })();
    });

    it("isn't shown when the page was opened without one", async function () {
        clearHash();
        await mock.initConverse(converse, [], settings(), async function (_converse) {
            const cbview = await getControlBox(_converse);
            await u.waitUntil(() => cbview.querySelector('converse-login-form'));
            expect(cbview.querySelector('converse-pending-invitation').textContent.trim()).toBe('');
        })();
    });

    it("isn't shown for an xmpp: link that does something other than open a conversation", async function () {
        openWith(`#converse/action?uri=${encodeURIComponent('xmpp:mercutio@montague.lit?remove')}`);
        await mock.initConverse(converse, [], settings(), async function (_converse) {
            const cbview = await getControlBox(_converse);
            await u.waitUntil(() => cbview.querySelector('converse-login-form'));
            expect(cbview.querySelector('converse-pending-invitation').textContent.trim()).toBe('');
            clearHash();
        })();
    });

    it('survives a detour through the registration form, and is acted on once logged in', async function () {
        openWith('#mercutio@montague.lit');
        await mock.initConverse(converse, [], settings(), async function (_converse) {
            const cbview = await getControlBox(_converse);
            await u.waitUntil(() => cbview.querySelector('converse-pending-invitation .pending-invitation'));

            // The registration form puts its own route in the hash.
            (await u.waitUntil(() => cbview.querySelector('a.register-account'))).click();
            await u.waitUntil(() => cbview.querySelector('converse-registration-form'));
            expect(location.hash).toBe('#converse/register');
            const card = cbview.querySelector('converse-pending-invitation .pending-invitation');
            expect(card.querySelector('converse-copy-button').text).toBe('mercutio@montague.lit');

            (await u.waitUntil(() => cbview.querySelector('a.login-here'))).click();
            await u.waitUntil(() => cbview.querySelector('converse-login-form'));
            expect(cbview.querySelector('converse-pending-invitation .pending-invitation')).not.toBeNull();

            await _converse.api.user.login('romeo@montague.lit/orchard', 'secret');
            await mock.waitForRoster(_converse, 'current', 1);
            await u.waitUntil(() => _converse.state.chatboxes.get('mercutio@montague.lit')?.get('hidden') === false);
            clearHash();
        })();
    });
});
