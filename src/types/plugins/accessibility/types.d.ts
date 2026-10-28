export type KeyboardShortcut = {
    label: string;
    description: string;
    matches: (_ev: KeyboardEvent) => boolean;
    handler: () => void;
};
//# sourceMappingURL=types.d.ts.map