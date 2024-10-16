import { LitElement } from 'lit';
import { EventEmitter } from '@converse/skeletor';


export class CustomElement extends EventEmitter(LitElement) {

    constructor () {
        super();
    }

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
