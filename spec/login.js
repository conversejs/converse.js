(function (root, factory) {
    define(["jasmine", "mock", "converse-core", "test-utils"], factory);
} (this, function (jasmine, mock, converse, test_utils) {

    describe("The Login Form", function () {

        it("contains a checkbox to indicate whether the computer is trusted or not",
            mock.initConverseWithPromises(
                null, ['connectionInitialized', 'chatBoxesInitialized'],
                { auto_login: false,
                  allow_registration: false },
                function (done, _converse) {

            test_utils.waitUntil(() => _converse.chatboxviews.get('controlbox'))
            .then(function () {
                var cbview = _converse.chatboxviews.get('controlbox');
                test_utils.openControlBox();
                const checkboxes = cbview.el.querySelectorAll('input[type="checkbox"]');
                expect(checkboxes.length).toBe(1);

                const checkbox = checkboxes[0];
                const label = cbview.el.querySelector(`label[for="${checkbox.getAttribute('id')}"]`);
                expect(label.textContent).toBe('This is a trusted device');
                expect(checkbox.checked).toBe(true);

                cbview.el.querySelector('input[name="jid"]').value = 'dummy@localhost';
                cbview.el.querySelector('input[name="password"]').value = 'secret';

                spyOn(cbview.loginpanel, 'connect');
                cbview.delegateEvents();

                expect(_converse.storage).toBe('session');
                cbview.el.querySelector('input[type="submit"]').click();
                expect(_converse.storage).toBe('local');
                expect(cbview.loginpanel.connect).toHaveBeenCalled();


                checkbox.click();
                cbview.el.querySelector('input[type="submit"]').click();
                expect(_converse.storage).toBe('session');
                done();
            });
        }));
    });
}));
