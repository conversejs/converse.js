/**
 * @module screen-reader-announcer
 * @description Componente para anunciar mensajes a lectores de pantalla
 */

import { html } from 'lit';
import { CustomElement } from './element.js';
import { api } from '@converse/headless';

/**
 * Componente que proporciona una región ARIA live para anuncios
 */
export default class ScreenReaderAnnouncer extends CustomElement {
    
    static get properties() {
        return {
            message: { type: String, state: true },
            priority: { type: String, state: true }
        };
    }

    constructor() {
        super();
        this.message = '';
        this.priority = 'polite';
        this._clearTimer = null;
    }

    render() {
        return html`
            <div 
                role="log" 
                aria-live="${this.priority}"
                aria-atomic="true"
                aria-relevant="additions text"
                class="sr-only"
                style="position: absolute; left: -10000px; width: 1px; height: 1px; overflow: hidden;"
            >
                ${this.message}
            </div>
        `;
    }

    /**
     * Anuncia un mensaje
     * @param {string} text - Texto a anunciar
     * @param {('polite'|'assertive')} [priority='polite'] - Prioridad del anuncio
     */
    announce(text, priority = 'polite') {
        // Limpiar cualquier temporizador previo
        if (this._clearTimer) {
            clearTimeout(this._clearTimer);
        }

        // Primero limpiar el mensaje para asegurar que se detecte el cambio
        this.message = '';
        this.priority = priority;
        
        // After a brief delay, set the new message
        requestAnimationFrame(() => {
            this.message = text;
            
            // Clear after 5 seconds
            this._clearTimer = setTimeout(() => {
                this.message = '';
            }, 5000);
        });
    }

    disconnectedCallback() {
        if (this._clearTimer) {
            clearTimeout(this._clearTimer);
        }
        super.disconnectedCallback();
    }
}

api.elements.define('converse-screen-reader-announcer', ScreenReaderAnnouncer);
