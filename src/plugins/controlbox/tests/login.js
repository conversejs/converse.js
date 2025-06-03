/*global mock, converse */

const u = converse.env.utils;

describe("The Login Form", function () {
    fit("contains an addon in the username input with locked_domain name", 
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_registration: false,  },
            async function (_converse) {
            
        _converse.api.settings.set('locked_domain', 'jabber.hot-chilli.eu');
        
        const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
        mock.toggleControlBox();
        await u.waitUntil(() => cbview.querySelectorAll("div.input-group").length);

        const addons = cbview.querySelectorAll('span.input-group-text.addon');
        expect(addons.length).toBe(1);

        const addon = cbview.querySelector('span.input-group-text')[0];
        expect(addon.innerHTML).toBe('jabber.hot-chilli.eu');
    }));

    fit("contains an addon in the username input with default_domain name", 
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_registration: false,  },
            async function (_converse) {
            
        _converse.api.settings.set('default_domain', 'jabber.hot-chilli.eu');
        
        const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
        mock.toggleControlBox();
        await u.waitUntil(() => cbview.querySelectorAll("div.input-group").length);

        const addons = cbview.querySelectorAll('span.input-group-text.addon');
        expect(addons.length).toBe(1);

        const addon = cbview.querySelector('span.input-group-text')[0];
        expect(addon.innerHTML).toBe('jabber.hot-chilli.eu');
    }));

    it("contains a checkbox to indicate whether the computer is trusted or not",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_registration: false },
            async function (_converse) {

        const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
        mock.toggleControlBox();
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
        expect(u.getDefaultStore()).toBe('persistent');
        cbview.querySelector('button[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(true);
        expect(u.getDefaultStore()).toBe('persistent');

        checkbox.click();
        cbview.querySelector('button[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(false);
        expect(u.getDefaultStore()).toBe('session');
    }));

    it("checkbox can be set to false by default",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_user_trust_override: 'off',
              allow_registration: false },
            async function (_converse) {

        const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'))
        mock.toggleControlBox();
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
        expect(u.getDefaultStore()).toBe('session');

        checkbox.click();
        cbview.querySelector('button[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(true);
        expect(u.getDefaultStore()).toBe('persistent');
    }));
});
