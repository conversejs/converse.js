export default ChatBoxViews;
declare class ChatBoxViews {
    views: {};
    el: any;
    add(key: any, val: any): void;
    get(key: any): any;
    xget(id: any): {};
    getAll(): any[];
    keys(): string[];
    remove(key: any): void;
    map(f: any): any[];
    forEach(f: any): void;
    filter(f: any): any[];
    closeAllChatBoxes(): Promise<any[]>;
}
//# sourceMappingURL=container.d.ts.map