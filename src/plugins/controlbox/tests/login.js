/*global mock, converse */

const u = converse.env.utils;

describe("The Login Form", function () {
    
    it("shows the domain name when locked_domain is set", 
        mock.initConverse(
            ['chatBoxesInitialized'], 
            { auto_login: false, 
              allow_registration: false, 
              locked_domain: 'jabber.hot-chilli.eu' }, 
            async function (_converse) {
        
        mock.toggleControlBox();
        const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
        await u.waitUntil(() => cbview.querySelectorAll('div.input-group').length)
        
        const addons = cbview.querySelectorAll('div.input-group');
        expect(addons.length).toBe(1);
        
        expect(cbview.querySelector('div.input-group').textContent, 'jabber.hot-chilli.eu');
    }))

    it("contains a checkbox to indicate whether the computer is trusted or not",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_registration: false },
            async function (_converse) {

        mock.toggleControlBox();
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
    }));

    it("checkbox can be set to false by default",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_user_trust_override: 'off',
              allow_registration: false },
            async function (_converse) {

        mock.toggleControlBox();
        const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'))
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
    }));
});
