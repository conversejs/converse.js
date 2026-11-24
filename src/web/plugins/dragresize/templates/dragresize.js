import { html } from 'lit';
import { onStartDiagonalResize, onStartHorizontalResize, onStartVerticalResize } from '../utils.js';

export default () => html`
    <div class="dragresize dragresize-top" @mousedown="${onStartVerticalResize}"></div>
    <div class="dragresize dragresize-topleft" @mousedown="${onStartDiagonalResize}"></div>
    <div class="dragresize dragresize-left" @mousedown="${onStartHorizontalResize}"></div>
`;
