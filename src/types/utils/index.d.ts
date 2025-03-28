declare const _default: {
    getRandomInt: typeof import("headless/types/utils/index.js").getRandomInt;
    getUniqueId: typeof import("headless/types/utils/index.js").getUniqueId;
    isEmptyMessage: typeof import("headless/types/utils/index.js").isEmptyMessage;
    onMultipleEvents: (events: any[], callback: Function) => void;
    prefixMentions: typeof import("headless/types/utils/index.js").prefixMentions;
    shouldCreateMessage: (attrs: any) => any;
    triggerEvent: (el: Element, name: string, type?: string, bubbles?: boolean, cancelable?: boolean) => void;
    isValidURL(text: string): boolean;
    getURL(url: string | URL): URL;
    checkFileTypes(types: string[], url: string | URL): boolean;
    isURLWithImageExtension(url: string | URL): boolean;
    isGIFURL(url: string | URL): boolean;
    isAudioURL(url: string | URL, headers?: Headers): boolean;
    isVideoURL(url: string | URL, headers?: Headers): boolean;
    isImageURL(url: string | URL, headers?: Headers): boolean;
    isEncryptedFileURL(url: string | URL): boolean;
    withinString(string: string, callback: Function, options?: import("headless/types/utils/types.js").ProcessStringOptions): string;
    getHeaders(url: string): Promise<Headers>;
    getMetadataForURL(o: import("headless/types/utils/types.js").MediaURLIndexes): Promise<import("headless/types/utils/types.js").MediaURLMetadata>;
    getMediaURLsMetadata(text: string, offset?: number): Promise<{
        media_urls?: import("headless/types/utils/types.js").MediaURLMetadata[];
    }>;
    getMediaURLs(arr: Array<import("headless/types/utils/types.js").MediaURLMetadata>, text: string): import("headless/types/utils/types.js").MediaURLMetadata[];
    addMediaURLsOffset(arr: Array<import("headless/types/utils/types.js").MediaURLMetadata>, text: string, offset?: number): import("headless/types/utils/types.js").MediaURLMetadata[];
    firstCharToUpperCase(text: string): string;
    getLongestSubstring(string: string, candidates: string[]): string;
    isString(s: any): boolean;
    getDefaultStore(): "session" | "persistent";
    createStore(id: any, store: any): any;
    initStorage(model: any, id: any, type: any): void;
    isErrorStanza(stanza: Element): boolean;
    isForbiddenError(stanza: Element): boolean;
    isServiceUnavailableError(stanza: Element): boolean;
    getAttributes(stanza: Element): object;
    toStanza: typeof import("strophe.js").Stanza.toElement;
    isUniView(): boolean;
    isTestEnv(): boolean;
    getUnloadEvent(): "pagehide" | "beforeunload" | "unload";
    replacePromise(_converse: ConversePrivateGlobal, name: string): void;
    shouldClearCache(_converse: ConversePrivateGlobal): boolean;
    tearDown(_converse: ConversePrivateGlobal): Promise<any>;
    clearSession(_converse: ConversePrivateGlobal): any;
    waitUntil(func: Function, max_wait?: number, check_delay?: number): Promise<any>;
    getOpenPromise: any;
    merge(dst: any, src: any): void;
    isError(obj: unknown): boolean;
    isFunction(val: unknown): boolean;
    isUndefined(x: unknown): boolean;
    isErrorObject(o: unknown): boolean;
    isPersistableModel(model: import("@converse/skeletor").Model): boolean;
    isValidJID(jid?: string | null): boolean;
    isValidMUCJID(jid: string): boolean;
    isSameBareJID(jid1: string, jid2: string): boolean;
    isSameDomain(jid1: string, jid2: string): boolean;
    getJIDFromURI(jid: string): string;
    initPlugins(_converse: ConversePrivateGlobal): void;
    initClientConfig(_converse: ConversePrivateGlobal): Promise<void>;
    initSessionStorage(_converse: ConversePrivateGlobal): Promise<void>;
    initPersistentStorage(_converse: ConversePrivateGlobal, store_name: string, key?: string): void;
    setUserJID(jid: string): Promise<string>;
    initSession(_converse: ConversePrivateGlobal, jid: string): Promise<void>;
    registerGlobalEventHandlers(_converse: ConversePrivateGlobal): void;
    cleanup(_converse: ConversePrivateGlobal): Promise<void>;
    attemptNonPreboundSession(credentials?: import("headless/types/utils/types.js").Credentials, automatic?: boolean): Promise<void>;
    savedLoginInfo(jid: string): Promise<import("@converse/skeletor").Model>;
    safeSave(model: import("@converse/skeletor").Model, attributes: any, options: any): void;
    isElement(el: unknown): boolean;
    isTagEqual(stanza: Element | typeof import("strophe.js").Builder, name: string): boolean;
    stringToElement(s: string): Element;
    queryChildren(el: HTMLElement, selector: string): ChildNode[];
    siblingIndex(el: Element): number;
    decodeHTMLEntities(str: string): string;
    getSelectValues(select: HTMLSelectElement): string[];
    webForm2xForm(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): Element;
    getCurrentWord(input: HTMLInputElement | HTMLTextAreaElement, index?: number, delineator?: string | RegExp): string;
    isMentionBoundary(s: string): boolean;
    replaceCurrentWord(input: HTMLInputElement, new_value: string): void;
    placeCaretAtEnd(textarea: HTMLTextAreaElement): void;
    colorize(s: string): Promise<string>;
    appendArrayBuffer(buffer1: any, buffer2: any): ArrayBufferLike;
    arrayBufferToHex(ab: any): any;
    arrayBufferToString(ab: any): string;
    stringToArrayBuffer(string: any): ArrayBufferLike;
    arrayBufferToBase64(ab: any): string;
    base64ToArrayBuffer(b64: any): ArrayBufferLike;
    hexToArrayBuffer(hex: any): ArrayBufferLike;
    unique<T extends unknown>(arr: Array<T>): Array<T>;
} & import("headless/types/utils/index.js").CommonUtils & import("headless/types/utils/index.js").PluginUtils & {
    isDomainWhitelisted(whitelist: string[], url: string | URL): boolean;
    isDomainAllowed(url: string | URL, setting: string): boolean;
    isMediaURLDomainAllowed(o: import("headless/types/utils/types.js").MediaURLMetadata): boolean;
    shouldRenderMediaFromURL(url_text: string, type: "audio" | "image" | "video"): any;
    filterQueryParamsFromURL(url: string): string;
    getNameAndValue(field: HTMLInputElement | HTMLSelectElement): {
        [key: string]: string | number | string[];
    } | null;
    getFileName(url: string): string;
    hasClass(className: string, el: Element): boolean;
    addClass(className: string, el: Element): Element;
    removeClass(className: string, el: Element): Element;
    removeElement(el: Element): Element;
    ancestor(el: HTMLElement, selector: string): HTMLElement;
    getHyperlinkTemplate(url: string): TemplateResult | string;
    slideOut(el: HTMLElement, duration?: number): Promise<any>;
    slideIn(el: HTMLElement, duration?: number): Promise<any>;
    xFormField2TemplateResult(xfield: import("headless/shared/types.js").XFormField, options?: any): TemplateResult;
    getOuterWidth(el: HTMLElement, include_margin?: boolean): number;
    getRootElement(): any;
    default: {
        getRandomInt: typeof import("headless/types/utils/index.js").getRandomInt;
        getUniqueId: typeof import("headless/types/utils/index.js").getUniqueId;
        isEmptyMessage: typeof import("headless/types/utils/index.js").isEmptyMessage;
        onMultipleEvents: (events: any[], callback: Function) => void;
        prefixMentions: typeof import("headless/types/utils/index.js").prefixMentions;
        shouldCreateMessage: (attrs: any) => any;
        triggerEvent: (el: Element, name: string, type?: string, bubbles?: boolean, cancelable?: boolean) => void;
        isValidURL(text: string): boolean;
        getURL(url: string | URL): URL;
        checkFileTypes(types: string[], url: string | URL): boolean;
        isURLWithImageExtension(url: string | URL): boolean;
        isGIFURL(url: string | URL): boolean;
        isAudioURL(url: string | URL, headers?: Headers): boolean;
        isVideoURL(url: string | URL, headers?: Headers): boolean;
        isImageURL(url: string | URL, headers?: Headers): boolean;
        isEncryptedFileURL(url: string | URL): boolean;
        withinString(string: string, callback: Function, options?: import("headless/types/utils/types.js").ProcessStringOptions): string;
        getHeaders(url: string): Promise<Headers>;
        getMetadataForURL(o: import("headless/types/utils/types.js").MediaURLIndexes): Promise<import("headless/types/utils/types.js").MediaURLMetadata>;
        getMediaURLsMetadata(text: string, offset?: number): Promise<{
            media_urls?: import("headless/types/utils/types.js").MediaURLMetadata[];
        }>;
        getMediaURLs(arr: Array<import("headless/types/utils/types.js").MediaURLMetadata>, text: string): import("headless/types/utils/types.js").MediaURLMetadata[];
        addMediaURLsOffset(arr: Array<import("headless/types/utils/types.js").MediaURLMetadata>, text: string, offset?: number): import("headless/types/utils/types.js").MediaURLMetadata[];
        firstCharToUpperCase(text: string): string;
        getLongestSubstring(string: string, candidates: string[]): string;
        isString(s: any): boolean;
        getDefaultStore(): "session" | "persistent";
        createStore(id: any, store: any): any;
        initStorage(model: any, id: any, type: any): void;
        isErrorStanza(stanza: Element): boolean;
        isForbiddenError(stanza: Element): boolean;
        isServiceUnavailableError(stanza: Element): boolean;
        getAttributes(stanza: Element): object;
        toStanza: typeof import("strophe.js").Stanza.toElement;
        isUniView(): boolean;
        isTestEnv(): boolean;
        getUnloadEvent(): "pagehide" | "beforeunload" | "unload";
        replacePromise(_converse: ConversePrivateGlobal, name: string): void;
        shouldClearCache(_converse: ConversePrivateGlobal): boolean;
        tearDown(_converse: ConversePrivateGlobal): Promise<any>;
        clearSession(_converse: ConversePrivateGlobal): any;
        waitUntil(func: Function, max_wait?: number, check_delay?: number): Promise<any>;
        getOpenPromise: any;
        merge(dst: any, src: any): void;
        isError(obj: unknown): boolean;
        isFunction(val: unknown): boolean;
        isUndefined(x: unknown): boolean;
        isErrorObject(o: unknown): boolean;
        isPersistableModel(model: import("@converse/skeletor").Model): boolean;
        isValidJID(jid?: string | null): boolean;
        isValidMUCJID(jid: string): boolean;
        isSameBareJID(jid1: string, jid2: string): boolean;
        isSameDomain(jid1: string, jid2: string): boolean;
        getJIDFromURI(jid: string): string;
        initPlugins(_converse: ConversePrivateGlobal): void;
        initClientConfig(_converse: ConversePrivateGlobal): Promise<void>;
        initSessionStorage(_converse: ConversePrivateGlobal): Promise<void>;
        initPersistentStorage(_converse: ConversePrivateGlobal, store_name: string, key?: string): void;
        setUserJID(jid: string): Promise<string>;
        initSession(_converse: ConversePrivateGlobal, jid: string): Promise<void>;
        registerGlobalEventHandlers(_converse: ConversePrivateGlobal): void;
        cleanup(_converse: ConversePrivateGlobal): Promise<void>;
        attemptNonPreboundSession(credentials?: import("headless/types/utils/types.js").Credentials, automatic?: boolean): Promise<void>;
        savedLoginInfo(jid: string): Promise<import("@converse/skeletor").Model>;
        safeSave(model: import("@converse/skeletor").Model, attributes: any, options: any): void;
        isElement(el: unknown): boolean;
        isTagEqual(stanza: Element | typeof import("strophe.js").Builder, name: string): boolean;
        stringToElement(s: string): Element;
        queryChildren(el: HTMLElement, selector: string): ChildNode[];
        siblingIndex(el: Element): number;
        decodeHTMLEntities(str: string): string;
        getSelectValues(select: HTMLSelectElement): string[];
        webForm2xForm(field: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement): Element;
        getCurrentWord(input: HTMLInputElement | HTMLTextAreaElement, index?: number, delineator?: string | RegExp): string;
        isMentionBoundary(s: string): boolean;
        replaceCurrentWord(input: HTMLInputElement, new_value: string): void;
        placeCaretAtEnd(textarea: HTMLTextAreaElement): void;
        colorize(s: string): Promise<string>;
        appendArrayBuffer(buffer1: any, buffer2: any): ArrayBufferLike;
        arrayBufferToHex(ab: any): any;
        arrayBufferToString(ab: any): string;
        stringToArrayBuffer(string: any): ArrayBufferLike;
        arrayBufferToBase64(ab: any): string;
        base64ToArrayBuffer(b64: any): ArrayBufferLike;
        hexToArrayBuffer(hex: any): ArrayBufferLike;
        unique<T extends unknown>(arr: Array<T>): Array<T>;
    } & import("headless/types/utils/index.js").CommonUtils & import("headless/types/utils/index.js").PluginUtils;
    isImageWithAlphaChannel(image_file: File): Promise<boolean>;
    compressImage(file: File, options?: CompressionOptions): Promise<Blob>;
    MIMETYPES_MAP: {
        aac: string;
        abw: string;
        arc: string;
        avi: string;
        azw: string;
        bin: string;
        bmp: string;
        bz: string;
        bz2: string;
        cda: string;
        csh: string;
        css: string;
        csv: string;
        doc: string;
        docx: string;
        eot: string;
        epub: string;
        gif: string;
        gz: string;
        htm: string;
        html: string;
        ico: string;
        ics: string;
        jar: string;
        jpeg: string;
        jpg: string;
        js: string;
        json: string;
        jsonld: string;
        m4a: string;
        mid: string;
        midi: string;
        mjs: string;
        mp3: string;
        mp4: string;
        mpeg: string;
        mpkg: string;
        odp: string;
        ods: string;
        odt: string;
        oga: string;
        ogv: string;
        ogx: string;
        opus: string;
        otf: string;
        png: string;
        pdf: string;
        php: string;
        ppt: string;
        pptx: string;
        rar: string;
        rtf: string;
        sh: string;
        svg: string;
        swf: string;
        tar: string;
        tif: string;
        tiff: string;
        ts: string;
        ttf: string;
        txt: string;
        vsd: string;
        wav: string;
        weba: string;
        webm: string;
        webp: string;
        woff: string;
        woff2: string;
        xhtml: string;
        xls: string;
        xlsx: string;
        xml: string;
        xul: string;
        zip: string;
        '3gp': string;
        '3g2': string;
        '7z': string;
    };
    getAuthorStyle(occupant: any): string | TemplateResult;
};
export default _default;
import * as html from "./html.js";
import * as file from "./file.js";
import * as color from "./color.js";
//# sourceMappingURL=index.d.ts.map