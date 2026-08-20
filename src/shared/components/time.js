import { html } from 'lit';
import { api, converse } from '@converse/headless';
import { getRelativeTime } from '../../utils/time.js';
import { CustomElement } from './element.js';

const { dayjs } = converse.env;

export default class Time extends CustomElement {
    static get properties() {
        return {
            timestamp: { type: String },
        };
    }

    #intervalId = null;

    constructor() {
        super();
        this.timestamp = '';
    }

    render() {
        const dayjs_time = dayjs(this.timestamp);
        const rel_time = getRelativeTime(dayjs_time);
        const pretty_date = dayjs_time.format('llll');

        return html`<time title="${pretty_date}" timestamp="${this.timestamp}">${rel_time}</time>`;
    }

    connectedCallback() {
        super.connectedCallback();
        const seconds = dayjs().diff(this.timestamp, 'second');
        const interval = seconds < 86400 ? 60_000 : 60 * 1000 * 60 * 24;
        this.#intervalId = setInterval(() => this.requestUpdate(), interval);
    }

    disconnectedCallback() {
        super.disconnectedCallback();
        if (this.#intervalId) clearInterval(this.#intervalId);
    }
}

api.elements.define('converse-time', Time);
