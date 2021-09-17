import BootstrapModal from "plugins/modal/base.js";
import tpl_image_modal from "./templates/image.js";


export default BootstrapModal.extend({
    id: 'image-modal',

    toHTML () {
        return tpl_image_modal({
            'src': this.src,
            'onload': ev => (ev.target.parentElement.style.height = `${ev.target.height}px`)
        });
    }
});
