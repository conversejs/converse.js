import { api } from '@converse/headless';
import { CustomElement } from './element.js';
import { html } from 'lit';
import 'shared/components/logo.js';

export class ConverseBrandLogo extends CustomElement {
    render() {
        const is_fullscreen = api.settings.get('view_mode') === 'fullscreen';
        return html`
            <a class="brand-heading" href="https://conversejs.org" target="_blank" rel="noopener">
                <span class="brand-name-wrapper ${is_fullscreen ? 'brand-name-wrapper--fullscreen' : ''}">
                    <converse-logo class="converse-svg-logo"></converse-logo>
                    <span class="brand-name">
                        <span class="brand-name__text">converse<span class="subdued">.js</span></span>
                        ${is_fullscreen
                            ? html`
                                <p class="byline">messaging freedom</p>
                            `
                            : ''}
                    </span>
                </span>
            </a>
        `;
    }
}

api.elements.define('converse-brand-logo', ConverseBrandLogo);
