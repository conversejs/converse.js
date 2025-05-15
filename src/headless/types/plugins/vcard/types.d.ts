import { ModelOptions } from '../../shared/types';
export interface VCardModelOptions extends ModelOptions {
    lazy_load?: boolean;
}
export interface VCardResult {
    email?: string;
    fullname?: string;
    image?: string;
    image_hash?: string;
    image_type?: string;
    nickname?: string;
    role?: string;
    stanza: Element;
    error?: Error;
    url?: string;
    vcard_error?: string;
    vcard_updated?: string;
}
export type VCardData = {
    fn?: string;
    nickname?: string;
    role?: string;
    email?: string;
    url?: string;
    image_type?: string;
    image?: string;
};
//# sourceMappingURL=types.d.ts.map