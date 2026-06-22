import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

function contactJid(i = 0) {
    return mock.cur_names[i].replace(/ /g, '.').toLowerCase() + '@montague.lit';
}

async function addCall(_converse, attrs) {
    const call = _converse.state.calls.add({ id: 'sid-' + u.getUniqueId(), media: ['audio'], ...attrs });
    await u.waitUntil(() => document.querySelector(`converse-calls converse-call`));
    return call;
}

function cardFor(call) {
    const els = Array.from(document.querySelectorAll('converse-calls converse-call'));
    return els.find((el) => el.model === call);
}

describe('The calls UI', function () {
    it(
        'shows an incoming-call card with accept and decline buttons',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const call = await addCall(_converse, {
                jid: contactJid(),
                direction: 'incoming',
                state: 'ringing',
            });
            const card = await u.waitUntil(() => cardFor(call));

            expect(card.querySelector('.call-status').textContent.trim()).toBe('Incoming call');
            const accept = card.querySelector('.call-action.accept');
            const reject = card.querySelector('.call-action.reject');
            expect(accept).not.toBe(null);
            expect(reject).not.toBe(null);

            spyOn(call, 'accept');
            accept.click();
            expect(call.accept).toHaveBeenCalled();

            spyOn(call, 'reject');
            reject.click();
            expect(call.reject).toHaveBeenCalled();
        }),
    );

    it(
        'shows a hang-up button while an outgoing call is ringing',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const call = await addCall(_converse, {
                jid: contactJid(),
                direction: 'outgoing',
                state: 'calling',
            });
            const card = await u.waitUntil(() => cardFor(call));

            expect(card.querySelector('.call-status').textContent.trim()).toBe('Calling…');
            expect(card.querySelector('.call-action.accept')).toBe(null);

            const hangup = card.querySelector('.call-action.hangup');
            expect(hangup).not.toBe(null);
            spyOn(call, 'hangup');
            hangup.click();
            expect(call.hangup).toHaveBeenCalled();
        }),
    );

    it(
        'shows the timer and a mute toggle while a call is active',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const call = await addCall(_converse, {
                jid: contactJid(),
                direction: 'outgoing',
                state: 'active',
                started_at: Date.now(),
            });
            const card = await u.waitUntil(() => cardFor(call));

            expect(card.querySelector('.call-status').textContent.trim()).toMatch(/^\d+:\d{2}$/);

            const mute = card.querySelector('.call-action.mute');
            expect(mute).not.toBe(null);
            spyOn(call, 'toggleAudio');
            mute.click();
            expect(call.toggleAudio).toHaveBeenCalled();

            // The muted flag is reflected in the button.
            call.set('muted_audio', true);
            await u.waitUntil(() => card.querySelector('.call-action.mute.is-muted'));
            expect(card.querySelector('.call-action.mute').getAttribute('title')).toBe('Unmute');
        }),
    );

    it(
        'dismisses the card and writes a history message when the call ends',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const jid = contactJid();
            await mock.openChatBoxFor(_converse, jid);
            const chatbox = _converse.state.chatboxes.get(jid);

            const call = await addCall(_converse, {
                jid,
                direction: 'outgoing',
                state: 'active',
                started_at: Date.now() - 134000, // 2:14 ago
            });
            await u.waitUntil(() => cardFor(call));

            call.end('success');

            const card = await u.waitUntil(() => cardFor(call));
            expect(card.querySelector('.call-status').textContent.trim()).toBe('Call ended · 2:14');

            const msg = await u.waitUntil(() => chatbox.messages.findWhere({ type: 'info' }));
            expect(msg.get('message')).toBe('Outgoing call · 2:14');
        }),
    );

    it(
        'dials when the toolbar call button is clicked in a 1:1 chat',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const jid = contactJid();
            await mock.openChatBoxFor(_converse, jid);
            const chatbox = _converse.state.chatboxes.get(jid);

            spyOn(_converse.api.calls, 'dial');

            _converse.api.trigger('callButtonClicked', { connection: _converse.api.connection.get(), model: chatbox });
            expect(_converse.api.calls.dial).toHaveBeenCalledWith(jid, { audio: true });

            // A groupchat must not start a 1:1 call.
            _converse.api.calls.dial.calls.reset();
            const muc = { get: (k) => (k === 'type' ? 'groupchat' : 'room@conference.montague.lit') };
            _converse.api.trigger('callButtonClicked', { connection: _converse.api.connection.get(), model: muc });
            expect(_converse.api.calls.dial).not.toHaveBeenCalled();
        }),
    );
});
