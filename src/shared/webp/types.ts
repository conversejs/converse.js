export type WebPFrame = {
    bitmap: ImageBitmap;
    dims: { width: number; height: number; left: number; top: number };
    delay: number; // In milliseconds
};

export type WebPFrames = {
    frames: WebPFrame[];
    is_static: boolean; // Only a single frame, which has nothing to play and isn't decoded
};
