import { api } from '@converse/headless';
import { CustomElement } from './element.js';
import { html } from 'lit';


export class ConverseBrandLogo extends CustomElement {

    render () { // eslint-disable-line class-methods-use-this
        const is_fullscreen = api.settings.get('view_mode') === 'fullscreen';
        return html`
            <a class="brand-heading" href="https://conversejs.org" target="_blank" rel="noopener">
                <span class="brand-name-wrapper ${is_fullscreen ? 'brand-name-wrapper--fullscreen' : ''}">
                    <svg
                        class="converse-svg-logo"
                        xmlns:svg="http://www.w3.org/2000/svg"
                        xmlns="http://www.w3.org/2000/svg"
                        xmlns:xlink="http://www.w3.org/1999/xlink"
                        viewBox="0 0 364 364">

                        <title>Converse</title>
                        <g class="cls-1" id="g904">
                            <g data-name="Layer 2">
                                <g data-name="Layer 7">
                                    <path
                                        class="cls-3"
                                        d="M221.46,103.71c0,18.83-29.36,18.83-29.12,0C192.1,84.88,221.46,84.88,221.46,103.71Z"
                                    />
                                    <path
                                        class="cls-4"
                                        d="M179.9,4.15A175.48,175.48,0,1,0,355.38,179.63,175.48,175.48,0,0,0,179.9,4.15Zm-40.79,264.5c-.23-17.82,27.58-17.82,27.58,0S138.88,286.48,139.11,268.65ZM218.6,168.24A79.65,79.65,0,0,1,205.15,174a12.76,12.76,0,0,0-6.29,4.65L167.54,222a1.36,1.36,0,0,1-2.46-.8v-35.8a2.58,2.58,0,0,0-3.06-2.53c-15.43,3-30.23,7.7-42.73,19.94-38.8,38-29.42,105.69,16.09,133.16a162.25,162.25,0,0,1-91.47-67.27C-3.86,182.26,34.5,47.25,138.37,25.66c46.89-9.75,118.25,5.16,123.73,62.83C265.15,120.64,246.56,152.89,218.6,168.24Z"
                                    />
                                </g>
                            </g>
                        </g>
                    </svg>
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
