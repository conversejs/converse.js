import { LitElement } from 'lit-element';

export class CustomElement extends LitElement {

    createRenderRoot () {
        // Render without the shadow DOM
        return this;
    }
}
