import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

describe('Resolving a name to roster contacts', function () {
    it(
        'matches a JID to itself, whether or not it is on the roster',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            expect(await api.contacts.resolve({ jid: 'Stranger@Example.org' })).toEqual([
                { jid: 'Stranger@Example.org', name: null },
            ]);
        }),
    );

    it(
        'looks up a name that looks like a JID as a name, and a JID as a JID',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            _converse.state.roster.get(jid).set('nickname', 'juliet@capulet.lit');

            expect(await api.contacts.resolve({ name: 'juliet@capulet.lit' })).toEqual([
                { jid, name: 'juliet@capulet.lit' },
            ]);
            expect(await api.contacts.resolve({ jid: 'juliet@capulet.lit' })).toEqual([
                { jid: 'juliet@capulet.lit', name: null },
            ]);
        }),
    );

    it(
        'refuses a call that passes neither or both of a JID and a name, or a JID that is not one',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            await expect(api.contacts.resolve({})).rejects.toThrow('Pass exactly one');
            await expect(api.contacts.resolve({ jid: 'a@b.c', name: 'Romeo' })).rejects.toThrow('Pass exactly one');
            await expect(api.contacts.resolve({ jid: 'not a jid' })).rejects.toThrow('is not a JID');
        }),
    );

    it(
        'matches a contact by nickname, ignoring case',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            _converse.state.roster.get(jid).set('nickname', 'Romeo');

            expect(await api.contacts.resolve({ name: 'romeo' })).toEqual([{ jid, name: 'Romeo' }]);
            expect(await api.contacts.resolve({ name: '  ROMEO ' })).toEqual([{ jid, name: 'Romeo' }]);
        }),
    );

    it(
        'returns every contact a shared name matches, rather than picking one',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const first = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            const second = mock.cur_names[1].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            _converse.state.roster.get(first).set('nickname', 'Benvolio');
            _converse.state.roster.get(second).set('nickname', 'benvolio');

            expect(await api.contacts.resolve({ name: 'Benvolio' })).toEqual(
                [
                    { jid: first, name: 'Benvolio' },
                    { jid: second, name: 'benvolio' },
                ].sort((a, b) => a.jid.localeCompare(b.jid)),
            );
        }),
    );

    it(
        'matches nothing for a name that no contact has',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            expect(await api.contacts.resolve({ name: 'Nobody Here' })).toEqual([]);
            expect(await api.contacts.resolve({ name: '   ' })).toEqual([]);
        }),
    );
});
