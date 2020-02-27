(function (root, factory) {
    define([
        "jasmine",
        "mock",
        "test-utils"
        ], factory);
} (this, function (jasmine, mock, test_utils) {
    "use strict";
    const u = converse.env.utils;

    return describe("The User Details Modal", function () {

        it("can be used to remove a contact",
                mock.initConverse(
                    ['rosterGroupsFetched', 'chatBoxesFetched'], {},
                    async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current', 1);
            _converse.api.trigger('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid);
            await u.waitUntil(() => _converse.chatboxes.length > 1);
            const view = _converse.chatboxviews.get(contact_jid);
            let show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            const modal = view.user_details_modal;
            await u.waitUntil(() => u.isVisible(modal.el), 1000);
            spyOn(window, 'confirm').and.returnValue(true);
            spyOn(view.model.contact, 'removeFromRoster').and.callFake(callback => callback());
            let remove_contact_button = modal.el.querySelector('button.remove-contact');
            expect(u.isVisible(remove_contact_button)).toBeTruthy();
            remove_contact_button.click();
            await u.waitUntil(() => modal.el.getAttribute('aria-hidden'), 1000);
            await u.waitUntil(() => !u.isVisible(modal.el));
            show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            remove_contact_button = modal.el.querySelector('button.remove-contact');
            expect(remove_contact_button === null).toBeTruthy();
            done();
        }));

        it("shows an alert when an error happened while removing the contact",
                mock.initConverse(['rosterGroupsFetched'], {}, async function (done, _converse) {

            await test_utils.waitForRoster(_converse, 'current', 1);
            _converse.api.trigger('rosterContactsFetched');

            const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
            await test_utils.openChatBoxFor(_converse, contact_jid)
            const view = _converse.chatboxviews.get(contact_jid);
            let show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            const modal = view.user_details_modal;
            await u.waitUntil(() => u.isVisible(modal.el), 2000);
            spyOn(window, 'confirm').and.returnValue(true);

            spyOn(view.model.contact, 'removeFromRoster').and.callFake((callback, errback) => errback());
            let remove_contact_button = modal.el.querySelector('button.remove-contact');
            expect(u.isVisible(remove_contact_button)).toBeTruthy();
            remove_contact_button.click();
            await u.waitUntil(() => u.isVisible(document.querySelector('.alert-danger')), 2000);

            const header = document.querySelector('.alert-danger .modal-title');
            expect(header.textContent).toBe("Error");
            expect(u.ancestor(header, '.modal-content').querySelector('.modal-body p').textContent.trim())
                .toBe("Sorry, there was an error while trying to remove Mercutio as a contact.");
            document.querySelector('.alert-danger  button.close').click();
            show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            await u.waitUntil(() => u.isVisible(modal.el), 2000)

            show_modal_button = view.el.querySelector('.show-user-details-modal');
            show_modal_button.click();
            await u.waitUntil(() => u.isVisible(modal.el), 2000)

            remove_contact_button = modal.el.querySelector('button.remove-contact');
            expect(u.isVisible(remove_contact_button)).toBeTruthy();
            done();
        }));
    });
}));
