/**
 * The Texture custom element allows you to parse transform text into rich DOM elements.
 * @example <converse-texture text="*_hello_ world!*"></converse-texture>
 */
export default class Texture extends LitElement {
    static get properties(): {
        embed_audio: {
            type: BooleanConstructor;
        };
        embed_videos: {
            type: BooleanConstructor;
        };
        mentions: {
            type: ArrayConstructor;
        };
        nick: {
            type: StringConstructor;
        };
        offset: {
            type: NumberConstructor;
        };
        onImgClick: {
            type: FunctionConstructor;
        };
        onImgLoad: {
            type: FunctionConstructor;
        };
        render_styling: {
            type: BooleanConstructor;
        };
        show_images: {
            type: BooleanConstructor;
        };
        hide_media_urls: {
            type: BooleanConstructor;
        };
        show_me_message: {
            type: BooleanConstructor;
        };
        text: {
            type: StringConstructor;
        };
    };
    createRenderRoot(): this;
    nick: any;
    onImgClick: any;
    onImgLoad: any;
    text: any;
    embed_audio: boolean;
    embed_videos: boolean;
    hide_media_urls: boolean;
    mentions: any[];
    offset: number;
    render_styling: boolean;
    show_image_urls: boolean;
    show_images: boolean;
    show_me_message: boolean;
    render(): import("lit/directive.js").DirectiveResult<{
        new (_partInfo: import("lit/directive.js").PartInfo): {
            render(text: string, offset: number, options: object, callback?: Function): import("lit").TemplateResult<1>;
            readonly _$isConnected: boolean;
            update(_part: import("lit").Part, props: Array<unknown>): unknown;
        };
    }>;
}
import { LitElement } from "lit";
//# sourceMappingURL=texture.d.ts.map