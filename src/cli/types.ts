export type IO = {
    out(text: string): void; // Results
    err(text: string): void; // Errors, and what to do about them
    env: NodeJS.ProcessEnv;
};

export type Context = IO & {
    json: boolean; // Print JSON rather than text
};
