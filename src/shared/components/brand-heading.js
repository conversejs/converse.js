import './brand-byline.js';
import './brand-logo.js';
import { CustomElement } from './element.js';
import { api } from '@converse/headless/core';
import { html } from 'lit/html.js';


export class ConverseBrandHeading extends CustomElement {

    render () { // eslint-disable-line class-methods-use-this
        return html`
            <converse-brand-logo></converse-brand-logo>
            <converse-brand-byline></converse-brand-byline>
        `;
    }
}

api.elements.define('converse-brand-heading', ConverseBrandHeading);
