/**
 * The attachment button (a paperclip) in a chat's toolbar, and the attachment
 * menu it opens: one labelled row for each thing the user can attach.
 *
 * Plugins add items through the `getAttachmentMenuItems` hook, which runs once
 * when the menu is initialized. A handler may await a disco query, so that an
 * item appears once the server feature it needs is confirmed, and it may leave
 * its item out of chats where it doesn't apply. Without any items there is no
 * paperclip.
 */
export default class AttachmentMenu extends DropdownBase {
    static properties: {
        model: {
            type: ObjectConstructor;
        };
        items: {
            state: boolean;
        };
    };
    model: any;
    /** @type {import('./types').AttachmentMenuItem[]} */
    items: import("./types").AttachmentMenuItem[];
    _onKeyDown: (ev: KeyboardEvent) => void;
    _onShow: () => void;
    _onHide: () => void;
    initialize(): Promise<void>;
    /**
     * Resolves once the hook has run and `items` is set, so that the
     * paperclip is drawn, or known to be absent.
     * @type {Promise<void>}
     */
    initialized: Promise<void>;
    render(): import("lit-html").TemplateResult<1> | "";
    firstUpdated(): void;
    /**
     * Open the browser's file picker and send what the user chooses through
     * the chat's file-sending path, so that OMEMO encryption, size limits and
     * the upload progress message all apply. For an item to call from its
     * handler.
     * @param {Object} [options]
     * @param {string} [options.accept] - The accepted file types, as for the
     *  `accept` attribute of a file input, for example `image/*`. Any file by
     *  default. On a phone, accepting only images opens the photo gallery.
     */
    pickFiles({ accept }?: {
        accept?: string;
    }): void;
    #private;
}
import DropdownBase from 'shared/components/dropdownbase.js';
//# sourceMappingURL=attachment-menu.d.ts.map