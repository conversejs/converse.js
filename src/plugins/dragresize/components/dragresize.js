import tpl_dragresize from "../templates/dragresize.js";
import { CustomElement } from 'shared/components/element.js';


class ConverseDragResize extends CustomElement {

    render () { // eslint-disable-line class-methods-use-this
        return tpl_dragresize();
    }
}

customElements.define('converse-dragresize', ConverseDragResize);
