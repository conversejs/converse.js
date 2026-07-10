export type SocialRoute = {
    view: 'timeline' | 'profile' | 'post' | 'tag';
    jid?: string; // profile: the author's bare JID
    tab?: 'posts' | 'following'; // profile: which tab (defaults to posts)
    feedJid?: string; // post: the feed's service JID
    node?: string; // post/profile: the feed's node (profile: a non-microblog community feed)
    itemId?: string; // post: the PubSub item id
    tag?: string; // tag: the hashtag, without a leading '#'
};
