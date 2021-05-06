import { CustomElement } from './element.js';
import { _converse, api } from '@converse/headless/core';
import { html } from 'lit';


export class ConverseBrandByline extends CustomElement {

    render () { // eslint-disable-line class-methods-use-this
        const is_fullscreen = api.settings.get('view_mode') === 'fullscreen';
        return html`
            ${is_fullscreen
                ? html`
                    <p class="brand-subtitle">${_converse.VERSION_NAME}</p>
                    <p class="brand-subtitle">
                        <a target="_blank" rel="nofollow" href="https://conversejs.org">Open Source</a> XMPP chat client
                        brought to you by <a target="_blank" rel="nofollow" href="https://opkode.com">Opkode</a>
                    </p>
                    <p class="brand-subtitle">
                        <a target="_blank" rel="nofollow" href="https://hosted.weblate.org/projects/conversejs/#languages"
                            >Translate</a
                        >
                        it into your own language
                    </p>
                `
                    : ''}
            `;
    }
}

api.elements.define('converse-brand-byline', ConverseBrandByline);
