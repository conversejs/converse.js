import { html } from "lit-html";

export default  (o) => html`
    <img alt="${o.alt_text}" class="avatar align-self-center ${o.extra_classes}"
            height="${o.height}" width="${o.width}" src="data:${o.image_type};base64,${o.image}"/>`;
