import { api } from '@converse/headless';
import tplSpinner from 'templates/spinner.js';
import { CustomElement } from './element.js';

export default class Spinner extends CustomElement {
    render() {
        return tplSpinner();
    }
}

api.elements.define('converse-spinner', Spinner);
