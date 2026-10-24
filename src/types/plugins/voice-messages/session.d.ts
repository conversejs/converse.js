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
export function isRecordingSupported(): boolean;
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
    /**
     * @param {Object} options
     * @param {number} options.max_duration - In seconds. Anything but a positive
     *  number means no limit.
     * @param {number} options.bitrate - In bits per second.
     * @param {string} [options.mime_type] - The preferred format.
     */
    constructor({ max_duration, bitrate, mime_type }: {
        max_duration: number;
        bitrate: number;
        mime_type?: string;
    });
    max_duration: number;
    bitrate: number;
    mime_type: string;
    /** @type {Promise<Recording|null>} */
    result: Promise<Recording | null>;
    /** @returns {boolean} */
    get paused(): boolean;
    /** @returns {number} Recorded milliseconds so far, excluding pauses. */
    get elapsed(): number;
    /** @returns {number} Milliseconds left before recording stops by itself. */
    get remaining(): number;
    /**
     * Lower the limit to `seconds`, if that is less than it is now. For a
     * limit that is only known once recording is about to start, such as how
     * much the upload service will accept. Takes effect at once, also while
     * recording.
     * @param {number} seconds - Anything but a positive number is ignored.
     */
    limitTo(seconds: number): void;
    /**
     * Ask for the microphone and start recording.
     * Rejects with the `getUserMedia` error (e.g. `NotAllowedError` or
     * `NotFoundError`) if the microphone can't be used.
     */
    start(): Promise<void>;
    pause(): void;
    resume(): void;
    /** Stop recording. {@link result} resolves once the recorder has flushed. */
    stop(): void;
    /** Discard the recording. {@link result} resolves to `null`. */
    cancel(): void;
    #private;
}
export type Recording = {
    blob: Blob;
    mime_type: string;
    /**
     * - Recorded time in milliseconds, excluding pauses.
     */
    duration: number;
    /**
     * - Whether recording stopped without being asked
     * to, for example because the microphone was disconnected.
     */
    interrupted: boolean;
};
//# sourceMappingURL=session.d.ts.map