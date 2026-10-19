import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { _converse, api, constants } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';

import './styles/calls.scss';

const { CALL_STATES } = constants;

// How long an ended call's card lingers, so its summary can be read.
const DISMISS_DELAY = 5000;

/**
 * Always-present overlay that renders one `<converse-call>` per live call,
 * independent of which chat is open. Mirrors `<converse-toasts>`.
 */
export class Calls extends CustomElement {
    constructor() {
        super();
        this.model = null;
        /** Ended calls still on screen. They have already left `_converse.state.calls`. */
        this.ended = [];
        this.dismiss_timers = [];
    }

    async initialize() {
        await api.waitUntil('callsInitialized');
        this.model = _converse.state.calls;
        this.listenTo(this.model, 'add', () => this.requestUpdate());
        this.listenTo(this.model, 'remove', (call) => this.onRemoved(call));
        this.listenTo(this.model, 'reset', () => this.requestUpdate());
        this.requestUpdate();
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        this.dismiss_timers.forEach((t) => clearTimeout(t));
    }

    /** @param {import('@converse/headless').Call} call */
    onRemoved(call) {
        const ended = [CALL_STATES.ENDED, CALL_STATES.FAILED].includes(call.get('state'));
        if (ended && !call.leavesNoTrace()) {
            this.ended.push(call);
            this.dismiss_timers.push(
                setTimeout(() => {
                    this.ended = this.ended.filter((c) => c !== call);
                    this.requestUpdate();
                }, DISMISS_DELAY)
            );
        }
        this.requestUpdate();
    }

    render() {
        const calls = [...(this.model?.models ?? []), ...this.ended];
        return html`${repeat(
            calls,
            // Not the session id, which changes when the peer moves the call to a new session.
            (call) => call.cid,
            (call) => html`<converse-call .model=${call}></converse-call>`
        )}`;
    }
}

api.elements.define('converse-calls', Calls);
