export type IO = {
    out(text: string): void; // Results
    err(text: string): void; // Errors, and what to do about them
    env: NodeJS.ProcessEnv;
    stdin?: NodeJS.ReadStream; // Where `send` reads a body given no text
};

export type Options = {
    json?: boolean; // Print JSON rather than text
    full?: boolean;
    limit?: string;
    before?: string;
    since?: string;
};

export type Context = IO & {
    args: string[]; // The positionals after the command's name
    options: Options;
};
