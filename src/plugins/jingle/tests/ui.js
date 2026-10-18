import { vi } from 'vitest';
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
        "shows the caller's JID beside the name they chose",
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            // A stranger picks both their vCard name and their JID's local part.
            const stranger = await addCall(_converse, { jid: 'mom@evil.lit', direction: 'incoming', state: 'ringing' });
            const card = await u.waitUntil(() => cardFor(stranger));
            expect(card.querySelector('.call-name').textContent.trim()).toBe('mom');
            expect(card.querySelector('.call-jid').textContent.trim()).toBe('mom@evil.lit');
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
        'keeps showing an ended call for a few seconds after it leaves the calls collection',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const jid = contactJid();
            const call = await addCall(_converse, {
                jid,
                direction: 'outgoing',
                state: 'active',
                started_at: Date.now() - 134000, // 2:14 ago
            });
            await u.waitUntil(() => cardFor(call));

            vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
            try {
                call.end('success');
                await vi.advanceTimersByTimeAsync(0);
                expect(_converse.state.calls.get(call.get('id'))).toBeUndefined();
                const card = cardFor(call);
                expect(card.querySelector('.call-status').textContent.trim()).toBe('Call ended · 2:14');

                await vi.advanceTimersByTimeAsync(4_999);
                expect(cardFor(call)).toBe(card);
                await vi.advanceTimersByTimeAsync(1);
                expect(cardFor(call)).toBeUndefined();
            } finally {
                vi.useRealTimers();
            }

            const msg = await u.waitUntil(() => _converse.state.chatboxes.get(jid)?.messages.findWhere({ type: 'info' }));
            expect(msg.get('message')).toBe('Outgoing call · 2:14');
        }),
    );

    it(
        'shows a missed call as missed',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const call = await addCall(_converse, { jid: contactJid(), direction: 'incoming', state: 'ringing' });
            await u.waitUntil(() => cardFor(call));

            call.end('cancelled'); // the caller gave up

            const card = await u.waitUntil(() => cardFor(call));
            await u.waitUntil(() => card.querySelector('.call-status').textContent.trim() === 'Missed call');
        }),
    );

    it(
        "adds a call button to a 1:1 chat's toolbar that dials the contact",
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            await mock.waitForRoster(_converse, 'current');
            const jid = contactJid();
            const view = await mock.openChatBoxFor(_converse, jid);
            const button = await u.waitUntil(() => view.querySelector('.chat-toolbar .start-call'));

            spyOn(_converse.api.calls, 'dial');
            button.click();
            expect(_converse.api.calls.dial).toHaveBeenCalledWith(jid);
        }),
    );

    it(
        'adds no call button to a groupchat',
        mock.initConverse(converse, ['rosterInitialized', 'callsInitialized'], {}, async function (_converse) {
            const muc_jid = 'lounge@montague.lit';
            await mock.openAndEnterMUC(_converse, muc_jid, 'romeo');
            const view = _converse.chatboxviews.get(muc_jid);
            await u.waitUntil(() => view.querySelector('.chat-toolbar .toggle-emojis'));

            expect(view.querySelector('.chat-toolbar .start-call')).toBe(null);
        }),
    );

    it(
        'leaves the call button out when visible_toolbar_buttons turns it off',
        mock.initConverse(
            converse,
            ['rosterInitialized', 'callsInitialized'],
            { visible_toolbar_buttons: { call: false } },
            async function (_converse) {
                await mock.waitForRoster(_converse, 'current');
                const view = await mock.openChatBoxFor(_converse, contactJid());
                await u.waitUntil(() => view.querySelector('.chat-toolbar .toggle-emojis'));

                expect(view.querySelector('.chat-toolbar .start-call')).toBe(null);
            },
        ),
    );
});
