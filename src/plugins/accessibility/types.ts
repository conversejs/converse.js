export type KeyboardShortcut = {
    label: string; // The key combination as shown to the user, e.g. `Alt+Shift+↓`
    description: string; // What the shortcut does, translated
    matches: (_ev: KeyboardEvent) => boolean; // Whether the pressed keys are this shortcut
    handler: () => void; // Called when the shortcut is pressed
};
