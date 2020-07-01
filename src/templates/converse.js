import { html } from 'lit-html';
import '../components/font-awesome.js';


export default () => html`
    <div class="converse-chatboxes row no-gutters"></div>
    <div id="converse-modals" class="modals"></div>
    <converse-fontawesome></converse-fontawesome>
`;
