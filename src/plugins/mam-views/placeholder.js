import { CustomElement } from 'shared/components/element.js';
import tpl_placeholder from './templates/placeholder.js';
import { api } from "@converse/headless/core";
import { fetchArchivedMessages } from '@converse/headless/plugins/mam/utils.js';

import './styles/placeholder.scss';


class Placeholder extends CustomElement {

    static get properties () {
        return {
            'model': { type: Object }
        }
    }

    render () {
        return tpl_placeholder(this);
    }

    async fetchMissingMessages (ev) {
        ev?.preventDefault?.();
        this.model.set('fetching', true);
        const options = {
            'before': this.model.get('before'),
            'start': this.model.get('start')
        }
        await fetchArchivedMessages(this.model.collection.chatbox, options);
        this.model.destroy();
    }
}

api.elements.define('converse-mam-placeholder', Placeholder);
