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
    static properties: {
        model: {
            type: ObjectConstructor;
        };
    };
    model: any;
    /** @type {import('./types').ComposerPanelEntry[]} */
    panels: import("./types").ComposerPanelEntry[];
    initialize(): Promise<void>;
    render(): import("lit-html").TemplateResult[];
    #private;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=composer-panels.d.ts.map