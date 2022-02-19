import { CustomElement } from './element.js';
import { api, converse } from '@converse/headless/core';
import { html } from 'lit';

const { dayjs } = converse.env;


export class MessageVersions extends CustomElement {

    static get properties () {
        return {
            'model': { type: Object }
        }
    }

    render () {
        const older_versions = this.model.get('older_versions');
        return html`
            <h4>Older versions</h4>
            ${ Object.keys(older_versions).map(
                k => html`<p class="older-msg"><time>${dayjs(k).format('MMM D, YYYY, HH:mm:ss')}</time>: ${older_versions[k]}</p>`) }
            <hr/>
            <h4>Current version</h4>
            <p>${this.model.getMessageText()}</p>`;
    }
}

api.elements.define('converse-message-versions', MessageVersions);
