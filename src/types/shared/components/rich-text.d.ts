/**
 * The RichText custom element allows you to parse transform text into rich DOM elements.
 * @example <converse-rich-text text="*_hello_ world!*"></converse-rich-text>
 */
export default class RichText extends CustomElement {
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
    render(): import("lit/directive").DirectiveResult<{
        new (_partInfo: import("lit/directive").PartInfo): {
            render(text: any, offset: any, options: any, callback: any): import("lit").TemplateResult<1>;
            readonly _$isConnected: boolean;
            update(_part: import("lit").Part, props: unknown[]): unknown;
        };
    }>;
}
import { CustomElement } from "shared/components/element.js";
//# sourceMappingURL=rich-text.d.ts.map