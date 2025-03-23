import { html } from "lit";
import { renderImage } from "../directives/image.js";

export default (o) => html`${renderImage(o.src || o.url, o.href, o.onLoad, o.onClick)}`;
