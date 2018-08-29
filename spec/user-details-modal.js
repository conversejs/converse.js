(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    var _ = converse.env._;
    var $iq = converse.env.$iq;
    var $msg = converse.env.$msg;
    var Strophe = converse.env.Strophe;
    var u = converse.env.utils;

    return describe("The User Details Modal", function () {

        it("can be used to remove a contact",
            mock.initConverseWithPromises(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            let view, show_modal_button, modal;
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);
            return test_utils.waitUntil(() => _converse.chatboxes.length).then(() => {
                view = _converse.chatboxviews.get(contact_jid);
                show_modal_button = view.el.querySelector('.show-user-details-modal');
                expect(u.isVisible(show_modal_button)).toBeTruthy();
                show_modal_button.click();
                modal = view.user_details_modal;
                return test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
            }).then(function () {
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

            let view, modal;
            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid)
            .then(() => {
                view = _converse.chatboxviews.get(contact_jid);
                const show_modal_button = view.el.querySelector('.show-user-details-modal');
                expect(u.isVisible(show_modal_button)).toBeTruthy();
                show_modal_button.click();
                modal = view.user_details_modal;
                return test_utils.waitUntil(() => u.isVisible(modal.el), 2000);
            }).then(function () {
                spyOn(window, 'confirm').and.returnValue(true);
                spyOn(view.model.contact, 'removeFromRoster').and.callFake(function (callback, errback) {
                    errback();
                });
                const remove_contact_button = modal.el.querySelector('button.remove-contact');
                expect(u.isVisible(remove_contact_button)).toBeTruthy();
                remove_contact_button.click();
                return test_utils.waitUntil(() => u.isVisible(document.querySelector('.alert-danger')), 2000);
            }).then(function () {
                const header = document.querySelector('.alert-danger .modal-title');
                expect(header.textContent).toBe("Error");
                expect(u.ancestor(header, '.modal-content').querySelector('.modal-body p').textContent.trim())
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
