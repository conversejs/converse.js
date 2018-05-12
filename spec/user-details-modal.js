(function (root, factory) {
    define([
        "jasmine",
        "utils",
        "converse-core",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, utils, converse, mock, test_utils) {
    "use strict";
    var _ = converse.env._;
    var $iq = converse.env.$iq;
    var $msg = converse.env.$msg;
    var Strophe = converse.env.Strophe;
    var u = converse.env.utils;

    return describe("The User Details Modal", function () {

        it("can be used to remove a contact",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            const show_modal_button = view.el.querySelector('.show-user-details-modal');
            expect(u.isVisible(show_modal_button)).toBeTruthy();
            show_modal_button.click();
            const modal = view.user_details_modal;
            test_utils.waitUntil(() => u.isVisible(modal.el), 1000)
            .then(function () {
                spyOn(window, 'confirm').and.returnValue(true);
                spyOn(view.model.contact, 'removeFromRoster').and.callFake(function (callback) {
                    callback();
                });
                const remove_contact_button = modal.el.querySelector('button.remove-contact');
                expect(u.isVisible(remove_contact_button)).toBeTruthy();
                remove_contact_button.click();
                return test_utils.waitUntil(() => modal.el.getAttribute('aria-hidden'), 1000);
            }).then(function () {
                const show_modal_button = view.el.querySelector('.show-user-details-modal');
                show_modal_button.click();
                const remove_contact_button = modal.el.querySelector('button.remove-contact');
                expect(_.isNull(remove_contact_button)).toBeTruthy();
                done();
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
        }));

        it("shows an alert when an error happened while removing the contact",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);

            const view = _converse.chatboxviews.get(contact_jid);
            const show_modal_button = view.el.querySelector('.show-user-details-modal');
            expect(u.isVisible(show_modal_button)).toBeTruthy();
            show_modal_button.click();
            const modal = view.user_details_modal;
            test_utils.waitUntil(() => u.isVisible(modal.el), 2000)
            .then(function () {
                spyOn(window, 'confirm').and.returnValue(true);
                spyOn(view.model.contact, 'removeFromRoster').and.callFake(function (callback, errback) {
                    errback();
                });
                const remove_contact_button = modal.el.querySelector('button.remove-contact');
                expect(u.isVisible(remove_contact_button)).toBeTruthy();
                remove_contact_button.click();
                return test_utils.waitUntil(() => u.isVisible(document.querySelector('.alert-danger')), 2000);
            }).then(function () {
                expect(document.querySelector('.alert-danger .modal-title').textContent).toBe("Error");
                expect(document.querySelector('.modal:not(#user-profile-modal) .modal-body p').textContent.trim())
                    .toBe("Sorry, there was an error while trying to remove Max Frankfurter as a contact.");
                document.querySelector('.alert-danger  button.close').click();
                const show_modal_button = view.el.querySelector('.show-user-details-modal');
                show_modal_button.click();
                return test_utils.waitUntil(() => u.isVisible(modal.el), 2000)
            }).then(function () {
                const show_modal_button = view.el.querySelector('.show-user-details-modal');
                show_modal_button.click();
                const modal = view.user_details_modal;
                return test_utils.waitUntil(() => u.isVisible(modal.el), 2000)
            }).then(function () {
                const remove_contact_button = modal.el.querySelector('button.remove-contact');
                expect(u.isVisible(remove_contact_button)).toBeTruthy();
                done();
            }).catch(_.partial(_converse.log, _, Strophe.LogLevel.FATAL));
        }));
    });
}));
