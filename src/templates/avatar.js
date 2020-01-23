import { html } from "lit-html";

export default  (o) => html`
    <img alt="${o.alt_text}" class="img-thumbnail avatar align-self-center ${o.extra_classes}"
            height="100px" width="100px" src="data:${o.image_type};base64,${o.image}"/>`;
