import { api, log } from '@converse/headless';
import { CustomElement } from 'shared/components/element.js';

// Where a panel without a numeric `order` goes: below the built-in ones.
const DEFAULT_ORDER = 1000;

/**
 * The panels shown directly above the message form of a chat or groupchat.
 *
 * Plugins add panels through the `getComposerPanels` hook, which runs once when
 * the container is initialized. A handler may leave its panel out of chats it
 * never applies to. Anything that changes while the chat is open, the panel
 * decides for itself, so the container only has to lay the panels out in the
 * order they ask for.
 */
export default class ComposerPanels extends CustomElement {
    static properties = {
        model: { type: Object },
    };

    constructor() {
        super();
        this.model = null;
        /** @type {import('./types').ComposerPanelEntry[]} */
        this.panels = [];
    }

    async initialize() {
        await this.model.initialized;
        this.panels = await this.#getPanels();
        this.requestUpdate();
    }

    /**
     * @returns {Promise<import('./types').ComposerPanelEntry[]>}
     */
    async #getPanels() {
        let panels;
        try {
            panels = await api.hook('getComposerPanels', this, []);
        } catch (e) {
            log.error(e);
        }
        // Each handler gets what the previous one returned, so one that throws
        // or doesn't return the list leaves nothing to lay out.
        if (!Array.isArray(panels)) {
            log.error('getComposerPanels: a handler threw or did not return the list of panels, so none are shown');
            return [];
        }
        const orderOf = (/** @type {import('./types').ComposerPanelEntry} */ p) =>
            Number.isFinite(p.order) ? p.order : DEFAULT_ORDER;
        return [...panels].sort((a, b) => orderOf(a) - orderOf(b));
    }

    render() {
        return this.panels.map((panel) => panel.template);
    }
}

api.elements.define('converse-composer-panels', ComposerPanels);
