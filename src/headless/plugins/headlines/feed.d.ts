declare const HeadlinesFeed_base: any;
export default class HeadlinesFeed extends HeadlinesFeed_base {
    [x: string]: any;
    defaults(): {
        bookmarked: boolean;
        hidden: boolean;
        message_type: string;
        num_unread: number;
        time_opened: any;
        type: string;
    };
    initialize(): Promise<void>;
}
export {};
