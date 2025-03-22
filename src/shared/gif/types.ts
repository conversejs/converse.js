export interface ConverseGifOptions {
    autoplay?: boolean;
    height?: number; // The height, in pixels, of the canvas
    loop?: boolean; // Setting this to `true` will enable looping of the gif
    max_width?: number; // Scale images over max_width down to max_width. Helpful with mobile.
    onIterationEnd?: (gifElement: HTMLElement) => void; // Callback for when the gif reaches the end of a single loop (one iteration)
    progress_bar_height?: number; // Default is 5
    progress_bg_color?: string; // Default is 'rgba(0,0,0,0.4)'
    progress_color?: string; // Default is 'rgba(255,0,22,.8)'
    show_progress_bar?: boolean;
    width?: number; // The width, in pixels, of the canvas
}
