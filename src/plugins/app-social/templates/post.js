import { html } from 'lit';
import { repeat } from 'lit/directives/repeat.js';
import { __ } from 'i18n';

/**
 * @param {import('../post.js').default} el
 */
export default (el) => {
    const post = el.model;
    const comments = el.threadComments;

    return html`
        <div class="social-post-detail">
            <header class="social-post-detail__bar">
                <button
                    type="button"
                    class="social-post-detail__back"
                    @click=${() => el.goBack()}
                    title="${__('Back')}"
                    aria-label="${__('Back')}"
                >
                    <converse-icon size="1em" class="fa fa-arrow-left"></converse-icon>
                    <span>${__('Back')}</span>
                </button>
            </header>

            <converse-social-message .model=${post} ?compact=${true}></converse-social-message>

            <section class="social-comments">
                <h4 class="social-comments__heading">
                    ${comments.length === 0
                        ? __('Comments')
                        : comments.length === 1
                          ? __('1 comment')
                          : __('%1$s comments', comments.length)}
                </h4>

                <div class="social-comments__list">
                    ${comments.length
                        ? repeat(
                              comments,
                              /** @param {import('@converse/headless').PubSubMessage} c */ (c) => c.get('id'),
                              (c) =>
                                  html`<converse-social-message
                                      class="social-comment"
                                      .model=${c}
                                      ?compact=${true}
                                  ></converse-social-message>`,
                          )
                        : html`<p class="social-feed__empty">${__('No comments yet. Be the first to reply.')}</p>`}
                </div>

                <form class="social-comment-compose" @submit=${(ev) => el.onSubmit(ev)}>
                    <textarea
                        class="social-comment-compose__textarea"
                        rows="2"
                        placeholder="${__('Write a comment…')}"
                        @keydown=${(ev) => el.onKeyDown(ev)}
                    ></textarea>
                    <div class="social-comment-compose__toolbar">
                        <button type="submit" class="btn btn-primary" ?disabled=${el._submitting}>
                            ${__('Comment')}
                        </button>
                    </div>
                </form>
            </section>
        </div>
    `;
};
