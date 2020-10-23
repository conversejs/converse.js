/*global mock, converse */

const u = converse.env.utils;

describe("The Login Form", function () {

    it("contains a checkbox to indicate whether the computer is trusted or not",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_registration: false },
            async function (done, _converse) {

        const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
        mock.toggleControlBox();
        const checkboxes = cbview.el.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(1);

        const checkbox = checkboxes[0];
        const label = cbview.el.querySelector(`label[for="${checkbox.getAttribute('id')}"]`);
        expect(label.textContent).toBe('This is a trusted device');
        expect(checkbox.checked).toBe(true);

        cbview.el.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
        cbview.el.querySelector('input[name="password"]').value = 'secret';

        expect(_converse.config.get('trusted')).toBe(true);
        expect(_converse.getDefaultStore()).toBe('persistent');
        cbview.el.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(true);
        expect(_converse.getDefaultStore()).toBe('persistent');

        checkbox.click();
        cbview.el.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(false);
        expect(_converse.getDefaultStore()).toBe('session');
        done();
    }));

    it("checkbox can be set to false by default",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_user_trust_override: 'off',
              allow_registration: false },
            async function (done, _converse) {

        await u.waitUntil(() => _converse.chatboxviews.get('controlbox'))
        const cbview = _converse.chatboxviews.get('controlbox');
        mock.toggleControlBox();
        const checkboxes = cbview.el.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(1);

        const checkbox = checkboxes[0];
        const label = cbview.el.querySelector(`label[for="${checkbox.getAttribute('id')}"]`);
        expect(label.textContent).toBe('This is a trusted device');
        expect(checkbox.checked).toBe(false);

        cbview.el.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
        cbview.el.querySelector('input[name="password"]').value = 'secret';

        cbview.el.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(false);
        expect(_converse.getDefaultStore()).toBe('session');

        checkbox.click();
        cbview.el.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('trusted')).toBe(true);
        expect(_converse.getDefaultStore()).toBe('persistent');
        done();
    }));
});
