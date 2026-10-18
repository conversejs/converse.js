import { vi } from 'vitest';
import mock from '../../../tests/mock.js';
import converse from '../../../dist/converse-headless.js';

const { stx, sizzle, Strophe } = converse.env;
const JMI = 'urn:xmpp:jingle-message:0';
const RTP = 'urn:xmpp:jingle:apps:rtp:1';

/** The most recent outbound JMI `<message>` carrying the given action, if any. */
function lastJMI(_converse, action) {
    return _converse.api.connection
        .get()
        .sent_stanzas.filter((s) => s.nodeName === 'message' && sizzle(`${action}[xmlns="${JMI}"]`, s).length)
        .pop();
}

/** Inject an inbound JMI `<message>` as if it arrived from the peer. */
function receive(_converse, from, child) {
    const stanza = stx`
        <message xmlns="jabber:client" from="${from}" to="${_converse.bare_jid}" type="chat">
            ${child}
        </message>`;
    _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
}

async function getContactJid(_converse, i = 0) {
    await mock.waitForRoster(_converse, 'current');
    return mock.cur_names[i].replace(/ /g, '.').toLowerCase() + '@montague.lit';
}

describe('Jingle Message Initiation (XEP-0353)', function () {
    it(
        'sends a <propose> when dialling a contact',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);

            expect(call.get('direction')).toBe('outgoing');
            expect(call.get('state')).toBe('calling');
            expect(_converse.state.calls.get(call.get('id'))).toBe(call);

            const propose = lastJMI(_converse, 'propose');
            expect(propose).toBeDefined();
            expect(propose.getAttribute('to')).toBe(jid);
            const desc = sizzle(`description[xmlns="${RTP}"]`, propose).pop();
            expect(desc.getAttribute('media')).toBe('audio');
        }),
    );

    it(
        'returns the live call instead of dialling twice',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const first = _converse.api.calls.dial(jid);
            const second = _converse.api.calls.dial(jid);
            expect(second).toBe(first);
            expect(_converse.state.calls.length).toBe(1);
        }),
    );

    it(
        'advances an outgoing call through <ringing> then <proceed>',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${jid}/phone`, stx`<ringing xmlns="${JMI}" id="${sid}"/>`);
            expect(call.get('state')).toBe('ringing');

            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            expect(call.get('state')).toBe('connecting');
        }),
    );

    it(
        'surfaces an incoming call on <propose> and answers with <ringing>',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const invited = [];
            _converse.api.listen.on('callInvited', (c) => invited.push(c));

            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="incoming1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );

            const call = _converse.state.calls.get('incoming1');
            expect(call).toBeDefined();
            expect(call.get('direction')).toBe('incoming');
            expect(call.get('state')).toBe('ringing');
            expect(call.get('jid')).toBe(jid);
            expect(invited).toEqual([call]);

            const ringing = lastJMI(_converse, 'ringing');
            expect(ringing).toBeDefined();
            expect(ringing.getAttribute('to')).toBe(`${jid}/phone`); // the caller's full JID
            expect(sizzle(`ringing[xmlns="${JMI}"]`, ringing).pop().getAttribute('id')).toBe('incoming1');
        }),
    );

    it(
        'auto-rejects an incoming <propose> while already on a call, surfacing no call',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid_a = await getContactJid(_converse, 0);
            const jid_b = await getContactJid(_converse, 1);
            _converse.api.calls.dial(jid_a); // now busy

            receive(
                _converse,
                `${jid_b}/phone`,
                stx`<propose xmlns="${JMI}" id="busy1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );

            expect(_converse.state.calls.get('busy1')).toBeUndefined();
            const reject = lastJMI(_converse, 'reject');
            expect(reject).toBeDefined();
            expect(reject.getAttribute('to')).toBe(`${jid_b}/phone`); // the caller's full JID
        }),
    );

    it(
        'ends an incoming call when the caller <retract>s it',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="retract1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('retract1');

            receive(_converse, `${jid}/phone`, stx`<retract xmlns="${JMI}" id="retract1"/>`);
            expect(call.get('state')).toBe('ended');
            expect(call.get('ended_reason')).toBe('cancelled');
        }),
    );

    it(
        'ends an outgoing call when the callee <reject>s it',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);

            receive(_converse, `${jid}/phone`, stx`<reject xmlns="${JMI}" id="${call.get('id')}"/>`);
            expect(call.get('state')).toBe('ended');
            expect(call.get('ended_reason')).toBe('declined');
        }),
    );

    it(
        'ends an incoming call answered on another of our devices (self-carbon)',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="carbon1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('carbon1');

            // A sibling device (a different resource of ours) sends <accept> to
            // our bare JID; the server routes it to this device too.
            receive(_converse, `${_converse.bare_jid}/sibling`, stx`<accept xmlns="${JMI}" id="carbon1"/>`);
            expect(call.get('state')).toBe('ended');
            expect(call.get('ended_reason')).toBe('answered-elsewhere');
        }),
    );

    it(
        'does not end an incoming call when our own <accept> echoes back',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="self1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('self1');

            call.accept(); // sends <proceed> to the caller and <accept> to our own bare JID
            expect(call.get('state')).toBe('connecting');

            // That <accept> comes back to this same resource - it must not be
            // mistaken for a sibling device answering.
            receive(_converse, _converse.session.get('jid'), stx`<accept xmlns="${JMI}" id="self1"/>`);
            expect(call.get('state')).toBe('connecting');
            expect(call.get('ended_reason')).toBe(null);
        }),
    );

    it(
        'ends an incoming call when a sibling device proceeds, carbon-wrapped',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="wrapped1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('wrapped1');

            // Our other device sent <proceed> to the caller; the server copies it
            // back to us as an XEP-0280 <sent> carbon.
            const carbon = stx`
                <message xmlns="jabber:client" from="${_converse.bare_jid}" to="${_converse.bare_jid}/this" type="chat">
                    <sent xmlns="urn:xmpp:carbons:2">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <message xmlns="jabber:client" from="${_converse.bare_jid}/other" to="${jid}" type="chat">
                                <proceed xmlns="${JMI}" id="wrapped1"/>
                            </message>
                        </forwarded>
                    </sent>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, carbon));

            expect(call.get('state')).toBe('ended');
            expect(call.get('ended_reason')).toBe('answered-elsewhere');
        }),
    );

    it(
        'sends <proceed> and a self <accept> when accepting an incoming call',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="accept1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('accept1');
            call.accept();

            expect(call.get('state')).toBe('connecting');

            const proceed = lastJMI(_converse, 'proceed');
            expect(proceed.getAttribute('to')).toBe(`${jid}/phone`); // the caller's full JID

            const accept = lastJMI(_converse, 'accept');
            expect(Strophe.getBareJidFromJid(accept.getAttribute('to'))).toBe(_converse.bare_jid);
        }),
    );

    it(
        'ignores <ringing>, <proceed> and <reject> from anyone but the callee',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse, 0);
            const stranger = await getContactJid(_converse, 1);
            const call = _converse.api.calls.dial(jid);
            const sid = call.get('id');

            receive(_converse, `${stranger}/phone`, stx`<ringing xmlns="${JMI}" id="${sid}"/>`);
            receive(_converse, `${stranger}/phone`, stx`<proceed xmlns="${JMI}" id="${sid}"/>`);
            receive(_converse, `${stranger}/phone`, stx`<reject xmlns="${JMI}" id="${sid}"/>`);

            expect(call.get('state')).toBe('calling');
            expect(call.session).toBe(null);
        }),
    );

    it(
        'ignores a <retract> from anyone but the caller',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse, 0);
            const stranger = await getContactJid(_converse, 1);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="spoof1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('spoof1');

            receive(_converse, `${stranger}/phone`, stx`<retract xmlns="${JMI}" id="spoof1"/>`);
            expect(call.get('state')).toBe('ringing');
        }),
    );

    it(
        'ignores a <proceed> that arrives after the call was hung up',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const call = _converse.api.calls.dial(jid);
            call.hangup(); // retracts the propose
            expect(call.get('state')).toBe('ended');

            // The callee answered before our <retract> reached them.
            receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${call.get('id')}"/>`);

            expect(call.get('state')).toBe('ended');
            expect(call.session).toBe(null);
        }),
    );

    it(
        'ignores a <ringing> for an ended call, so it does not block new calls',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse, 0);
            const other = await getContactJid(_converse, 1);
            const call = _converse.api.calls.dial(jid);
            call.hangup();

            receive(_converse, `${jid}/phone`, stx`<ringing xmlns="${JMI}" id="${call.get('id')}"/>`);
            expect(call.get('state')).toBe('ended');

            const next = _converse.api.calls.dial(other);
            expect(next).not.toBe(call);
            expect(next.get('jid')).toBe(other);
        }),
    );

    it(
        'ignores a sibling device answering once we have accepted the call ourselves',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="race1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('race1');
            call.accept();

            receive(_converse, `${_converse.bare_jid}/sibling`, stx`<accept xmlns="${JMI}" id="race1"/>`);
            receive(_converse, `${_converse.bare_jid}/sibling`, stx`<proceed xmlns="${JMI}" id="race1"/>`);
            receive(_converse, `${_converse.bare_jid}/sibling`, stx`<reject xmlns="${JMI}" id="race1"/>`);

            expect(call.get('state')).toBe('connecting');
        }),
    );

    it(
        'takes up only the media we support from a <propose>',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="av1">
                    <description xmlns="${RTP}" media="audio"/>
                    <description xmlns="${RTP}" media="video"/>
                </propose>`,
            );
            expect(_converse.state.calls.get('av1').get('media')).toEqual(['audio']);
        }),
    );

    it(
        'rejects a <propose> for media we do not support',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="video1"><description xmlns="${RTP}" media="video"/></propose>`,
            );

            expect(_converse.state.calls.get('video1')).toBeUndefined();
            const reject = lastJMI(_converse, 'reject');
            expect(reject.getAttribute('to')).toBe(`${jid}/phone`);
            expect(sizzle(`reject[xmlns="${JMI}"]`, reject).pop().getAttribute('id')).toBe('video1');
        }),
    );

    it(
        'ignores a <propose> sent as a groupchat message',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, (_converse) => {
            const stanza = stx`
                <message xmlns="jabber:client" from="lounge@montague.lit/romeo" to="${_converse.bare_jid}"
                         type="groupchat">
                    <propose xmlns="${JMI}" id="muc1"><description xmlns="${RTP}" media="audio"/></propose>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));

            expect(_converse.state.calls.get('muc1')).toBeUndefined();
            expect(lastJMI(_converse, 'ringing')).toBeUndefined();
        }),
    );

    describe('when both sides propose at once (glare)', function () {
        /** Assert a JMI tie-break message: `<reason><expired/></reason>` plus `<tie-break/>`. */
        function expectTieBreak(stanza, action, sid) {
            const el = sizzle(`${action}[xmlns="${JMI}"]`, stanza).pop();
            expect(el.getAttribute('id')).toBe(sid);
            expect(sizzle(`> reason[xmlns="${Strophe.NS.JINGLE}"] > expired`, el).length).toBe(1);
            expect(sizzle('> tie-break', el).pop()?.namespaceURI).toBe(JMI);
        }

        it(
            'gives way to the lower session id: retracts our call and rings for theirs',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                const ours = _converse.api.calls.dial(jid);

                // "0" sorts before any UUID in i;octet order.
                receive(
                    _converse,
                    `${jid}/phone`,
                    stx`<propose xmlns="${JMI}" id="0"><description xmlns="${RTP}" media="audio"/></propose>`,
                );

                const retract = lastJMI(_converse, 'retract');
                expect(retract.getAttribute('to')).toBe(jid);
                expectTieBreak(retract, 'retract', ours.get('id'));
                expect(ours.get('state')).toBe('ended');
                expect(ours.get('ended_reason')).toBe('cancelled');

                const theirs = _converse.state.calls.get('0');
                expect(theirs.get('direction')).toBe('incoming');
                expect(theirs.get('state')).toBe('ringing');
                expect(lastJMI(_converse, 'reject')).toBeUndefined();
            }),
        );

        it(
            'keeps our call when its session id is lower and rejects theirs',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                const ours = _converse.api.calls.dial(jid);

                // "z" sorts after any UUID.
                receive(
                    _converse,
                    `${jid}/phone`,
                    stx`<propose xmlns="${JMI}" id="z"><description xmlns="${RTP}" media="audio"/></propose>`,
                );

                const reject = lastJMI(_converse, 'reject');
                expect(reject.getAttribute('to')).toBe(`${jid}/phone`);
                expectTieBreak(reject, 'reject', 'z');
                expect(ours.get('state')).toBe('calling');
                expect(_converse.state.calls.get('z')).toBeUndefined();
                expect(lastJMI(_converse, 'retract')).toBeUndefined();
            }),
        );

        it(
            'does not drop an answered call for a new propose from the same peer',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                const ours = _converse.api.calls.dial(jid);
                receive(_converse, `${jid}/phone`, stx`<proceed xmlns="${JMI}" id="${ours.get('id')}"/>`);
                expect(ours.get('state')).toBe('connecting');

                receive(
                    _converse,
                    `${jid}/laptop`,
                    stx`<propose xmlns="${JMI}" id="z"><description xmlns="${RTP}" media="audio"/></propose>`,
                );

                expect(ours.get('state')).toBe('connecting');
                expect(_converse.state.calls.get('z')).toBeUndefined();
                expect(lastJMI(_converse, 'reject').getAttribute('to')).toBe(`${jid}/laptop`);
            }),
        );
    });

    describe("a <propose> from someone who doesn't see our presence", function () {
        const propose = (sid) =>
            stx`<propose xmlns="${JMI}" id="${sid}"><description xmlns="${RTP}" media="audio"/></propose>`;

        it(
            'rings without telling the caller, when strangers may message us',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                await getContactJid(_converse);
                const invited = [];
                _converse.api.listen.on('callInvited', (c) => invited.push(c));

                receive(_converse, 'stranger@evil.lit/phone', propose('stranger1'));

                const call = _converse.state.calls.get('stranger1');
                expect(call.get('state')).toBe('ringing');
                expect(invited).toEqual([call]);
                expect(lastJMI(_converse, 'ringing')).toBeUndefined();
            }),
        );

        it(
            'does not reject it as busy or unsupported',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                receive(
                    _converse,
                    'stranger@evil.lit/phone',
                    stx`<propose xmlns="${JMI}" id="video1"><description xmlns="${RTP}" media="video"/></propose>`,
                );
                _converse.api.calls.dial(jid); // now busy
                receive(_converse, 'stranger@evil.lit/phone', propose('busy1'));

                expect(_converse.state.calls.get('video1')).toBeUndefined();
                expect(_converse.state.calls.get('busy1')).toBeUndefined();
                expect(lastJMI(_converse, 'reject')).toBeUndefined();
            }),
        );

        it(
            'is ignored from a stranger when strangers may not message us',
            mock.initConverse(
                converse,
                ['rosterInitialized', 'callsInitialized'],
                { allow_non_roster_messaging: false },
                async (_converse) => {
                    await getContactJid(_converse);
                    const invited = [];
                    _converse.api.listen.on('callInvited', (c) => invited.push(c));

                    receive(_converse, 'stranger@evil.lit/phone', propose('stranger1'));

                    expect(_converse.state.calls.get('stranger1')).toBeUndefined();
                    expect(invited).toEqual([]);
                    expect(lastJMI(_converse, 'ringing')).toBeUndefined();
                    expect(lastJMI(_converse, 'reject')).toBeUndefined();
                },
            ),
        );

        it(
            'is ignored from someone who only asked to see our presence, when strangers may not message us',
            mock.initConverse(
                converse,
                ['rosterInitialized', 'callsInitialized'],
                { allow_non_roster_messaging: false },
                async (_converse) => {
                    await getContactJid(_converse);
                    _converse.state.roster.create({
                        jid: 'requester@evil.lit',
                        subscription: 'none',
                        requesting: true,
                    });

                    receive(_converse, 'requester@evil.lit/phone', propose('requester1'));

                    expect(_converse.state.calls.get('requester1')).toBeUndefined();
                    expect(lastJMI(_converse, 'ringing')).toBeUndefined();
                },
            ),
        );

        it(
            'rings from a contact we asked to subscribe to, without telling them',
            mock.initConverse(
                converse,
                ['rosterInitialized', 'callsInitialized'],
                { allow_non_roster_messaging: false },
                async (_converse) => {
                    await getContactJid(_converse);
                    _converse.state.roster.create({ jid: 'pending@montague.lit', subscription: 'none', ask: 'subscribe' });

                    receive(_converse, 'pending@montague.lit/phone', propose('pending1'));

                    expect(_converse.state.calls.get('pending1').get('state')).toBe('ringing');
                    expect(lastJMI(_converse, 'ringing')).toBeUndefined();
                },
            ),
        );
    });

    describe('a call nobody answers', function () {
        afterEach(() => vi.useRealTimers());

        it(
            'is retracted after a minute, however long it rang',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
                const call = _converse.api.calls.dial(jid);
                const sid = call.get('id');

                vi.advanceTimersByTime(30_000);
                receive(_converse, `${jid}/phone`, stx`<ringing xmlns="${JMI}" id="${sid}"/>`);
                vi.advanceTimersByTime(29_999);
                expect(call.get('state')).toBe('ringing');
                expect(lastJMI(_converse, 'retract')).toBeUndefined();

                vi.advanceTimersByTime(1);
                expect(call.get('state')).toBe('ended');
                expect(call.get('ended_reason')).toBe('no-answer');
                const retract = lastJMI(_converse, 'retract');
                expect(retract.getAttribute('to')).toBe(jid);
                expect(sizzle(`retract[xmlns="${JMI}"]`, retract).pop().getAttribute('id')).toBe(sid);
            }),
        );

        it(
            'stops ringing after a minute without telling the caller',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
                receive(
                    _converse,
                    `${jid}/phone`,
                    stx`<propose xmlns="${JMI}" id="unanswered1"><description xmlns="${RTP}" media="audio"/></propose>`,
                );
                const call = _converse.state.calls.get('unanswered1');
                const sent = _converse.api.connection.get().sent_stanzas.length;

                vi.advanceTimersByTime(60_000);
                expect(call.get('state')).toBe('ended');
                expect(call.get('ended_reason')).toBe('no-answer');
                expect(_converse.api.connection.get().sent_stanzas.length).toBe(sent);
            }),
        );

        it(
            'does not ring when its <propose> was delayed by more than a minute',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                const delayed = (sid, ago) => {
                    const stamp = new Date(Date.now() - ago).toISOString();
                    return stx`
                        <message xmlns="jabber:client" from="${jid}/phone" to="${_converse.bare_jid}" type="chat">
                            <propose xmlns="${JMI}" id="${sid}"><description xmlns="${RTP}" media="audio"/></propose>
                            <delay xmlns="urn:xmpp:delay" from="montague.lit" stamp="${stamp}"/>
                        </message>`;
                };
                const connection = _converse.api.connection.get();

                connection._dataRecv(mock.createRequest(_converse, delayed('stale1', 61_000)));
                expect(_converse.state.calls.get('stale1')).toBeUndefined();
                expect(lastJMI(_converse, 'ringing')).toBeUndefined();

                connection._dataRecv(mock.createRequest(_converse, delayed('fresh1', 10_000)));
                expect(_converse.state.calls.get('fresh1').get('state')).toBe('ringing');
            }),
        );
    });

    describe('with a JID that differs only in case', function () {
        it(
            'treats the caller as the roster contact',
            mock.initConverse(
                converse,
                ['rosterInitialized', 'callsInitialized'],
                { allow_non_roster_messaging: false },
                async (_converse) => {
                    const jid = await getContactJid(_converse);
                    const shouted = jid.replace(/^./, (c) => c.toUpperCase()).replace('montague', 'Montague');

                    receive(
                        _converse,
                        `${shouted}/phone`,
                        stx`<propose xmlns="${JMI}" id="case1"><description xmlns="${RTP}" media="audio"/></propose>`,
                    );

                    const call = _converse.state.calls.get('case1');
                    expect(call.get('jid')).toBe(jid);
                    expect(call.get('state')).toBe('ringing');
                    expect(lastJMI(_converse, 'ringing').getAttribute('to')).toBe(`${shouted}/phone`);
                },
            ),
        );

        it(
            'lets the callee answer a call dialled with different case',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                const call = _converse.api.calls.dial(jid.toUpperCase());
                expect(call.get('jid')).toBe(jid);

                receive(_converse, `${jid}/phone`, stx`<ringing xmlns="${JMI}" id="${call.get('id')}"/>`);
                expect(call.get('state')).toBe('ringing');
            }),
        );
    });

    describe('api.calls', function () {
        it(
            "won't dial someone else while a call is live",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid_a = await getContactJid(_converse, 0);
                const jid_b = await getContactJid(_converse, 1);
                const first = _converse.api.calls.dial(jid_a);
                const proposes = _converse.api.connection.get().sent_stanzas.filter((s) => sizzle(`propose`, s).length);

                expect(_converse.api.calls.dial(jid_b)).toBe(null);
                expect(_converse.api.calls.get()).toEqual([first]);
                const after = _converse.api.connection.get().sent_stanzas.filter((s) => sizzle(`propose`, s).length);
                expect(after.length).toBe(proposes.length);
            }),
        );

        it(
            'returns the incoming call when dialling the person who is calling us',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                receive(
                    _converse,
                    `${jid}/phone`,
                    stx`<propose xmlns="${JMI}" id="dialback1"><description xmlns="${RTP}" media="audio"/></propose>`,
                );
                const incoming = _converse.state.calls.get('dialback1');

                expect(_converse.api.calls.dial(jid)).toBe(incoming);
            }),
        );

        it(
            'gets a live call by session id or by JID, and no longer once it has ended',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                const call = _converse.api.calls.dial(jid);

                expect(_converse.api.calls.get(call.get('id'))).toBe(call);
                expect(_converse.api.calls.get(`${jid.toUpperCase()}/phone`)).toBe(call);
                expect(_converse.api.calls.get()).toEqual([call]);

                call.hangup();
                expect(_converse.api.calls.get(call.get('id'))).toBeUndefined();
                expect(_converse.api.calls.get(jid)).toBeUndefined();
                expect(_converse.api.calls.get()).toEqual([]);
            }),
        );
    });
});
