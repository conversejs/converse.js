/*global mock, converse */

fdescribe('VCard Pruning', function () {
    it(
        'removes VCards that do not belong to roster contacts, MUC occupants, or open chats',
        mock.initConverse(['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { api } = _converse;
            const { vcards } = _converse.state;

            // Set up roster with 2 contacts
            await mock.waitForRoster(_converse, 'current', 2);
            const roster_jids = _converse.state.roster.pluck('jid');

            // Create a chatbox
            const chat_jid = 'juliet@montague.lit';
            await api.chatboxes.create(chat_jid);

            // Create a MUC room with an occupant
            const muc_jid = 'room@muc.montague.lit';
            const occupant_jid = 'tybalt@montague.lit';
            const muc = await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            muc.occupants.create({ nick: 'tybalt', jid: occupant_jid, role: 'participant', affiliation: 'member' });

            // Stale JIDs - these should be pruned
            const stale_jid_1 = 'stale1@example.com';
            const stale_jid_2 = 'stale2@example.com';

            // Create stale VCards
            vcards.create({ jid: stale_jid_1, nickname: 'Stale 1', vcard_updated: new Date().toISOString() });
            vcards.create({ jid: stale_jid_2, nickname: 'Stale 2', vcard_updated: new Date().toISOString() });

            const count_before = vcards.length;

            // Prune
            const removed = await vcards.pruneVCards();

            // Should have removed exactly 2 stale VCards
            expect(removed).toBe(2);
            expect(vcards.length).toBe(count_before - 2);

            // Verify kept VCards - roster contacts should be kept
            roster_jids.forEach((jid) => expect(vcards.get(jid)).toBeDefined());
            // Chat and MUC VCards should be kept
            expect(vcards.get(chat_jid)).toBeDefined();
            expect(vcards.get(muc_jid)).toBeDefined();
            expect(vcards.get(occupant_jid)).toBeDefined();
            // Own VCard should be kept
            expect(vcards.get(_converse.session.get('bare_jid'))).toBeDefined();

            // Verify pruned VCards
            expect(vcards.get(stale_jid_1)).toBeUndefined();
            expect(vcards.get(stale_jid_2)).toBeUndefined();
        }),
    );

    it(
        'always keeps the user own VCard',
        mock.initConverse(['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { vcards } = _converse.state;
            const own_bare_jid = _converse.session.get('bare_jid');

            // Ensure own VCard exists
            if (!vcards.get(own_bare_jid)) {
                vcards.create({ jid: own_bare_jid, nickname: 'Me', vcard_updated: new Date().toISOString() });
            }

            // Create a stale VCard
            const stale_jid = 'stale@example.com';
            vcards.create({ jid: stale_jid, nickname: 'Stale', vcard_updated: new Date().toISOString() });

            const count_before = vcards.length;

            const removed = await vcards.pruneVCards();

            // Own VCard should still exist
            expect(vcards.get(own_bare_jid)).toBeDefined();
            // Stale VCard should be removed
            expect(vcards.get(stale_jid)).toBeUndefined();
            expect(vcards.length).toBe(count_before - 1);
        }),
    );

    it(
        'returns 0 when there are no stale VCards',
        mock.initConverse(['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { vcards } = _converse.state;

            await mock.waitForRoster(_converse, 'current', 1);

            const count_before = vcards.length;

            const removed = await vcards.pruneVCards();

            // Should not remove any VCards since all belong to roster contacts or own JID
            expect(removed).toBe(0);
            expect(vcards.length).toBe(count_before);
        }),
    );

    it(
        'can be called via the api.vcard.prune method',
        mock.initConverse(['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { api } = _converse;
            const { vcards } = _converse.state;

            await mock.waitForRoster(_converse, 'current', 1);

            // Create a stale VCard
            const stale_jid = 'stale@example.com';
            vcards.create({ jid: stale_jid, nickname: 'Stale', vcard_updated: new Date().toISOString() });

            const count_before = vcards.length;

            const removed = await api.vcard.prune();

            // Should have removed the stale VCard
            expect(removed).toBe(1);
            expect(vcards.length).toBe(count_before - 1);
            expect(vcards.get(stale_jid)).toBeUndefined();
        }),
    );

    it(
        'removes VCards for closed chatboxes',
        mock.initConverse(['chatBoxesFetched'], { no_vcard_mocks: true }, async function (_converse) {
            const { api } = _converse;
            const { vcards } = _converse.state;

            const open_chat_jid = 'open@example.com';
            const closed_chat_jid = 'closed@example.com';

            // Create an open chatbox
            await api.chatboxes.create(open_chat_jid);

            // Create a closed chatbox
            const closed_chatbox = await api.chatboxes.create(closed_chat_jid);
            closed_chatbox.save({ closed: true });

            // Create VCards for both
            vcards.create({ jid: open_chat_jid, nickname: 'Open', vcard_updated: new Date().toISOString() });
            vcards.create({ jid: closed_chat_jid, nickname: 'Closed', vcard_updated: new Date().toISOString() });

            const count_before = vcards.length;

            const removed = await vcards.pruneVCards();

            // The closed chat VCard should be pruned (not in roster, not an open chat)
            expect(removed).toBeGreaterThanOrEqual(1);
            expect(vcards.get(open_chat_jid)).toBeDefined();
            expect(vcards.get(closed_chat_jid)).toBeUndefined();
            expect(vcards.length).toBe(count_before - removed);
        }),
    );
});
