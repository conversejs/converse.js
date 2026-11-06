import { describe, it, expect, vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const room = (jid) => ({ type: 'chatroom', jid, id: jid, nick: 'romeo' });

describe('Restoring chats', function () {
    it(
        "doesn't create a stored chat that its type says not to",
        mock.initConverse(converse, ['chatBoxesFetched'], {}, (_converse) => {
            const { chatboxes } = _converse.state;
            const { MUC } = _converse.exports;
            const kept = 'kept@montague.lit';
            const dropped = 'dropped@montague.lit';
            vi.spyOn(MUC, 'shouldCreate').mockImplementation((attrs) => attrs.jid !== dropped);
            const setup = vi.spyOn(MUC.prototype, 'setup');

            chatboxes.set([room(kept), room(dropped)], { add: true, parse: true });

            expect(chatboxes.get(kept)).toBeTruthy();
            expect(chatboxes.get(dropped)).toBeUndefined();
            expect(setup.mock.contexts.map((muc) => muc.get('jid'))).toEqual([kept]);
        }),
    );

    it(
        "doesn't create a stored room that isn't auto-joined, in singleton mode",
        mock.initConverse(converse, ['chatBoxesFetched'], { singleton: true }, (_converse) => {
            const { chatboxes } = _converse.state;
            const setup = vi.spyOn(_converse.exports.MUC.prototype, 'setup');

            chatboxes.set([room('lounge@montague.lit')], { add: true, parse: true });

            expect(chatboxes.get('lounge@montague.lit')).toBeUndefined();
            expect(setup).not.toHaveBeenCalled();
        }),
    );
});
