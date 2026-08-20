import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { __ } from 'i18n';

/**
 * The heading above the reply list: "N comments" under a post, "N replies" under
 * a focused comment.
 * @param {number} count
 * @param {boolean} is_reply
 * @returns {string}
 */
function repliesHeading(count, is_reply) {
    if (is_reply) {
        return count === 0 ? __('Replies') : count === 1 ? __('1 reply') : __('%1$s replies', count);
    }
    return count === 0 ? __('Comments') : count === 1 ? __('1 comment') : __('%1$s comments', count);
}

/**
 * @param {import('../post.js').default} el
 */
export default (el) => {
    const post = el.model;
    const focused = el.focused;
    const { replies, ancestors, likeCount } = el.getView();

    return html`
        <div class="social-post-detail">
            <header class="social-post-detail__bar">
                <button
                    type="button"
                    class="social-post-detail__back"
                    @click=${() => el.onBack()}
                    title="${__('Back')}"
                    aria-label="${__('Back')}"
                >
                    <converse-icon size="1em" class="fa fa-arrow-left"></converse-icon>
                    <span>${__('Back')}</span>
                </button>
            </header>

            <!-- The post as context; below it the ancestor chain (each drillable),
                 ending at the focused item. -->
            <converse-social-message
                class="social-post-detail__context"
                .model=${post}
                ?compact=${true}
            ></converse-social-message>

            ${ancestors.map(
                (c) => html`<converse-social-message
                    class="social-comment social-post-detail__ancestor"
                    .model=${c}
                    ?threaditem=${true}
                ></converse-social-message>`,
            )}

            ${focused
                ? html`<converse-social-message
                      class="social-comment social-post-detail__focused"
                      .model=${focused}
                      ?threaditem=${true}
                  ></converse-social-message>`
                : likeCount
                  ? html`<div class="social-post-detail__likes">
                        <converse-icon size="0.9em" class="fa fa-heart"></converse-icon>
                        <span>${likeCount === 1 ? __('1 like') : __('%1$s likes', likeCount)}</span>
                    </div>`
                  : ''}

            <section class="social-comments">
                <h4 class="social-comments__heading">${repliesHeading(replies.length, !!focused)}</h4>

                <div class="social-comments__list">
                    ${replies.length
                        ? repeat(
                              replies,
                              /** @param {import('@converse/headless').PubSubMessage} c */ (c) => c.get('id'),
                              (c) =>
                                  html`<converse-social-message
                                      class="social-comment"
                                      .model=${c}
                                      ?threaditem=${true}
                                  ></converse-social-message>`,
                          )
                        : html`<p class="social-feed__empty">
                              ${focused ? __('No replies yet.') : __('No comments yet. Be the first to reply.')}
                          </p>`}
                </div>

                <form class="social-comment-compose" @submit=${(ev) => el.onSubmit(ev)}>
                    <textarea
                        class="social-comment-compose__textarea"
                        rows="2"
                        placeholder="${focused ? __('Write a reply…') : __('Write a comment…')}"
                        @keydown=${(ev) => el.onKeyDown(ev)}
                    ></textarea>
                    <div class="social-comment-compose__toolbar">
                        <button type="submit" class="btn btn-primary" ?disabled=${el._submitting}>
                            ${focused ? __('Reply') : __('Comment')}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    `;
};
