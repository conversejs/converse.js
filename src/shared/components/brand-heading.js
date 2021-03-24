import './brand-byline.js';
import './brand-logo.js';
import { api } from '@converse/headless/core';
import { component } from 'haunted';
import { html } from 'lit-html';

export const ConverseBrandHeading = () => {
    return html`
        <converse-brand-logo></converse-brand-logo>
        <converse-brand-byline></converse-brand-byline>
    `;
};

api.elements.define('converse-brand-heading', component(ConverseBrandHeading, { 'useShadowDOM': false }));
