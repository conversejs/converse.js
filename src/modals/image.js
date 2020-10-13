import { BootstrapModal } from "../converse-modal.js";
import tpl_image_modal from "../templates/image_modal.js";


export default BootstrapModal.extend({
    toHTML () {
        return tpl_image_modal({
            'src': this.src,
            'onload': ev => (ev.target.parentElement.style.height = `${ev.target.height}px`)
        });
    }
});
