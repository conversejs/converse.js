import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from './element.js';
import './brand-logo.js';


export class ConverseBrandHeading extends CustomElement {

    render () {
        return html`
            <converse-brand-logo></converse-brand-logo>
        `;
    }
}

api.elements.define('converse-brand-heading', ConverseBrandHeading);
