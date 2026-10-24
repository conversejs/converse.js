/**
 * @copyright The Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */

/**
 * Formats to fall back to, in order of preference, when the browser can't
 * record in the configured one.
 */
const FALLBACK_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];

/** The longest delay `setTimeout` accepts; longer ones fire immediately. */
const MAX_TIMEOUT = 2 ** 31 - 1;

/**
 * @typedef {Object} Recording
 * @property {Blob} blob
 * @property {string} mime_type
 * @property {number} duration - Recorded time in milliseconds, excluding pauses.
 * @property {boolean} interrupted - Whether recording stopped without being asked
 *  to, for example because the microphone was disconnected.
 */

/**
 * @returns {boolean} Whether this browser can record audio.
 */
export function isRecordingSupported() {
    return !!(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);
}

/**
 * @param {string} [preferred]
 * @returns {string|undefined} The preferred MIME type if the browser supports
 *  it, otherwise the first supported fallback. `undefined` lets the browser choose.
 */
function pickMimeType(preferred) {
    return [preferred, ...FALLBACK_MIME_TYPES].find((t) => t && window.MediaRecorder.isTypeSupported(t));
}

/**
 * One recording from the microphone, from asking for permission until it is
 * either finished or cancelled.
 *
 * The outcome is reported once, through {@link RecordingSession#result}, which
 * resolves to the {@link Recording} when recording stops (because {@link stop}
 * was called, the maximum duration was reached or the browser stopped it), to
 * `null` when it's cancelled, and rejects if the media recorder fails.
 *
 * The microphone is released whichever way the session ends.
 */
export default class RecordingSession {
    /** @type {MediaStream|null} */
    #stream = null;
    /** @type {MediaRecorder|null} */
    #recorder = null;
    /** @type {Blob[]} */
    #chunks = [];
    /** Recorded milliseconds before the current segment. */
    #recorded = 0;
    /** When the current segment started, or `null` while not recording. */
    #segment_start = null;
    /** @type {ReturnType<typeof setTimeout>|null} */
    #limit_timer = null;
    #ended = false;
    #stopping = false;
    /** @type {(recording: Recording|null) => void} */
    #resolve;
    /** @type {(error: Error) => void} */
    #reject;

    /**
     * @param {Object} options
     * @param {number} options.max_duration - In seconds. Anything but a positive
     *  number means no limit.
     * @param {number} options.bitrate - In bits per second.
     * @param {string} [options.mime_type] - The preferred format.
     */
    constructor({ max_duration, bitrate, mime_type }) {
        this.max_duration = Number.isFinite(max_duration) && max_duration > 0 ? max_duration * 1000 : Infinity;
        this.bitrate = bitrate;
        this.mime_type = mime_type;
        /** @type {Promise<Recording|null>} */
        this.result = new Promise((resolve, reject) => {
            this.#resolve = resolve;
            this.#reject = reject;
        });
    }

    /** @returns {boolean} */
    get paused() {
        return this.#recorder?.state === 'paused';
    }

    /** @returns {number} Recorded milliseconds so far, excluding pauses. */
    get elapsed() {
        const segment = this.#segment_start === null ? 0 : Date.now() - this.#segment_start;
        return this.#recorded + segment;
    }

    /** @returns {number} Milliseconds left before recording stops by itself. */
    get remaining() {
        return Math.max(0, this.max_duration - this.elapsed);
    }

    /**
     * Lower the limit to `seconds`, if that is less than it is now. For a
     * limit that is only known once recording is about to start, such as how
     * much the upload service will accept. Takes effect at once, also while
     * recording.
     * @param {number} seconds - Anything but a positive number is ignored.
     */
    limitTo(seconds) {
        if (!(seconds > 0) || seconds * 1000 >= this.max_duration) return;
        this.max_duration = seconds * 1000;
        if (this.#segment_start !== null) {
            clearTimeout(this.#limit_timer);
            this.#startLimitTimer();
        }
    }

    /**
     * Ask for the microphone and start recording.
     * Rejects with the `getUserMedia` error (e.g. `NotAllowedError` or
     * `NotFoundError`) if the microphone can't be used.
     */
    async start() {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (this.#ended) {
            // Cancelled while waiting for permission
            stream.getTracks().forEach((t) => t.stop());
            return;
        }
        this.#stream = stream;
        const recorder = new window.MediaRecorder(stream, {
            audioBitsPerSecond: this.bitrate,
            mimeType: pickMimeType(this.mime_type),
        });
        this.#recorder = recorder;
        recorder.ondataavailable = (ev) => ev.data.size && this.#chunks.push(ev.data);
        recorder.onstop = () => {
            const mime_type = recorder.mimeType || this.#chunks[0]?.type || '';
            this.#end();
            this.#resolve({
                blob: new Blob(this.#chunks, { type: mime_type }),
                mime_type,
                duration: this.#recorded,
                interrupted: !this.#stopping,
            });
        };
        recorder.onerror = (ev) => {
            this.#end();
            this.#reject(/** @type {any} */ (ev).error ?? new Error('Recording failed'));
        };
        recorder.start();
        this.#startSegment();
    }

    pause() {
        if (this.#recorder?.state !== 'recording') return;
        this.#recorder.pause();
        this.#endSegment();
    }

    resume() {
        if (this.#recorder?.state !== 'paused') return;
        this.#recorder.resume();
        this.#startSegment();
    }

    /** Stop recording. {@link result} resolves once the recorder has flushed. */
    stop() {
        if (!this.#recorder || this.#recorder.state === 'inactive') return;
        this.#stopping = true;
        this.#endSegment();
        this.#recorder.stop();
    }

    /** Discard the recording. {@link result} resolves to `null`. */
    cancel() {
        if (this.#ended) return;
        if (this.#recorder) {
            // Detach first, so that stopping doesn't produce a recording or an error.
            this.#recorder.ondataavailable = null;
            this.#recorder.onstop = null;
            this.#recorder.onerror = null;
            if (this.#recorder.state !== 'inactive') this.#recorder.stop();
        }
        this.#end();
        this.#resolve(null);
    }

    #startSegment() {
        this.#segment_start = Date.now();
        this.#startLimitTimer();
    }

    #startLimitTimer() {
        if (this.remaining === Infinity) return;
        this.#limit_timer = setTimeout(
            () => (this.remaining > 0 ? this.#startLimitTimer() : this.stop()),
            Math.min(this.remaining, MAX_TIMEOUT),
        );
    }

    #endSegment() {
        this.#recorded = this.elapsed;
        this.#segment_start = null;
        clearTimeout(this.#limit_timer);
    }

    #end() {
        this.#ended = true;
        this.#endSegment();
        this.#stream?.getTracks().forEach((t) => t.stop());
        this.#stream = null;
    }
}
