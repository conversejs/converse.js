export default ControlBoxView;
/**
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 */
declare class ControlBoxView extends CustomElement {
    initialize(): void;
    setModel(): void;
    model: any;
    render(): import("lit").TemplateResult<1> | "";
    close(ev: any): this | undefined;
    afterShown(): this;
}
import { CustomElement } from 'shared/components/element.js';
//# sourceMappingURL=controlbox.d.ts.map