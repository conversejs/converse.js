import { html } from 'lit';
import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';

export class ModalsContainer extends CustomElement {
    render() {
        return html` <converse-about-modal></converse-about-modal> `;
    }
}

api.elements.define('converse-modals', ModalsContainer);

export default ModalsContainer;
