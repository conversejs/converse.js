import { html } from 'lit';
import './styles/spinner.scss';

export default (o = {}) => {
    return html`<div class="d-flex justify-content-center ${o.class}">
        <div class="spinner-grow" role="status">
            <span class="visually-hidden">Loading...</span>
        </div>
    </div>`
};
