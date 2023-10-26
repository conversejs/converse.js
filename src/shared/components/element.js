import { EventEmitter } from '@converse/skeletor';
import { LitElement } from 'lit';


export class CustomElement extends EventEmitter(LitElement) {

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
