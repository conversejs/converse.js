/*global mock */

const u = converse.env.utils;

describe("The Login Form", function () {

    it("contains a checkbox to indicate whether the computer is trusted or not",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              allow_registration: false },
            async function (done, _converse) {

        mock.openControlBox(_converse);
        const cbview = await u.waitUntil(() => _converse.chatboxviews.get('controlbox'));
        const checkboxes = cbview.el.querySelectorAll('input[type="checkbox"]');
        expect(checkboxes.length).toBe(1);

        const checkbox = checkboxes[0];
        const label = cbview.el.querySelector(`label[for="${checkbox.getAttribute('id')}"]`);
        expect(label.textContent).toBe('This is a trusted device');
        expect(checkbox.checked).toBe(true);

        cbview.el.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
        cbview.el.querySelector('input[name="password"]').value = 'secret';

        spyOn(cbview.loginpanel, 'connect');
        cbview.delegateEvents();

        expect(_converse.config.get('storage')).toBe('persistent');
        cbview.el.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('storage')).toBe('persistent');
        expect(cbview.loginpanel.connect).toHaveBeenCalled();

        checkbox.click();
        cbview.el.querySelector('input[type="submit"]').click();
        expect(_converse.config.get('storage')).toBe('session');
        done();
    }));

    it("checkbox can be set to false by default",
        mock.initConverse(
            ['chatBoxesInitialized'],
            { auto_login: false,
              trusted: false,
              allow_registration: false },
            function (done, _converse) {

        u.waitUntil(() => _converse.chatboxviews.get('controlbox'))
        .then(() => {
            var cbview = _converse.chatboxviews.get('controlbox');
            mock.openControlBox(_converse);
            const checkboxes = cbview.el.querySelectorAll('input[type="checkbox"]');
            expect(checkboxes.length).toBe(1);

            const checkbox = checkboxes[0];
            const label = cbview.el.querySelector(`label[for="${checkbox.getAttribute('id')}"]`);
            expect(label.textContent).toBe('This is a trusted device');
            expect(checkbox.checked).toBe(false);

            cbview.el.querySelector('input[name="jid"]').value = 'romeo@montague.lit';
            cbview.el.querySelector('input[name="password"]').value = 'secret';

            spyOn(cbview.loginpanel, 'connect');

            expect(_converse.config.get('storage')).toBe('session');
            cbview.el.querySelector('input[type="submit"]').click();
            expect(_converse.config.get('storage')).toBe('session');
            expect(cbview.loginpanel.connect).toHaveBeenCalled();

            checkbox.click();
            cbview.el.querySelector('input[type="submit"]').click();
            expect(_converse.config.get('storage')).toBe('persistent');
            done();
        });
    }));
});
