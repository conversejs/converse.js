import { _converse, api, constants } from '@converse/headless';

const { CALL_DIRECTION, CALL_STATES } = constants;

// A tone pattern: the frequencies (Hz) sounded together, the bursts they sound
// in (`[from, to]` in ms), and how often (ms) the pattern repeats.

// The callee hears a double ring, as on a British phone line.
const RING = { frequencies: [400, 450], bursts: [[0, 400], [600, 1000]], period: 3000 };
// The caller hears the ITU ringback tone while the callee's phone rings.
const RINGBACK = { frequencies: [425], bursts: [[0, 1000]], period: 5000 };

const VOLUME = 0.15;
// Seconds to fade each burst in and out, so that it doesn't click.
const FADE = 0.02;

/** A tone generated with Web Audio, so there's no sound file to ship or license. */
class Tone {
    /** @param {typeof RING} pattern */
    constructor(pattern) {
        this.pattern = pattern;
        this.context = new AudioContext();
        this.schedule();
        this.interval = setInterval(() => this.schedule(), pattern.period);
    }

    /** Queue one repetition of the pattern. */
    schedule() {
        const { frequencies, bursts } = this.pattern;
        const start = this.context.currentTime;
        const gain = this.context.createGain();
        gain.connect(this.context.destination);
        gain.gain.setValueAtTime(0, start);
        bursts.forEach(([from, to]) => {
            gain.gain.setValueAtTime(0, start + from / 1000);
            gain.gain.linearRampToValueAtTime(VOLUME, start + from / 1000 + FADE);
            gain.gain.setValueAtTime(VOLUME, start + to / 1000 - FADE);
            gain.gain.linearRampToValueAtTime(0, start + to / 1000);
        });
        const end = start + bursts.at(-1)[1] / 1000;
        frequencies.forEach((frequency) => {
            const oscillator = this.context.createOscillator();
            oscillator.frequency.value = frequency;
            oscillator.connect(gain);
            oscillator.start(start);
            oscillator.stop(end);
        });
    }

    stop() {
        clearInterval(this.interval);
        this.context.close();
    }
}

/** @type {Tone|null} */
let tone = null;

/** @returns {typeof RING|null} the tone our calls want right now */
function wantedPattern() {
    if (!api.settings.get('play_sounds') || !globalThis.AudioContext) return null;

    const ringing = (_converse.state.calls?.models ?? []).filter((c) => c.get('state') === CALL_STATES.RINGING);
    if (ringing.some((c) => c.get('direction') === CALL_DIRECTION.INCOMING)) return RING;

    return ringing.length ? RINGBACK : null;
}

/** Start, switch or stop the tone to match the calls. */
export function updateTone() {
    const pattern = wantedPattern();
    if (pattern === (tone?.pattern ?? null)) return;

    tone?.stop();
    tone = pattern ? new Tone(pattern) : null;
}
