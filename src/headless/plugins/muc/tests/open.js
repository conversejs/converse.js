import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

describe('Opening rooms', function () {
    it(
        'opens each room of a list of JIDs',
        mock.initConverse(converse, ['chatBoxesFetched'], {}, async (_converse) => {
            const { api } = _converse;
            const jids = ['balcony@montague.lit', 'hall@montague.lit'];

            const nick = 'romeo';
            const promise = api.rooms.open(jids, { nick });
            for (const jid of jids) {
                await mock.waitForMUCDiscoInfo(_converse, jid);
                await mock.receiveOwnMUCPresence(_converse, jid, nick);
            }
            const rooms = await promise;

            expect(rooms.map((room) => room.get('jid'))).toEqual(jids);
            expect(rooms.every((room) => room === _converse.state.chatboxes.get(room.get('jid')))).toBe(true);
        }),
    );
});
