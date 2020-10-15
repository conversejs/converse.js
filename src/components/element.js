import { LitElement } from 'lit-element';
import { Events } from '@converse/skeletor/src/events.js';


export class CustomElement extends LitElement {

    constructor () {
        super();
        Object.assign(this, Events);
    }

    createRenderRoot () {
        // Render without the shadow DOM
        return this;
    }

    disconnectedCallback () {
        super.disconnectedCallback();
        this.stopListening();
    }
}
