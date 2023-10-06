import { LitElement } from 'lit';
import { Events } from '@converse/skeletor/src/events.js';


export class CustomElement extends LitElement {

    createRenderRoot () {
        // Render without the shadow DOM
        return this;
    }

    initialize () {
        return null;
    }

    connectedCallback () {
        super.connectedCallback();
        return this.initialize();
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        this.stopListening();
    }
}

Object.assign(CustomElement.prototype, Events);
