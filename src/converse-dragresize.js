/**
 * @module converse-dragresize
 * @copyright 2020, the Converse.js contributors
 * @license Mozilla Public License (MPLv2)
 */
import "converse-chatview";
import "converse-controlbox";
import { debounce } from "lodash-es";
import { _converse, api, converse } from "@converse/headless/converse-core";
import tpl_dragresize from "templates/dragresize.html";

const u = converse.env.utils;

function renderDragResizeHandles (_converse, view) {
    const flyout = view.el.querySelector('.box-flyout');
    const div = document.createElement('div');
    div.innerHTML = tpl_dragresize();
    flyout.insertBefore(
        div,
        flyout.firstChild
    );
}


converse.plugins.add('converse-dragresize', {
    /* Plugin dependencies are other plugins which might be
     * overridden or relied upon, and therefore need to be loaded before
     * this plugin.
     *
     * If the setting "strict_plugin_dependencies" is set to true,
     * an error will be raised if the plugin is not found. By default it's
     * false, which means these plugins are only loaded opportunistically.
     *
     * NB: These plugins need to have already been loaded via require.js.
     */
    dependencies: ["converse-chatview", "converse-headlines-view", "converse-muc-views"],

    enabled (_converse) {
        return _converse.api.settings.get("view_mode") == 'overlayed';
    },

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        ChatBox: {
            initialize () {
                const result = this.__super__.initialize.apply(this, arguments);
                const height = this.get('height'), width = this.get('width');
                const save = this.get('id') === 'controlbox' ? a => this.set(a) : a => this.save(a);
                save({
                    'height': u.applyDragResistance(height, this.get('default_height')),
                    'width': u.applyDragResistance(width, this.get('default_width')),
                });
                return result;
            }
        },

        ChatBoxView: {
            events: {
                'mousedown .dragresize-top': 'onStartVerticalResize',
                'mousedown .dragresize-left': 'onStartHorizontalResize',
                'mousedown .dragresize-topleft': 'onStartDiagonalResize'
            },

            render () {
                const result = this.__super__.render.apply(this, arguments);
                renderDragResizeHandles(this.__super__._converse, this);
                this.setWidth();
                return result;
            }
        },

        HeadlinesBoxView: {
            events: {
                'mousedown .dragresize-top': 'onStartVerticalResize',
                'mousedown .dragresize-left': 'onStartHorizontalResize',
                'mousedown .dragresize-topleft': 'onStartDiagonalResize'
            },

            render () {
                const result = this.__super__.render.apply(this, arguments);
                renderDragResizeHandles(this.__super__._converse, this);
                this.setWidth();
                return result;
            }
        },

        ControlBoxView: {
            events: {
                'mousedown .dragresize-top': 'onStartVerticalResize',
                'mousedown .dragresize-left': 'onStartHorizontalResize',
                'mousedown .dragresize-topleft': 'onStartDiagonalResize'
            },

            render () {
                const result = this.__super__.render.apply(this, arguments);
                renderDragResizeHandles(this.__super__._converse, this);
                this.setWidth();
                return result;
            },

            renderLoginPanel () {
                const result = this.__super__.renderLoginPanel.apply(this, arguments);
                this.initDragResize().setDimensions();
                return result;
            },

            renderControlBoxPane () {
                const result = this.__super__.renderControlBoxPane.apply(this, arguments);
                this.initDragResize().setDimensions();
                return result;
            }
        },

        ChatRoomView: {
            events: {
                'mousedown .dragresize-top': 'onStartVerticalResize',
                'mousedown .dragresize-left': 'onStartHorizontalResize',
                'mousedown .dragresize-topleft': 'onStartDiagonalResize'
            },

            render () {
                const result = this.__super__.render.apply(this, arguments);
                renderDragResizeHandles(this.__super__._converse, this);
                this.setWidth();
                return result;
            }
        }
    },

    initialize () {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        api.settings.extend({
            'allow_dragresize': true,
        });


        const dragResizable = {

            initDragResize () {
                const view = this;
                const debouncedSetDimensions = debounce(() => view.setDimensions());
                window.addEventListener('resize', view.debouncedSetDimensions)
                this.listenTo(this.model, 'destroy', () => window.removeEventListener('resize', debouncedSetDimensions));

                // Determine and store the default box size.
                // We need this information for the drag-resizing feature.
                const flyout = this.el.querySelector('.box-flyout');
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
                this.model.set('min_width', min_width.endsWith('px') ? Number(min_width.replace(/px$/, '')) :0);
                this.model.set('min_height', min_height.endsWith('px') ? Number(min_height.replace(/px$/, '')) :0);
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
                        this.height = ((this.height-diff) > (this.model.get('min_height') || 0)) ? (this.height-diff) : this.model.get('min_height');
                        this.prev_pageY = ev.pageY;
                        this.setChatBoxHeight(this.height);
                    }
                }
                if (_converse.resizing.direction.includes('left')) {
                    diff = this.prev_pageX - ev.pageX;
                    if (diff) {
                        this.width = ((this.width+diff) > (this.model.get('min_width') || 0)) ? (this.width+diff) : this.model.get('min_width');
                        this.prev_pageX = ev.pageX;
                        this.setChatBoxWidth(this.width);
                    }
                }
            },

            setWidth () {
                // If a custom width is applied (due to drag-resizing),
                // then we need to set the width of the .chatbox element as well.
                if (this.model.get('width')) {
                    this.el.style.width = this.model.get('width');
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
                    height = u.applyDragResistance(height, this.model.get('default_height'))+'px';
                } else {
                    height = "";
                }
                const flyout_el = this.el.querySelector('.box-flyout');
                if (flyout_el !== null) {
                    flyout_el.style.height = height;
                }
            },

            setChatBoxWidth (width) {
                if (width) {
                    width = u.applyDragResistance(width, this.model.get('default_width'))+'px';
                } else {
                    width = "";
                }
                this.el.style.width = width;
                const flyout_el = this.el.querySelector('.box-flyout');
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

            onStartVerticalResize (ev, trigger=true) {
                if (!api.settings.get('allow_dragresize')) {
                    return true;
                }
                ev.preventDefault();
                // Record element attributes for mouseMove().
                const flyout = this.el.querySelector('.box-flyout'),
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

            onStartHorizontalResize (ev, trigger=true) {
                if (!api.settings.get('allow_dragresize')) {
                    return true;
                }
                ev.preventDefault();
                const flyout = this.el.querySelector('.box-flyout'),
                      style = window.getComputedStyle(flyout);
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
            },
        };
        Object.assign(_converse.ChatBoxView.prototype, dragResizable);


        u.applyDragResistance = function (value, default_value) {
            /* This method applies some resistance around the
            * default_value. If value is close enough to
            * default_value, then default_value is returned instead.
            */
            if (value === undefined) {
                return undefined;
            } else if (default_value === undefined) {
                return value;
            }
            const resistance = 10;
            if ((value !== default_value) &&
                (Math.abs(value- default_value) < resistance)) {
                return default_value;
            }
            return value;
        };


        function onMouseMove (ev) {
            if (!_converse.resizing || !api.settings.get('allow_dragresize')) {
                return true;
            }
            ev.preventDefault();
            _converse.resizing.chatbox.resizeChatBox(ev);
        }


        function onMouseUp (ev) {
            if (!_converse.resizing || !api.settings.get('allow_dragresize')) {
                return true;
            }
            ev.preventDefault();
            const height = u.applyDragResistance(
                    _converse.resizing.chatbox.height,
                    _converse.resizing.chatbox.model.get('default_height')
            );
            const width = u.applyDragResistance(
                    _converse.resizing.chatbox.width,
                    _converse.resizing.chatbox.model.get('default_width')
            );
            if (api.connection.connected()) {
                _converse.resizing.chatbox.model.save({'height': height});
                _converse.resizing.chatbox.model.save({'width': width});
            } else {
                _converse.resizing.chatbox.model.set({'height': height});
                _converse.resizing.chatbox.model.set({'width': width});
            }
            _converse.resizing = null;
        }

        /************************ BEGIN Event Handlers ************************/
        function registerGlobalEventHandlers () {
            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
        }

        function unregisterGlobalEventHandlers () {
            document.removeEventListener('mousemove', onMouseMove);
            document.removeEventListener('mouseup', onMouseUp);
        }

        api.listen.on('registeredGlobalEventHandlers', registerGlobalEventHandlers);
        api.listen.on('unregisteredGlobalEventHandlers', unregisterGlobalEventHandlers);
        api.listen.on('beforeShowingChatView', view => view.initDragResize().setDimensions());
        /************************ END Event Handlers ************************/
    }
});
