import tpl_dragresize from "../templates/dragresize.js";
import { CustomElement } from 'shared/components/element.js';
import { api } from '@converse/headless/core.js';


class ConverseDragResize extends CustomElement {

    render () { // eslint-disable-line class-methods-use-this
        return tpl_dragresize();
    }
}

api.elements.define('converse-dragresize', ConverseDragResize);
