(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const _ = converse.env._;
    const $iq = converse.env.$iq;
    const $msg = converse.env.$msg;
    const Strophe = converse.env.Strophe;
    const u = converse.env.utils;

    return describe("The User Details Modal", function () {

        it("can be used to remove a contact",
            mock.initConverse(
                null, ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            test_utils.openChatBoxFor(_converse, contact_jid);
            await test_utils.waitUntil(() => _converse.chatboxes.length);
            const view = _converse.chatboxviews.get(contact_jid);
            await new Promise((resolve) => view.model.once('contactAdded', resolve));
            let show_modal_button = view.el.querySelector('.show-user-details-modal');
            expect(u.isVisible(show_modal_button)).toBeTruthy();
            show_modal_button.click();
            const modal = view.user_details_modal;
            await test_utils.waitUntil(() => u.isVisible(modal.el), 1000);
            spyOn(window, 'confirm').and.returnValue(true);
            spyOn(view.model.contact, 'removeFromRoster').and.callFake(function (callback) {
                callback();
            });
            let remove_contact_button = modal.el.querySelector('button.remove-contact');
            expect(u.isVisible(remove_contact_button)).toBeTruthy();
            remove_contact_button.click();
            await test_utils.waitUntil(() => modal.el.getAttribute('aria-hidden'), 1000);

            show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            remove_contact_button = modal.el.querySelector('button.remove-contact');
            expect(_.isNull(remove_contact_button)).toBeTruthy();
            done();
        }));

        it("shows an alert when an error happened while removing the contact",
            mock.initConverse(
                null, ['rosterGroupsFetched'], {},
                async function (done, _converse) {

            test_utils.createContacts(_converse, 'current');
            _converse.emit('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@localhost';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            let show_modal_button = view.el.querySelector('.show-user-details-modal');
            expect(u.isVisible(show_modal_button)).toBeTruthy();
            show_modal_button.click();
            const modal = view.user_details_modal;
            await test_utils.waitUntil(() => u.isVisible(modal.el), 2000);
            spyOn(window, 'confirm').and.returnValue(true);
            spyOn(view.model.contact, 'removeFromRoster').and.callFake(function (callback, errback) {
                errback();
            });
            let remove_contact_button = modal.el.querySelector('button.remove-contact');
            expect(u.isVisible(remove_contact_button)).toBeTruthy();
            remove_contact_button.click();
            await test_utils.waitUntil(() => u.isVisible(document.querySelector('.alert-danger')), 2000);

            const header = document.querySelector('.alert-danger .modal-title');
            expect(header.textContent).toBe("Error");
            expect(u.ancestor(header, '.modal-content').querySelector('.modal-body p').textContent.trim())
                .toBe("Sorry, there was an error while trying to remove Max Frankfurter as a contact.");
            document.querySelector('.alert-danger  button.close').click();
            show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            await test_utils.waitUntil(() => u.isVisible(modal.el), 2000)

            show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            await test_utils.waitUntil(() => u.isVisible(modal.el), 2000)

            remove_contact_button = modal.el.querySelector('button.remove-contact');
            expect(u.isVisible(remove_contact_button)).toBeTruthy();
            done();
        }));
    });
}));
