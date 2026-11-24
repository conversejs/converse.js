import { vi } from 'vitest';
import mock from '../../../shared/tests/mock.js';
import converse from '../../../../dist/converse.js';

const { u } = converse.env;

/** Records the tones a page would play, as Web Audio can't be heard in a spec. */
class FakeAudioContext {
    static instances = [];

    constructor() {
        this.currentTime = 0;
        this.destination = {};
        this.oscillators = [];
        this.closed = false;
        FakeAudioContext.instances.push(this);
    }

    createOscillator() {
        const oscillator = { frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
        this.oscillators.push(oscillator);
        return oscillator;
    }

    createGain() {
        return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {} }, connect() {} };
    }

    close() {
        this.closed = true;
        return Promise.resolve();
    }

    get frequencies() {
        return [...new Set(this.oscillators.map((o) => o.frequency.value))];
    }
}

function contactJid(i = 0) {
    return mock.cur_names[i].replace(/ /g, '.').toLowerCase() + '@montague.lit';
}

function addCall(_converse, attrs) {
    return _converse.state.calls.add({ id: 'sid-' + u.getUniqueId(), media: ['audio'], jid: contactJid(), ...attrs });
}

describe('The call tones', function () {
    beforeEach(() => {
        FakeAudioContext.instances = [];
        vi.stubGlobal('AudioContext', FakeAudioContext);
    });
    afterEach(() => vi.unstubAllGlobals());

    it(
        'ring while an incoming call rings, and stop once it is answered',
        mock.initConverse(converse, ['callsInitialized'], { play_sounds: true }, async function (_converse) {
            const call = addCall(_converse, { direction: 'incoming', state: 'ringing' });

            const tone = await u.waitUntil(() => FakeAudioContext.instances[0]);
            expect(tone.frequencies).toEqual([400, 450]);

            call.set('state', 'connecting');
            expect(tone.closed).toBe(true);
            expect(FakeAudioContext.instances.length).toBe(1);
        }),
    );

    it(
        "play a ringback tone once the callee's phone rings, until the call connects",
        mock.initConverse(converse, ['callsInitialized'], { play_sounds: true }, async function (_converse) {
            const call = addCall(_converse, { direction: 'outgoing', state: 'calling' });
            expect(FakeAudioContext.instances.length).toBe(0);

            call.set('state', 'ringing');
            const tone = await u.waitUntil(() => FakeAudioContext.instances[0]);
            expect(tone.frequencies).toEqual([425]);

            call.set('state', 'active');
            expect(tone.closed).toBe(true);
        }),
    );

    it(
        'stop when the call ends while it rings',
        mock.initConverse(converse, ['callsInitialized'], { play_sounds: true }, async function (_converse) {
            const call = addCall(_converse, { direction: 'incoming', state: 'ringing' });
            const tone = await u.waitUntil(() => FakeAudioContext.instances[0]);

            _converse.state.calls.remove(call);
            expect(tone.closed).toBe(true);
        }),
    );

    it(
        'stay silent when play_sounds is off',
        mock.initConverse(converse, ['callsInitialized'], { play_sounds: false }, function (_converse) {
            addCall(_converse, { direction: 'incoming', state: 'ringing' });
            addCall(_converse, { direction: 'outgoing', state: 'ringing' });
            expect(FakeAudioContext.instances.length).toBe(0);
        }),
    );
});
