import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplMUCEmpty from './templates/muc-empty.js';

/**
 * Shown inside a MUC the user has entered which has no messages yet.
 * Rendered by {@link MUCChatContent}.
 */
export default class MUCEmpty extends CustomElement {
    static get properties() {
        return {
            model: { type: Object },
        };
    }

    constructor() {
        super();
        this.model = null;
    }

    render() {
        return tplMUCEmpty();
    }
}

api.elements.define('converse-muc-empty', MUCEmpty);
