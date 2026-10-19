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

/** Whether we sent any `<finish/>`. */
function sentFinish(_converse) {
    return !!lastJMI(_converse, 'finish');
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
        "doesn't ring again for a <propose> resent after its call ended",
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            const invited = vi.fn();
            _converse.api.listen.on('callInvited', invited);
            const propose = stx`
                <propose xmlns="${JMI}" id="resent1"><description xmlns="${RTP}" media="audio"/></propose>`;

            receive(_converse, `${jid}/phone`, propose);
            receive(_converse, `${jid}/phone`, stx`<retract xmlns="${JMI}" id="resent1"/>`);
            receive(_converse, `${jid}/phone`, propose);

            expect(invited).toHaveBeenCalledOnce();
            expect(_converse.state.calls.length).toBe(0);
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
        'ends an incoming call as declined when a sibling device rejects it, carbon-wrapped',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="rejected1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('rejected1');

            // Our other device sent <reject> to the caller; the server copies it
            // back to us as an XEP-0280 <sent> carbon.
            const carbon = stx`
                <message xmlns="jabber:client" from="${_converse.bare_jid}" to="${_converse.bare_jid}/this" type="chat">
                    <sent xmlns="urn:xmpp:carbons:2">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <message xmlns="jabber:client" from="${_converse.bare_jid}/other" to="${jid}" type="chat">
                                <reject xmlns="${JMI}" id="rejected1"/>
                            </message>
                        </forwarded>
                    </sent>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, carbon));

            expect(call.get('state')).toBe('ended');
            expect(call.get('ended_reason')).toBe('declined');
            expect(call.get('missed')).toBe(false);
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
        'ignores a carbon that our own server did not send',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="forged1"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get('forged1');

            // The caller dresses up a <proceed> as a carbon from one of our devices.
            const forged = stx`
                <message xmlns="jabber:client" from="${jid}/phone" to="${_converse.bare_jid}" type="chat">
                    <sent xmlns="urn:xmpp:carbons:2">
                        <forwarded xmlns="urn:xmpp:forward:0">
                            <message xmlns="jabber:client" from="${_converse.bare_jid}/other" to="${jid}" type="chat">
                                <proceed xmlns="${JMI}" id="forged1"/>
                            </message>
                        </forwarded>
                    </sent>
                </message>`;
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, forged));

            expect(call.get('state')).toBe('ringing');
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
                expect(ours.get('ended_reason')).toBe('tie-break');

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
            'does not apply once the call was answered, which moves it to the new session instead',
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

                expect(_converse.state.calls.get('z')).toBe(ours);
                expect(ours.get('state')).toBe('connecting');
                expect(lastJMI(_converse, 'proceed').getAttribute('to')).toBe(`${jid}/laptop`);
                expect(lastJMI(_converse, 'reject')).toBeUndefined();
                expect(lastJMI(_converse, 'retract')).toBeUndefined();
            }),
        );
    });

    describe('a new <propose> while a call was answered', function () {
        const propose = (sid, media = 'audio') =>
            stx`<propose xmlns="${JMI}" id="${sid}"><description xmlns="${RTP}" media="${media}"/></propose>`;

        /** Ring for a call from a contact, and accept it. */
        async function acceptedCall(_converse) {
            const jid = await getContactJid(_converse);
            receive(_converse, `${jid}/phone`, propose('old'));
            const call = _converse.state.calls.get('old');
            call.accept();
            return { jid, call };
        }

        /** Whether the call is still the live one, untouched. */
        function expectUntouched(_converse, call) {
            expect(call.get('state')).toBe('connecting');
            expect(_converse.state.calls.length).toBe(1);
            expect(sentFinish(_converse)).toBe(false);
            const sent = _converse.api.connection.get().sent_stanzas;
            expect(sent.some((s) => sizzle(`proceed[xmlns="${JMI}"][id="new"]`, s).length)).toBe(false);
        }

        it(
            'is rejected as busy from anyone but the peer, whatever session it claims',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { call } = await acceptedCall(_converse);
                const other = await getContactJid(_converse, 1);
                receive(_converse, `${other}/phone`, propose('new'));

                expectUntouched(_converse, call);
                expect(lastJMI(_converse, 'reject').getAttribute('to')).toBe(`${other}/phone`);
            }),
        );

        it(
            'is rejected, leaving the call alone, when it carries no media we support',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse);
                receive(_converse, `${jid}/tablet`, propose('new', 'video'));

                expectUntouched(_converse, call);
                expect(lastJMI(_converse, 'reject').getAttribute('to')).toBe(`${jid}/tablet`);
            }),
        );

        it(
            'from the peer, resent for the session the call moved from, does not move it back',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse);
                receive(_converse, `${jid}/tablet`, propose('new'));
                expect(call.get('id')).toBe('new');
                const sent = _converse.api.connection.get().sent_stanzas;
                const sent_before = sent.length;

                receive(_converse, `${jid}/phone`, propose('old'));

                expect(call.get('id')).toBe('new');
                expect(call.get('full_jid')).toBe(`${jid}/tablet`);
                expect(_converse.state.calls.length).toBe(1);
                expect(sent.length).toBe(sent_before);
            }),
        );

        it(
            'from the peer does not move the call, nor log it as missed, when it was held offline for more than a minute',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse);
                const get_chat = vi.spyOn(_converse.api.chats, 'get');
                const stamp = new Date(Date.now() - 120_000).toISOString();
                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`<message xmlns="jabber:client" from="${jid}/tablet" to="${_converse.bare_jid}" type="chat">
                            ${propose('new')}
                            <delay xmlns="urn:xmpp:delay" from="montague.lit" stamp="${stamp}"/>
                        </message>`,
                    ),
                );

                expectUntouched(_converse, call);
                expect(get_chat).not.toHaveBeenCalled();
            }),
        );

        it(
            'from the peer to another of our devices, copied to us, does not move the call',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse);
                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`<message xmlns="jabber:client" from="${_converse.bare_jid}"
                                     to="${_converse.session.get('jid')}" type="chat">
                            <received xmlns="urn:xmpp:carbons:2">
                                <forwarded xmlns="urn:xmpp:forward:0">
                                    <message xmlns="jabber:client" from="${jid}/tablet"
                                             to="${_converse.bare_jid}/other" type="chat">${propose('new')}</message>
                                </forwarded>
                            </received>
                        </message>`,
                    ),
                );

                expectUntouched(_converse, call);
                expect(lastJMI(_converse, 'reject')).toBeUndefined();
            }),
        );

        it(
            'copied to us from another of our devices does not move the call',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse);
                _converse.api.connection.get()._dataRecv(
                    mock.createRequest(
                        _converse,
                        stx`<message xmlns="jabber:client" from="${_converse.bare_jid}"
                                     to="${_converse.session.get('jid')}" type="chat">
                            <sent xmlns="urn:xmpp:carbons:2">
                                <forwarded xmlns="urn:xmpp:forward:0">
                                    <message xmlns="jabber:client" from="${_converse.bare_jid}/other" to="${jid}"
                                             type="chat">${propose('new')}</message>
                                </forwarded>
                            </sent>
                        </message>`,
                    ),
                );

                expectUntouched(_converse, call);
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

    describe('sends no <finish/> for a call that was never answered', function () {
        afterEach(() => vi.useRealTimers());

        const propose = (sid) =>
            stx`<propose xmlns="${JMI}" id="${sid}"><description xmlns="${RTP}" media="audio"/></propose>`;

        it(
            'when we decline it',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                receive(_converse, `${jid}/phone`, propose('nofin1'));
                _converse.state.calls.get('nofin1').reject();
                expect(sentFinish(_converse)).toBe(false);
            }),
        );

        it(
            'when we give up before it is answered',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                const call = _converse.api.calls.dial(jid);
                receive(_converse, `${jid}/phone`, stx`<ringing xmlns="${JMI}" id="${call.get('id')}"/>`);
                call.hangup();
                expect(lastJMI(_converse, 'retract')).toBeDefined();
                expect(sentFinish(_converse)).toBe(false);
            }),
        );

        it(
            'when nobody answers it',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
                const call = _converse.api.calls.dial(jid);
                vi.advanceTimersByTime(60_000);
                expect(call.get('ended_reason')).toBe('no-answer');
                expect(sentFinish(_converse)).toBe(false);
            }),
        );

        it(
            "when it gives way to the peer's call in a tie-break",
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                const ours = _converse.api.calls.dial(jid);
                receive(_converse, `${jid}/phone`, propose('0'));
                expect(ours.get('ended_reason')).toBe('tie-break');
                expect(sentFinish(_converse)).toBe(false);
            }),
        );

        it(
            'when another of our devices answers it',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                receive(_converse, `${jid}/phone`, propose('nofin2'));
                receive(_converse, `${_converse.bare_jid}/sibling`, stx`<accept xmlns="${JMI}" id="nofin2"/>`);
                expect(_converse.state.calls.get('nofin2')).toBeUndefined();
                expect(sentFinish(_converse)).toBe(false);
            }),
        );

        it(
            'when another of our devices declines it',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const jid = await getContactJid(_converse);
                receive(_converse, `${jid}/phone`, propose('nofin3'));
                receive(_converse, `${_converse.bare_jid}/sibling`, stx`<reject xmlns="${JMI}" id="nofin3"/>`);
                expect(_converse.state.calls.get('nofin3')).toBeUndefined();
                expect(sentFinish(_converse)).toBe(false);
            }),
        );
    });

    describe('a <finish/> from the peer', function () {
        const finish = (sid, reason = stx`<success/>`) =>
            stx`<finish xmlns="${JMI}" id="${sid}"><reason xmlns="${Strophe.NS.JINGLE}">${reason}</reason></finish>`;

        /** Ring for a call from a contact, and accept it. */
        async function acceptedCall(_converse, sid) {
            const jid = await getContactJid(_converse);
            receive(
                _converse,
                `${jid}/phone`,
                stx`<propose xmlns="${JMI}" id="${sid}"><description xmlns="${RTP}" media="audio"/></propose>`,
            );
            const call = _converse.state.calls.get(sid);
            call.accept();
            return { jid, call };
        }

        /** Feed in a stanza as it arrived. */
        function receiveStanza(_converse, stanza) {
            _converse.api.connection.get()._dataRecv(mock.createRequest(_converse, stanza));
        }

        it(
            'ends the call, and we send our own',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse, 'fin1');
                receive(_converse, `${jid}/phone`, finish('fin1'));

                expect(call.get('state')).toBe('ended');
                expect(call.get('ended_reason')).toBe('success');
                const ours = lastJMI(_converse, 'finish');
                expect(ours.getAttribute('to')).toBe(`${jid}/phone`);
                expect(sizzle(`finish[xmlns="${JMI}"][id="fin1"] > reason > success`, ours).length).toBe(1);
            }),
        );

        it(
            'fails the call when it gives a failure as its reason, whatever its text',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse, 'fin2');
                receive(_converse, `${jid}/phone`, finish('fin2', stx`<connectivity-error/><text>Lost it</text>`));

                expect(call.get('state')).toBe('failed');
                expect(call.get('ended_reason')).toBe('connectivity-error');
            }),
        );

        it(
            'ends the call normally when it says the session migrated',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse, 'fin3');
                receive(
                    _converse,
                    `${jid}/phone`,
                    stx`<finish xmlns="${JMI}" id="fin3">
                        <reason xmlns="${Strophe.NS.JINGLE}"><expired/><text>Session migrated</text></reason>
                        <migrated to="fin3-new"/>
                    </finish>`,
                );

                expect(call.get('state')).toBe('ended');
                expect(call.get('ended_reason')).toBe('success');
            }),
        );

        it(
            'does nothing once the call has ended',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse, 'fin4');
                call.hangup();
                receive(_converse, `${jid}/phone`, finish('fin4', stx`<connectivity-error/>`));

                expect(call.get('state')).toBe('ended');
                expect(call.get('ended_reason')).toBe('cancelled');
                const finishes = _converse.api.connection
                    .get()
                    .sent_stanzas.filter((s) => sizzle(`finish[xmlns="${JMI}"]`, s).length);
                expect(finishes.length).toBe(1);
            }),
        );

        it(
            'is ignored from anyone but the peer',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { call } = await acceptedCall(_converse, 'fin5');
                const stranger = await getContactJid(_converse, 1);
                receive(_converse, `${stranger}/phone`, finish('fin5'));
                receive(_converse, `${_converse.bare_jid}/other`, finish('fin5'));

                expect(call.get('state')).toBe('connecting');
            }),
        );

        it(
            'is ignored for a session id we do not know',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse, 'fin6');
                receive(_converse, `${jid}/phone`, finish('no-such-sid'));

                expect(call.get('state')).toBe('connecting');
                expect(sentFinish(_converse)).toBe(false);
            }),
        );

        it(
            'is ignored in a carbon that our own server did not send',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse, 'fin7');
                receiveStanza(
                    _converse,
                    stx`<message xmlns="jabber:client" from="${jid}/phone" to="${_converse.bare_jid}" type="chat">
                        <received xmlns="urn:xmpp:carbons:2">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <message xmlns="jabber:client" from="${jid}/phone" to="${_converse.bare_jid}/other"
                                         type="chat">${finish('fin7')}</message>
                            </forwarded>
                        </received>
                    </message>`,
                );

                expect(call.get('state')).toBe('connecting');
            }),
        );

        it(
            'is ignored when copied to us from a call on another of our devices',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse, 'fin8');
                const carbon = (direction, from, to) =>
                    stx`<message xmlns="jabber:client" from="${_converse.bare_jid}" to="${_converse.bare_jid}/this"
                                 type="chat">
                        <${direction} xmlns="urn:xmpp:carbons:2">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <message xmlns="jabber:client" from="${from}" to="${to}" type="chat">
                                    ${finish('fin8')}
                                </message>
                            </forwarded>
                        </${direction}>
                    </message>`;
                // Our other device's own <finish/>, and the peer's to that device.
                receiveStanza(_converse, carbon('sent', `${_converse.bare_jid}/other`, `${jid}/phone`));
                receiveStanza(_converse, carbon('received', `${jid}/phone`, `${_converse.bare_jid}/other`));

                expect(call.get('state')).toBe('connecting');
            }),
        );

        it(
            'is ignored when it comes from the archive',
            mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async (_converse) => {
                const { jid, call } = await acceptedCall(_converse, 'fin9');
                receiveStanza(
                    _converse,
                    stx`<message xmlns="jabber:client" from="${_converse.bare_jid}" to="${_converse.session.get('jid')}">
                        <result xmlns="urn:xmpp:mam:2" queryid="q1" id="archived1">
                            <forwarded xmlns="urn:xmpp:forward:0">
                                <delay xmlns="urn:xmpp:delay" stamp="${new Date().toISOString()}"/>
                                <message xmlns="jabber:client" from="${jid}/phone" to="${_converse.bare_jid}"
                                         type="chat">${finish('fin9')}</message>
                            </forwarded>
                        </result>
                    </message>`,
                );

                expect(call.get('state')).toBe('connecting');
            }),
        );
    });
});
