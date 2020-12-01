import BootstrapModal from "./base.js";
import tpl_image_modal from "./templates/image.js";


export default BootstrapModal.extend({
    toHTML () {
        return tpl_image_modal({
            'src': this.src,
            'onload': ev => (ev.target.parentElement.style.height = `${ev.target.height}px`)
        });
    }
});
