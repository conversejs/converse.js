export type KeyboardShortcut = {
    code: string; // The `KeyboardEvent.code` pressed together with Alt+Shift, e.g. `KeyH`
    label: string; // The key combination as shown to the user, e.g. `Alt+Shift+H`
    description: string; // What the shortcut does, translated
    handler: () => void; // Called when the shortcut is pressed
};
