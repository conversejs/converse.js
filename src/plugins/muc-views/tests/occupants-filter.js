/* global mock, converse */

const { u, stx } = converse.env;

describe("The MUC occupants filter", function () {

    it("can be used to filter which occupants are shown",
        mock.initConverse(
            [], {},
            async function (_converse) {

        const muc_jid = 'lounge@montague.lit'
        const members = [{
            'nick': 'juliet',
            'jid': 'juliet@capulet.lit',
            'affiliation': 'member'
        }, {
            'nick': 'tybalt',
            'jid': 'tybalt@capulet.lit',
            'affiliation': 'member'
        }];
        await mock.openAndEnterMUC(_converse, muc_jid, 'romeo', [], members);
        const view = _converse.chatboxviews.get(muc_jid);
        await u.waitUntil(() => view.model.occupants.length === 3);

        let filter_el = view.querySelector('converse-list-filter');
        expect(filter_el).toBe(null);

        for (let i=0; i<mock.chatroom_names.length; i++) {
            const name = mock.chatroom_names[i];
            const role = mock.chatroom_roles[name].role;
            // See example 21 https://xmpp.org/extensions/xep-0045.html#enter-pres
            const presence = stx`
                <presence to="romeo@montague.lit/pda"
                        from="lounge@montague.lit/${name}"
                        xmlns="jabber:client">
                    <x xmlns="http://jabber.org/protocol/muc#user">
                        <item affiliation="${mock.chatroom_roles[name].affiliation}"
                                jid="${name.replace(/ /g,'.').toLowerCase()}@montague.lit"
                                role="${role}"/>
                    </x>
                </presence>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(presence));
        }

        const occupants = view.querySelector('.occupant-list');
        await u.waitUntil(() => occupants.querySelectorAll('li').length > 3);
        expect(occupants.querySelectorAll('li').length).toBe(3+mock.chatroom_names.length);
        expect(view.model.occupants.length).toBe(3+mock.chatroom_names.length);

        mock.chatroom_names.forEach(name => {
            const model = view.model.occupants.findWhere({'nick': name});
            const index = view.model.occupants.indexOf(model);
            expect(occupants.querySelectorAll('li .occupant-nick')[index].textContent.trim()).toBe(name);
        });

        const dropdown = await u.waitUntil(() => view.querySelector('.occupants-header converse-dropdown'));

        expect(view.querySelector('converse-list-filter')).toBe(null);

        dropdown.click();
        dropdown.querySelector('.toggle-filter').click();

        filter_el = await u.waitUntil(() => view.querySelector('converse-list-filter'));
        expect(u.isVisible(filter_el.firstElementChild)).toBe(true);

        const filter = filter_el.querySelector('.items-filter');
        filter.value = "j";
        u.triggerEvent(filter, "keydown", "KeyboardEvent");
        await u.waitUntil(() => [...view.querySelectorAll('li')].filter(u.isVisible).length === 1);

        filter_el.querySelector('.fa-times').click();
        await u.waitUntil(
            () => [...view.querySelectorAll('li')].filter(u.isVisible).length === 3+mock.chatroom_names.length
        );

        filter_el.querySelector('.fa-circle').click();
        const state_select = view.querySelector('.state-type');
        state_select.value = "dnd";
        u.triggerEvent(state_select, 'change');
        expect(state_select.value).toBe('dnd');
        expect(state_select.options[state_select.selectedIndex].textContent).toBe('Busy');
        await u.waitUntil(() => [...view.querySelectorAll('li')].filter(u.isVisible).length === 0);
    }));
});
