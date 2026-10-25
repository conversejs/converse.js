import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

describe('Resolving a name to roster contacts', function () {
    it(
        'matches a JID to itself, whether or not it is on the roster',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            expect(await api.contacts.resolve('Stranger@Example.org')).toEqual([
                { jid: 'Stranger@Example.org', name: null },
            ]);
        }),
    );

    it(
        'matches a contact by nickname, ignoring case',
        mock.initConverse(converse, [], {}, async (_converse) => {
            const { api } = _converse;
            await mock.waitForRoster(_converse, 'current');

            const jid = mock.cur_names[0].replace(/ /g, '.').toLowerCase() + '@montague.lit';
            _converse.state.roster.get(jid).set('nickname', 'Romeo');

            expect(await api.contacts.resolve('romeo')).toEqual([{ jid, name: 'Romeo' }]);
            expect(await api.contacts.resolve('  ROMEO ')).toEqual([{ jid, name: 'Romeo' }]);
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

            expect(await api.contacts.resolve('Benvolio')).toEqual(
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

            expect(await api.contacts.resolve('Nobody Here')).toEqual([]);
            expect(await api.contacts.resolve('   ')).toEqual([]);
        }),
    );
});
