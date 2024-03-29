import tplDragresize from "../templates/dragresize.js";
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless';


class ConverseDragResize extends CustomElement {

    render () { // eslint-disable-line class-methods-use-this
        return tplDragresize();
    }
}

api.elements.define('converse-dragresize', ConverseDragResize);
