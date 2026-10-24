/**
 * Records a voice message and sends it to the chat it belongs to.
 *
 * Opened and closed through the `voice_recorder` attribute on the chat's `ui`
 * model, and renders nothing while closed.
 */
export default class AudioRecorder extends CustomElement {
    static get properties(): {
        model: {
            type: ObjectConstructor;
        };
        state: {
            state: boolean;
        };
        error_message: {
            state: boolean;
        };
        time_warning: {
            state: boolean;
        };
    };
    /** @type {import('./utils').ChatModel} */
    model: import("./utils").ChatModel;
    state: string;
    error_message: string;
    /** Text for screen readers, set once when the time limit approaches. */
    time_warning: string;
    /** @type {RecordingSession|null} */
    session: RecordingSession | null;
    /** @type {import('./session').Recording|null} */
    recording: import("./session").Recording | null;
    render(): import("lit-html").TemplateResult<1> | "";
    /** @returns {boolean} */
    get show_remaining(): boolean;
    record(): Promise<void>;
    pause(): void;
    resume(): void;
    /** Stop recording and send what has been recorded. */
    stop(): void;
    /** Upload and send {@link recording}, also used to retry after a failure. */
    send(): Promise<void>;
    cancel(): void;
    close(): void;
    #private;
}
import { CustomElement } from 'shared/components/element.js';
import RecordingSession from './session.js';
//# sourceMappingURL=recorder.d.ts.map