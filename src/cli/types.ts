export type IO = {
    out(text: string): void; // Results
    err(text: string): void; // Errors, and what to do about them
    env: NodeJS.ProcessEnv;
    stdin?: NodeJS.ReadStream; // Where `send` reads a body given no text
    // Aborts when the user stops the command: Ctrl-C, SIGTERM, or a closed stdout. Only a
    // command that runs until stopped asks for it, since asking keeps those from ending the process.
    stopSignal?(): AbortSignal;
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
    batch?: string; // Seconds a stream gathers events for, before printing them together
    drafts?: boolean; // Stream draft events too
    inbox?: boolean; // Stream the inbox: catch up first, and mark what's printed seen
    account?: string; // The account's name, which picks its daemon
    all?: boolean; // Every account's, for "daemon status"
    'reply-to'?: string; // The id of the message a send replies to
    correct?: string; // The id of our message a send corrects
    at?: string; // When a send is scheduled for
    unencrypted?: boolean; // Resend without encryption
    remove?: boolean; // Withdraw a reaction
    nick?: string; // The nickname to join a room with
};

export type Context = IO & {
    args: string[]; // The positionals after the command's name
    options: Options;
    hello?: import('@converse/daemon/types').Hello; // The daemon's, once a request has connected
    socket_path?: string; // The socket that request reached the daemon on
};

// A command line option, as a command declares it. Declare one with flag() or option().
export type Option = {
    name: string; // The long name, without the dashes
    type: 'boolean' | 'string'; // Whether it takes a value
    value?: string; // How help shows the value it takes, such as "<n>"
    short?: string; // The one-letter name, if it has one
    help: string; // What it does
};

// A command: what help says about it, and what it does.
export type Command = {
    summary: string; // One line, for the overview
    description: string; // Paragraphs, separated by blank lines
    args?: [string, string][]; // Each argument, and what it is
    options?: Option[];
    exits?: number[]; // The exit codes besides those every command has
    examples: string[];
    run(ctx: Context): number | Promise<number>; // Resolves to the exit code
};
