import { vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, u } = converse.env;
const JMI = 'urn:xmpp:jingle-message:0';
const RTP = 'urn:xmpp:jingle:apps:rtp:1';

function receive(_converse, from, child, extra = '') {
    const stanza = stx`
        <message xmlns="jabber:client" from="${from}" to="${_converse.bare_jid}" type="chat">
            ${child}
            ${extra}
        </message>`;
    _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
}

const propose = (sid) =>
    stx`<propose xmlns="${JMI}" id="${sid}"><description xmlns="${RTP}" media="audio"/></propose>`;

async function getContactJid(_converse, i = 0) {
    await mock.waitForRoster(_converse, 'current');
    return mock.cur_names[i].replace(/ /g, '.').toLowerCase() + '@montague.lit';
}

/** The call history line in the chat with `jid`, once written. */
async function historyIn(_converse, jid) {
    const msg = await u.waitUntil(() =>
        _converse.state.chatboxes.get(jid)?.messages.findWhere({ type: 'info' }),
    );
    return msg.get('message');
}

describe('The call history', function () {
    it(
        "is written to the peer's chat even when it isn't open",
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            expect(_converse.state.chatboxes.get(jid)).toBeUndefined();

            const call = _converse.api.calls.dial(jid);
            call.set({ state: 'active', started_at: Date.now() - 134_000 });
            call.hangup();

            expect(await historyIn(_converse, jid)).toBe('Outgoing call · 2:14');
        }),
    );

    it(
        'logs a missed call when the caller gives up while it rings',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(_converse, `${jid}/phone`, propose('missed1'));
            receive(_converse, `${jid}/phone`, stx`<retract xmlns="${JMI}" id="missed1"/>`);

            expect(await historyIn(_converse, jid)).toBe('Missed call');
        }),
    );

    it(
        'logs a missed call when nobody answers',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                receive(_converse, `${jid}/phone`, propose('missed2'));
                vi.advanceTimersByTime(60_000);
            } finally {
                vi.useRealTimers();
            }
            expect(await historyIn(_converse, jid)).toBe('Missed call');
        }),
    );

    it(
        'logs a missed call from someone who calls while we are on another call',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse, 0);
            const busy_with = await getContactJid(_converse, 1);
            _converse.api.calls.dial(busy_with);

            receive(_converse, `${jid}/phone`, propose('busy1'));

            expect(await historyIn(_converse, jid)).toBe('Missed call');
            expect(_converse.state.calls.get('busy1')).toBeUndefined();
        }),
    );

    it(
        'logs a declined call as declined, not missed',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(_converse, `${jid}/phone`, propose('declined1'));
            _converse.state.calls.get('declined1').reject();

            expect(await historyIn(_converse, jid)).toBe('Call declined');
        }),
    );

    it(
        'logs a call we accepted and then hung up as cancelled, not missed',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(_converse, `${jid}/phone`, propose('accepted1'));
            const call = _converse.state.calls.get('accepted1');
            call.accept();
            call.hangup();

            expect(await historyIn(_converse, jid)).toBe('Call cancelled');
        }),
    );

    it(
        'logs a call answered on another of our devices as such',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(_converse, `${jid}/phone`, propose('elsewhere1'));
            receive(_converse, `${_converse.bare_jid}/sibling`, stx`<accept xmlns="${JMI}" id="elsewhere1"/>`);

            expect(await historyIn(_converse, jid)).toBe('Answered on another device');
        }),
    );

    it(
        'logs only the surviving call when both sides call at once',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const ours = _converse.api.calls.dial(jid);
            // "0" sorts before any UUID, so our call gives way to theirs.
            receive(_converse, `${jid}/phone`, propose('0'));
            expect(ours.get('ended_reason')).toBe('tie-break');

            receive(_converse, `${jid}/phone`, stx`<retract xmlns="${JMI}" id="0"/>`);

            expect(await historyIn(_converse, jid)).toBe('Missed call');
            const lines = _converse.state.chatboxes.get(jid).messages.where({ type: 'info' });
            expect(lines.map((m) => m.get('message'))).toEqual(['Missed call']);
        }),
    );

    it(
        'logs one line for a call the peer moved to new sessions, as the call we made, for as long as it lasted',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            call.set({ state: 'active', started_at: Date.now() - 134_000 });

            receive(_converse, `${jid}/tablet`, propose('moved1'));
            call.set({ state: 'active' });
            receive(_converse, `${jid}/laptop`, propose('moved2'));
            call.set({ state: 'active' });
            call.hangup();

            expect(await historyIn(_converse, jid)).toBe('Outgoing call · 2:14');
            await new Promise((resolve) => setTimeout(resolve, 50));
            const lines = _converse.state.chatboxes.get(jid).messages.where({ type: 'info' });
            expect(lines.map((m) => m.get('message'))).toEqual(['Outgoing call · 2:14']);
        }),
    );

    it(
        'logs a call held offline until after the caller gave up as missed, at the time it was made',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const stamp = new Date(Date.now() - 3_600_000).toISOString();
            receive(
                _converse,
                `${jid}/phone`,
                propose('stale1'),
                stx`<delay xmlns="urn:xmpp:delay" from="montague.lit" stamp="${stamp}"/>`,
            );

            expect(await historyIn(_converse, jid)).toBe('Missed call');
            const msg = _converse.state.chatboxes.get(jid).messages.findWhere({ type: 'info' });
            expect(msg.get('time')).toBe(stamp);
            expect(_converse.state.calls.get('stale1')).toBeUndefined();
        }),
    );

    it(
        "doesn't open a chat for a stranger who may not message us",
        mock.initConverse(
            converse,
            ['rosterInitialized', 'callsInitialized'],
            { allow_non_roster_messaging: false },
            async (_converse) => {
                await getContactJid(_converse);
                const stamp = new Date(Date.now() - 3_600_000).toISOString();
                receive(
                    _converse,
                    'stranger@evil.lit/phone',
                    propose('stale2'),
                    stx`<delay xmlns="urn:xmpp:delay" from="evil.lit" stamp="${stamp}"/>`,
                );
                receive(_converse, 'stranger@evil.lit/phone', propose('fresh2'));

                await new Promise((resolve) => setTimeout(resolve, 50));
                expect(_converse.state.chatboxes.get('stranger@evil.lit')).toBeUndefined();
            },
        ),
    );

    it(
        'writes one line, and nothing else, when both the Jingle session and JMI say the call is over',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(_converse, `${jid}/phone`, propose('both1'));
            _converse.state.calls.get('both1').accept();

            const terminate = stx`
                <iq xmlns="jabber:client" type="set" from="${jid}/phone" to="${_converse.session.get('jid')}" id="t1">
                    <jingle xmlns="urn:xmpp:jingle:1" action="session-terminate" sid="both1">
                        <reason><success/></reason>
                    </jingle>
                </iq>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, terminate));
            receive(
                _converse,
                `${jid}/phone`,
                stx`<finish xmlns="${JMI}" id="both1"><reason xmlns="urn:xmpp:jingle:1"><success/></reason></finish>`,
            );

            expect(await historyIn(_converse, jid)).toBe('Call ended');
            await new Promise((resolve) => setTimeout(resolve, 50));
            const messages = _converse.state.chatboxes.get(jid).messages;
            expect(messages.map((m) => [m.get('type'), m.get('message')])).toEqual([['info', 'Call ended']]);
        }),
    );
});

describe('An ended call', function () {
    it(
        'leaves the calls collection',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            expect(_converse.state.calls.get(call.get('id'))).toBe(call);

            call.hangup();
            expect(call.get('state')).toBe('ended');
            expect(_converse.state.calls.get(call.get('id'))).toBeUndefined();
        }),
    );
});
