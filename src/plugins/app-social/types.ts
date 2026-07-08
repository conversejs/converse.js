export type SocialRoute = {
    view: 'timeline' | 'profile' | 'post' | 'tag';
    jid?: string; // profile: the author's bare JID
    feedJid?: string; // post: the feed's service JID
    node?: string; // post: the feed's node (defaults to the microblog node)
    itemId?: string; // post: the PubSub item id
    tag?: string; // tag: the hashtag, without a leading '#'
};
