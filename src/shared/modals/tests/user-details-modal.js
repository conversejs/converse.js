/*global mock, converse */

const u = converse.env.utils;

describe("The User Details Modal", function () {

    it("can be used to remove a contact",
            mock.initConverse(['chatBoxesFetched'], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        _converse.api.trigger('rosterContactsFetched');

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid);
        await u.waitUntil(() => _converse.chatboxes.length > 1);

        const view = _converse.chatboxviews.get(contact_jid);
        let show_modal_button = view.querySelector('.show-user-details-modal');
        show_modal_button.click();
        const modal = _converse.api.modal.get('converse-user-details-modal');
        await u.waitUntil(() => u.isVisible(modal), 1000);
        spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));

        spyOn(view.model.contact, 'removeFromRoster').and.callFake(callback => callback());
        let remove_contact_button = modal.querySelector('button.remove-contact');
        expect(u.isVisible(remove_contact_button)).toBeTruthy();
        remove_contact_button.click();
        await u.waitUntil(() => modal.getAttribute('aria-hidden'), 1000);
        await u.waitUntil(() => !u.isVisible(modal));
        show_modal_button = view.querySelector('.show-user-details-modal');
        show_modal_button.click();
        remove_contact_button = modal.querySelector('button.remove-contact');
        expect(remove_contact_button === null).toBeTruthy();
    }));

    it("shows an alert when an error happened while removing the contact",
            mock.initConverse([], {}, async function (_converse) {

        await mock.waitForRoster(_converse, 'current', 1);
        _converse.api.trigger('rosterContactsFetched');

        const contact_jid = mock.cur_names[0].replace(/ /g,'.').toLowerCase() + '@montague.lit';
        await mock.openChatBoxFor(_converse, contact_jid)
        const view = _converse.chatboxviews.get(contact_jid);
        let show_modal_button = view.querySelector('.show-user-details-modal');
        show_modal_button.click();
        let modal = _converse.api.modal.get('converse-user-details-modal');
        await u.waitUntil(() => u.isVisible(modal), 2000);
        spyOn(_converse.api, 'confirm').and.returnValue(Promise.resolve(true));

        spyOn(view.model.contact, 'removeFromRoster').and.callFake((callback, errback) => errback());
        let remove_contact_button = modal.querySelector('button.remove-contact');
        expect(u.isVisible(remove_contact_button)).toBeTruthy();
        remove_contact_button.click();
        await u.waitUntil(() => !u.isVisible(modal))
        await u.waitUntil(() => u.isVisible(document.querySelector('.alert-danger')), 2000);

        const header = document.querySelector('.alert-danger .modal-title');
        expect(header.textContent).toBe("Error");
        expect(u.ancestor(header, '.modal-content').querySelector('.modal-body p').textContent.trim())
            .toBe("Sorry, there was an error while trying to remove Mercutio as a contact.");
        document.querySelector('.alert-danger  button.close').click();
        show_modal_button = view.querySelector('.show-user-details-modal');
        show_modal_button.click();
        modal = _converse.api.modal.get('converse-user-details-modal');
        await u.waitUntil(() => u.isVisible(modal), 2000)

        show_modal_button = view.querySelector('.show-user-details-modal');
        show_modal_button.click();
        await u.waitUntil(() => u.isVisible(modal), 2000)

        remove_contact_button = modal.querySelector('button.remove-contact');
        expect(u.isVisible(remove_contact_button)).toBeTruthy();
    }));
});
