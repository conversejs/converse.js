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
    from?: string;
    conversation?: string;
    mention?: boolean;
    timeout?: string; // Seconds
};

export type Context = IO & {
    args: string[]; // The positionals after the command's name
    options: Options;
};

// How the help describes a command.
export type CommandHelp = {
    summary: string; // One line, for the overview
    description: string; // Paragraphs, separated by blank lines
    args?: [string, string][]; // Each argument, and what it is
    // Each option, with its value if it takes one, such as "--limit <n>", and what it does
    options?: [string, string][];
    exits?: number[]; // The exit codes besides those every command has
    examples: string[];
};
