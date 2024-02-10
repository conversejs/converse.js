import { CustomElement } from 'shared/components/element.js';
import tplPlaceholder from './templates/placeholder.js';
import { api } from "@converse/headless";
import { fetchArchivedMessages } from '@converse/headless/plugins/mam/utils.js';

import './styles/placeholder.scss';


class Placeholder extends CustomElement {

    static get properties () {
        return {
            'model': { type: Object }
        }
    }

    constructor () {
        super();
        this.model = null;
    }

    render () {
        return tplPlaceholder(this);
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
