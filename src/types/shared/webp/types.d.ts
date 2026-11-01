export type WebPFrame = {
    bitmap: ImageBitmap;
    dims: {
        width: number;
        height: number;
        left: number;
        top: number;
    };
    delay: number;
};
export type WebPFrames = {
    frames: WebPFrame[];
    is_static: boolean;
};
//# sourceMappingURL=types.d.ts.map