import { _converse, api, constants } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplCall from './templates/call.js';
import 'shared/avatar/avatar.js';

const { CALL_STATES } = constants;

// How long the "Call ended" card lingers before it removes itself.
const DISMISS_DELAY = 5000;

/**
 * A single call's card: ringing/calling/connecting/active/ended. Reads the
 * `Call` model and delegates every action straight to its methods.
 */
export default class CallView extends CustomElement {
    static get properties() {
        return { model: { type: Object } };
    }

    constructor() {
        super();
        this.model = null;
        this.timer = null;
        this.dismiss_timer = null;
    }

    initialize() {
        this.listenTo(this.model, 'change', () => this.requestUpdate());
        this.listenTo(this.model, 'change:state', () => this.onStateChanged());
        this.listenTo(this.model, 'contact:add', () => this.requestUpdate());
        this.listenTo(this.model, 'contact:change', () => this.requestUpdate());
        this.listenTo(this.model, 'stream', () => this.requestUpdate());
        this.onStateChanged();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        clearInterval(this.timer);
        clearTimeout(this.dismiss_timer);
    }

    render() {
        return tplCall(this);
    }

    /** Run the call timer while active, and clean up the card once it's over. */
    onStateChanged() {
        const state = this.model.get('state');

        if (state === CALL_STATES.ACTIVE && !this.timer) {
            this.timer = setInterval(() => this.requestUpdate(), 1000);
        } else if (state !== CALL_STATES.ACTIVE && this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }

        if ([CALL_STATES.ENDED, CALL_STATES.FAILED].includes(state) && !this.dismiss_timer) {
            this.dismiss_timer = setTimeout(() => _converse.state.calls.remove(this.model), DISMISS_DELAY);
        }
    }

    /** @param {Event} [ev] */
    accept(ev) {
        ev?.preventDefault?.();
        this.model.accept();
    }

    /** @param {Event} [ev] */
    reject(ev) {
        ev?.preventDefault?.();
        this.model.reject();
    }

    /** @param {Event} [ev] */
    hangup(ev) {
        ev?.preventDefault?.();
        this.model.hangup();
    }

    /** @param {Event} [ev] */
    toggleMute(ev) {
        ev?.preventDefault?.();
        this.model.toggleAudio();
    }
}

api.elements.define('converse-call', CallView);
