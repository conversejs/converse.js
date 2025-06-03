import { api } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';
import tplDragresize from "../templates/dragresize.js";


class ConverseDragResize extends CustomElement {

    render () {
        return tplDragresize();
    }
}

api.elements.define('converse-dragresize', ConverseDragResize);
