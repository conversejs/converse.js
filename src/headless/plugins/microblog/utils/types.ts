import PostComment from '../post-comment';

export type CommentTreeNode = {
    comment: PostComment;
    replies: CommentTreeNode[];
    parent: CommentTreeNode | null;
    orphan?: boolean; // Set when a nesting pointer's parent isn't loaded;
};

export type CommentTreeMap = Map<string, CommentTreeNode>;
