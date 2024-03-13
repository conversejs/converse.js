/* eslint-disable max-len */
import { html } from "lit";
import { api } from '@converse/headless';


export default () => html`
    <div class="inner-content converse-brand row">
        <div class="converse-brand__padding"></div>
        <div class="converse-brand__heading">
            <svg height="200px"
                xmlns="http://www.w3.org/2000/svg"
                xmlns:xlink="http://www.w3.org/1999/xlink"
                viewBox="0 0 364 364"
                version="1.1">
                <title>Logo Converse</title>
                <defs>
                    <linearGradient id="gradient" x1="92.14" y1="27.64" x2="267.65" y2="331.62" gradientUnits="userSpaceOnUse">
                        <stop offset="0" stop-color="#fff1d1"/>
                        <stop offset="0.05" stop-color="#fae8c1"/>
                        <stop offset="0.15" stop-color="#f0d5a1"/>
                        <stop offset="0.27" stop-color="#e7c687"/>
                        <stop offset="0.4" stop-color="#e1bb72"/>
                        <stop offset="0.54" stop-color="#dcb264"/>
                        <stop offset="0.71" stop-color="#daad5c"/>
                        <stop offset="1" stop-color="#d9ac59"/>
                    </linearGradient>
                    <filter id="shadow">
                        <feGaussianBlur in="SourceAlpha" stdDeviation="2.3" result="blur1"/>
                        <feOffset in="blur1" dx="3" dy="3" result="blur2"/>
                        <feColorMatrix in="blur2" type="matrix" result="blur3"
                            values="1 0 0 0 0.1
                                    0 1 0 0 0.1
                                    0 0 1 0 0.1
                                    0 0 0 1 0"/>
                        <feMerge>
                            <feMergeNode in="blur3"/>
                            <feMergeNode in="SourceGraphic"/>
                        </feMerge>
                    </filter>
                </defs>
                <g filter="url(#shadow)">
                    <path d="M221.46,103.71c0,18.83-29.36,18.83-29.12,0C192.1,84.88,221.46,84.88,221.46,103.71Z" fill="#d9ac59"/>
                    <path d="M179.9,4.15A175.48,175.48,0,1,0,355.38,179.63,175.48,175.48,0,0,0,179.9,4.15Zm-40.79,264.5c-.23-17.82,27.58-17.82,27.58,0S138.88,286.48,139.11,268.65ZM218.6,168.24A79.65,79.65,0,0,1,205.15,174a12.76,12.76,0,0,0-6.29,4.65L167.54,222a1.36,1.36,0,0,1-2.46-.8v-35.8a2.58,2.58,0,0,0-3.06-2.53c-15.43,3-30.23,7.7-42.73,19.94-38.8,38-29.42,105.69,16.09,133.16a162.25,162.25,0,0,1-91.47-67.27C-3.86,182.26,34.5,47.25,138.37,25.66c46.89-9.75,118.25,5.16,123.73,62.83C265.15,120.64,246.56,152.89,218.6,168.24Z" fill="url(#gradient)"/>
                </g>
            </svg>
            <span class="converse-brand__text">
                <span>converse<span class="subdued">.js</span></span>
                <p class="byline">messaging freedom</p>
            </span>
        </div>
        ${ api.settings.get('view_mode') === 'overlayed' ? html`<div class="converse-brand__padding"></div>` : '' }
    </div>`;
