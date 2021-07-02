/*global mock, converse */

const u = converse.env.utils;

describe("The Login Form", function () {

    it("contains a checkbox to indicate whether the computer is trusted or not",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_registration: false },
            async function (_converse) {

        const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
        mock.toggleControlBox();
        const checkboxes = cbview.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(1);

        const checkbox = checkboxes[0];
        const label = cbview.querySelector(`label[for="${checkbox.getAttribute('id')}"]`);
        expect(label.textContent).toBe('This is a trusted device');
        expect(checkbox.checked).toBe(true);

        cbview.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
        cbview.querySelector('input[name="password"]').value = 'secret';

        expect(_converse.config.get('trusted')).toBe(true);
        expect(_converse.getDefaultStore()).toBe('persistent');
        cbview.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(true);
        expect(_converse.getDefaultStore()).toBe('persistent');

        checkbox.click();
        cbview.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(false);
        expect(_converse.getDefaultStore()).toBe('session');
    }));

    it("checkbox can be set to false by default",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_user_trust_override: 'off',
              allow_registration: false },
            async function (_converse) {

        await u.waitUntil(() => _converse.chatboxviews.get('controlbox'))
        const cbview = _converse.chatboxviews.get('controlbox');
        mock.toggleControlBox();
        const checkboxes = cbview.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(1);

        const checkbox = checkboxes[0];
        const label = cbview.querySelector(`label[for="${checkbox.getAttribute('id')}"]`);
        expect(label.textContent).toBe('This is a trusted device');
        expect(checkbox.checked).toBe(false);

        cbview.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
        cbview.querySelector('input[name="password"]').value = 'secret';

        cbview.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(false);
        expect(_converse.getDefaultStore()).toBe('session');

        checkbox.click();
        cbview.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(true);
        expect(_converse.getDefaultStore()).toBe('persistent');
    }));
});
