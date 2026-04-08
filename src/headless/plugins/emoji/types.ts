export type EmojiData = {
    sn: string;
    cp: string;
    sns: string;
    c: string;
    url?: string; // for custom emojis
};

export type EmojiDataByUnicode = Record<string, EmojiData>;

export type EmojiReference = {
    cp: string;
    begin: number;
    end: number;
    shortname: string;
    emoji: string | null
};
