import { html } from 'lit';
import { __ } from 'i18n';

/**
 * @param {import('../discover.js').default} el
 */
export default (el) => {
    const preview = el.preview;
    return html`<div class="modal-body social-discover">
        <section class="social-discover__section">
            <h4 class="social-discover__heading">${__('Find people to follow')}</h4>
            <p class="form-text text-muted">${__('Scan your contacts for anyone with a social feed.')}</p>
            <converse-social-scan></converse-social-scan>
            <converse-social-onboarding></converse-social-onboarding>
        </section>

        <hr class="social-discover__divider" />

        <section class="social-discover__section">
            <h4 class="social-discover__heading">${__('Follow a feed')}</h4>
            <p class="form-text text-muted">
                ${__('Follow a community or news feed that isn’t one of your contacts.')}
            </p>

            <p class="form-text text-muted">${__('Browse the feeds on a pubsub service:')}</p>
            <converse-social-browse></converse-social-browse>

            <details class="social-discover__manual mt-3">
                <summary>${__('Enter an address manually')}</summary>
                <p class="form-text text-muted mt-2">
                    ${__('Already know the exact address? Follow it directly.')}
                </p>
            <form class="converse-form" @submit=${(/** @type {Event} */ ev) => el.submit(ev)}>
                <div class="mb-3">
                    <label class="form-label clearfix" for="discover-feed-address">${__('Feed address')}:</label>
                    <input
                        type="text"
                        name="address"
                        id="discover-feed-address"
                        class="form-control"
                        autocomplete="off"
                        placeholder="news@example.org"
                        @input=${(/** @type {Event} */ ev) => el.onAddressInput(ev)}
                    />
                    <small class="form-text text-muted">
                        ${__('A JID (a person or a service), or an xmpp: address that includes a node.')}
                    </small>
                </div>

                <div class="mb-3">
                    <label class="form-label clearfix" for="discover-feed-name">${__('Name (optional)')}:</label>
                    <input type="text" name="title" id="discover-feed-name" class="form-control" autocomplete="off" />
                </div>

                <details class="mb-3">
                    <summary>${__('Advanced')}</summary>
                    <div class="mt-2">
                        <label class="form-label clearfix" for="discover-feed-node">${__('Node')}:</label>
                        <input
                            type="text"
                            name="node"
                            id="discover-feed-node"
                            class="form-control"
                            autocomplete="off"
                            placeholder="urn:xmpp:microblog:0"
                        />
                        <small class="form-text text-muted">
                            ${__('Overrides the node in the address. Leave blank for a personal feed.')}
                        </small>
                    </div>
                </details>

                ${preview
                    ? html`<p class="social-discover__preview text-muted">
                          ${__('Will follow %1$s (node %2$s)', preview.jid, preview.node)}
                      </p>`
                    : ''}

                <button type="submit" class="btn btn-primary" ?disabled=${el.submitting || !preview}>
                    ${el.submitting ? __('Following…') : __('Follow')}
                </button>
            </form>
            </details>
        </section>
    </div>`;
};
