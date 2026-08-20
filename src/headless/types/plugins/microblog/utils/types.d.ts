import PostComment from '../post-comment';
export type CommentTreeNode = {
    comment: PostComment;
    replies: CommentTreeNode[];
    parent: CommentTreeNode | null;
    orphan?: boolean;
};
export type CommentTreeMap = Map<string, CommentTreeNode>;
//# sourceMappingURL=types.d.ts.map