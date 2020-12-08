import { _converse, api } from '@converse/headless/core';
import { applyDragResistance } from './utils.js';
import { debounce } from 'lodash-es';

const DragResizableMixin = {
    initDragResize () {
        const view = this;
        const debouncedSetDimensions = debounce(() => view.setDimensions());
        window.addEventListener('resize', view.debouncedSetDimensions);
        this.listenTo(this.model, 'destroy', () => window.removeEventListener('resize', debouncedSetDimensions));

        // Determine and store the default box size.
        // We need this information for the drag-resizing feature.
        const flyout = this.querySelector('.box-flyout');
        const style = window.getComputedStyle(flyout);

        if (this.model.get('height') === undefined) {
            const height = parseInt(style.height.replace(/px$/, ''), 10);
            const width = parseInt(style.width.replace(/px$/, ''), 10);
            this.model.set('height', height);
            this.model.set('default_height', height);
            this.model.set('width', width);
            this.model.set('default_width', width);
        }
        const min_width = style['min-width'];
        const min_height = style['min-height'];
        this.model.set('min_width', min_width.endsWith('px') ? Number(min_width.replace(/px$/, '')) : 0);
        this.model.set('min_height', min_height.endsWith('px') ? Number(min_height.replace(/px$/, '')) : 0);
        // Initialize last known mouse position
        this.prev_pageY = 0;
        this.prev_pageX = 0;
        if (_converse.connection?.connected) {
            this.height = this.model.get('height');
            this.width = this.model.get('width');
        }
        return this;
    },

    resizeChatBox (ev) {
        let diff;
        if (_converse.resizing.direction.indexOf('top') === 0) {
            diff = ev.pageY - this.prev_pageY;
            if (diff) {
                this.height =
                    this.height - diff > (this.model.get('min_height') || 0)
                        ? this.height - diff
                        : this.model.get('min_height');
                this.prev_pageY = ev.pageY;
                this.setChatBoxHeight(this.height);
            }
        }
        if (_converse.resizing.direction.includes('left')) {
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
    },

    setWidth () {
        // If a custom width is applied (due to drag-resizing),
        // then we need to set the width of the .chatbox element as well.
        if (this.model.get('width')) {
            this.style.width = this.model.get('width');
        }
    },

    setDimensions () {
        // Make sure the chat box has the right height and width.
        this.adjustToViewport();
        this.setChatBoxHeight(this.model.get('height'));
        this.setChatBoxWidth(this.model.get('width'));
    },

    setChatBoxHeight (height) {
        if (height) {
            height = applyDragResistance(height, this.model.get('default_height')) + 'px';
        } else {
            height = '';
        }
        const flyout_el = this.querySelector('.box-flyout');
        if (flyout_el !== null) {
            flyout_el.style.height = height;
        }
    },

    setChatBoxWidth (width) {
        if (width) {
            width = applyDragResistance(width, this.model.get('default_width')) + 'px';
        } else {
            width = '';
        }
        this.style.width = width;
        const flyout_el = this.querySelector('.box-flyout');
        if (flyout_el !== null) {
            flyout_el.style.width = width;
        }
    },

    adjustToViewport () {
        /* Event handler called when viewport gets resized. We remove
         * custom width/height from chat boxes.
         */
        const viewport_width = Math.max(document.documentElement.clientWidth, window.innerWidth || 0);
        const viewport_height = Math.max(document.documentElement.clientHeight, window.innerHeight || 0);
        if (viewport_width <= 480) {
            this.model.set('height', undefined);
            this.model.set('width', undefined);
        } else if (viewport_width <= this.model.get('width')) {
            this.model.set('width', undefined);
        } else if (viewport_height <= this.model.get('height')) {
            this.model.set('height', undefined);
        }
    },

    onStartVerticalResize (ev, trigger = true) {
        if (!api.settings.get('allow_dragresize')) {
            return true;
        }
        ev.preventDefault();
        // Record element attributes for mouseMove().
        const flyout = this.querySelector('.box-flyout'),
            style = window.getComputedStyle(flyout);
        this.height = parseInt(style.height.replace(/px$/, ''), 10);
        _converse.resizing = {
            'chatbox': this,
            'direction': 'top'
        };
        this.prev_pageY = ev.pageY;
        if (trigger) {
            /**
             * Triggered once the user starts to vertically resize a {@link _converse.ChatBoxView}
             * @event _converse#startVerticalResize
             * @example _converse.api.listen.on('startVerticalResize', (view) => { ... });
             */
            api.trigger('startVerticalResize', this);
        }
    },

    onStartHorizontalResize (ev, trigger = true) {
        if (!api.settings.get('allow_dragresize')) {
            return true;
        }
        ev.preventDefault();
        const flyout = this.querySelector('.box-flyout');
        const style = window.getComputedStyle(flyout);
        this.width = parseInt(style.width.replace(/px$/, ''), 10);
        _converse.resizing = {
            'chatbox': this,
            'direction': 'left'
        };
        this.prev_pageX = ev.pageX;
        if (trigger) {
            /**
             * Triggered once the user starts to horizontally resize a {@link _converse.ChatBoxView}
             * @event _converse#startHorizontalResize
             * @example _converse.api.listen.on('startHorizontalResize', (view) => { ... });
             */
            api.trigger('startHorizontalResize', this);
        }
    },

    onStartDiagonalResize (ev) {
        this.onStartHorizontalResize(ev, false);
        this.onStartVerticalResize(ev, false);
        _converse.resizing.direction = 'topleft';
        /**
         * Triggered once the user starts to diagonally resize a {@link _converse.ChatBoxView}
         * @event _converse#startDiagonalResize
         * @example _converse.api.listen.on('startDiagonalResize', (view) => { ... });
         */
        api.trigger('startDiagonalResize', this);
    }
};

export default DragResizableMixin;
