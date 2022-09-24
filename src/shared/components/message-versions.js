import { CustomElement } from './element.js';
import { api, converse } from '@converse/headless/core';
import { html } from 'lit';
import { __ } from 'i18n';
import './styles/message-versions.scss';

const { dayjs } = converse.env;

const tpl_older_version = (k, older_versions) => html`<p class="older-msg"><time>${dayjs(k).format('MMM D, YYYY, HH:mm:ss')}</time>: ${older_versions[k]}</p>`;


export class MessageVersions extends CustomElement {

    static get properties () {
        return {
            'model': { type: Object }
        }
    }

    render () {
        const older_versions = this.model.get('older_versions');
        const keys = Object.keys(older_versions);
        return html`
            ${ keys.length ?
                html`<h4>${__('Older versions')}</h4> ${keys.map(k => tpl_older_version(k, older_versions))}` :
                html`<h4>${__('No older versions found')}</h4>`
            }
            <hr/>
            <h4>${__('Current version')}</h4>
            <p><time>${dayjs(this.model.get('time')).format('MMM D, YYYY, HH:mm:ss')}</time>: ${this.model.getMessageText()}</p>`;
    }
}

api.elements.define('converse-message-versions', MessageVersions);
