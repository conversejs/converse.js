export default ControlBox;
/**
 * The ControlBox is the section of the chat that contains the open groupchats,
 * bookmarks and roster.
 *
 * In `overlayed` `view_mode` it's a box like the chat boxes, in `fullscreen`
 * `view_mode` it's a left-aligned sidebar.
 */
declare class ControlBox {
    initialize(): void;
    setModel(): void;
    model: any;
    render(): "" | import("lit-html").TemplateResult<1>;
    close(ev: any): ControlBox;
    afterShown(): ControlBox;
}
