import log from '@converse/log';
import { api, u } from '@converse/headless';
import { applyDragResistance, getResizingDirection } from './utils.js';

/**
 * @template {import('shared/components/types').CustomElementExtender} T
 * @param {T} BaseCustomElement
 */
export default function DragResizable(BaseCustomElement) {
    return class DragResizableElement extends BaseCustomElement {
        /**
         * @param {any[]} args
         */
        constructor(...args) {
            super(args);
            this.model = null;
            api.settings.listen.on('change:view_mode', () => this.initDragResize());
        }

        /**
         * Called when the element's properties change.
         * @param {import('lit').PropertyValues} changed
         */
        updated(changed) {
            super.updated(changed);
            if (changed.has('model') && this.model) {
                this.initDragResize();
            }
        }

        initDragResize() {
            if (api.settings.get('view_mode') == 'overlayed') {
                this.setupDragResize();
            }
        }

        setupDragResize() {
            const debouncedSetDimensions = u.debounce(() => this.setDimensions(), 250);
            window.addEventListener('resize', debouncedSetDimensions);
            this.listenTo(this.model, 'destroy', () => window.removeEventListener('resize', debouncedSetDimensions));

            const flyout = /** @type {HTMLElement} */ (this.querySelector('.box-flyout'));
            this.model.set(this.getDefaultDimensions());

            const style = window.getComputedStyle(flyout);
            const min_width = style['min-width'];
            const min_height = style['min-height'];
            this.model.set('min_width', min_width.endsWith('px') ? Number(min_width.replace(/px$/, '')) : 0);
            this.model.set('min_height', min_height.endsWith('px') ? Number(min_height.replace(/px$/, '')) : 0);

            // Initialize last known mouse position
            this.prev_pageY = 0;
            this.prev_pageX = 0;
            this.height = this.model.get('height');
            this.width = this.model.get('width');
            return this;
        }

        /**
         * Returns the default height and width of a chat, i.e. what it
         * would have been if it wasn't resized.
         * @returns {{ default_height: number, default_width: number }}
         */
        getDefaultDimensions() {
            const flyout = /** @type {HTMLElement} */ (this.querySelector('.box-flyout'));
            if (!this.model.get('height') && !this.model.get('width')) {
                const style = window.getComputedStyle(flyout);
                return {
                    default_height: parseInt(style.height.replace(/px$/, ''), 10),
                    default_width: parseInt(style.width.replace(/px$/, ''), 10),
                };
            } else {
                const style = flyout.getAttribute('style');
                flyout.removeAttribute('style');
                const dimensions = {
                    default_height: flyout.offsetHeight,
                    default_width: flyout.offsetWidth,
                };
                flyout.setAttribute('style', style);
                return dimensions;
            }
        }

        setDimensions() {
            if (api.settings.get('view_mode') === 'overlayed') {
                this.setChatBoxWidth(this.model.get('width'));
                this.setChatBoxHeight(this.model.get('height'));
            }
        }

        /**
         * @param {MouseEvent} ev
         */
        resizeChatBox(ev) {
            let diff;
            const direction = getResizingDirection();
            if (direction.indexOf('top') === 0) {
                const margin = api.settings.get('dragresize_top_margin') ?? 0;
                const max_height = window.innerHeight - margin;
                diff = ev.pageY - this.prev_pageY;

                if (diff) {
                    const new_height = this.height - diff;
                    log.debug('------------');
                    log.debug(`window.innerHeight: ${window.innerHeight}`);
                    log.debug(`max_height: ${max_height}`);
                    log.debug(`new_height: ${new_height}`);
                    log.debug(`diff: ${diff}`);

                    this.height =
                        this.height - diff > (this.model.get('min_height') || 0)
                            ? new_height <= max_height
                                ? new_height
                                : max_height
                            : this.model.get('min_height');
                    this.prev_pageY = ev.pageY;
                    this.setChatBoxHeight(this.height);
                }
            }
            if (direction.includes('left')) {
                diff = this.prev_pageX - ev.pageX;
                if (diff) {
                    this.width =
                        this.width + diff > (this.model.get('min_width') || 0)
                            ? this.width + diff
                            : this.model.get('min_width');
                    this.prev_pageX = ev.pageX;
                    this.setChatBoxWidth(this.width);
                }
            }
        }

        /**
         * @param {number} height
         */
        setChatBoxHeight(height) {
            const flyout_el = /** @type {HTMLElement} */ (this.querySelector('.box-flyout'));
            if (flyout_el !== null) {
                flyout_el.style.height = height
                    ? applyDragResistance(height, this.model.get('default_height')) + 'px'
                    : '';
            }
        }

        /**
         * @param {number} width
         */
        setChatBoxWidth(width) {
            const style_width = width ? applyDragResistance(width, this.model.get('default_width')) + 'px' : '';
            this.style.width = style_width;
            const flyout_el = /** @type {HTMLElement} */ (this.querySelector('.box-flyout'));
            if (flyout_el !== null) {
                flyout_el.style.width = style_width;
            }
        }
    };
}
