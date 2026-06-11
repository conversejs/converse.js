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
            expect(ringing.getAttribute('to')).toBe(jid);
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
            expect(reject.getAttribute('to')).toBe(jid_b);
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

            // A sibling device sends <accept> to our own bare JID.
            receive(_converse, _converse.bare_jid, stx`<accept xmlns="${JMI}" id="carbon1"/>`);
            expect(call.get('state')).toBe('ended');
            expect(call.get('ended_reason')).toBe('answered-elsewhere');
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
            expect(proceed.getAttribute('to')).toBe(jid);

            const accept = lastJMI(_converse, 'accept');
            expect(Strophe.getBareJidFromJid(accept.getAttribute('to'))).toBe(_converse.bare_jid);
        }),
    );
});
