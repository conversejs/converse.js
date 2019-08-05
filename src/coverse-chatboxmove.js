/**
 * @module converse-chatboxmove
 */
import 'converse-chatview';
import 'converse-controlbox';
import converse from '@converse/headless/converse-core';
import tpl_chatboxmove from 'templates/chatbox_move.html';

const { _ } = converse.env;

// I want to create a div box on top of the logo
function renderMoveHandles(_converse, view) {
    const flyout = view.el.querySelector('.box-flyout');
    const div = document.createElement('div');
    div.innerHTML = tpl_chatboxmove();
    flyout.insertBefore(div, flyout.firstChild);
}

converse.plugins.add('converse-chatboxmove', {
    dependencies: ['converse-chatview', 'converse-headline', 'converse-muc-views'],

    enabled(_converse) {
        return _converse.view_mode == 'overlayed';
    },

    overrides: {
        // Overrides mentioned here will be picked up by converse.js's
        // plugin architecture they will replace existing methods on the
        // relevant objects or classes.
        ChatBox: {
            initialize() {}
        },
        ChatBoxView: {
            events: {
                'mousedown .move-right': 'onChatBoxMove'
            },

            render() {
                const result = this.__super__.render.apply(this, arguments);
                renderMoveHandles(this.__super__._converse, this);

                return result;
            }
        },

        HeadlinesBoxView: {
            events: {
                'mousedown .move-right': 'onChatBoxMove'
            },

            render() {
                const result = this.__super__.render.apply(this, arguments);
                renderMoveHandles(this.__super__._converse, this);

                return result;
            }
        },
        // Necessary for rendeirng login / auth screens?
        ControlBoxView: {
            events: {
                'mousedown .move-right': 'onChatBoxMove'
            }

            // render() {
            //     const result = this.__super__.render.apply(this, arguments);
            //     renderMoveHandles(this.__super__._converse, this);
            //     this.setWidth();
            //     return result;
            // },

            // renderLoginPanel() {
            //     const result = this.__super__.renderLoginPanel.apply(this, arguments);
            //     this.initDragResize().setDimensions();
            //     return result;
            // },

            // renderControlBoxPane() {
            //     const result = this.__super__.renderControlBoxPane.apply(this, arguments);
            //     this.initDragResize().setDimensions();
            //     return result;
            // }
        }
    },

    initialize() {
        /* The initialize function gets called as soon as the plugin is
         * loaded by converse.js's plugin machinery.
         */
        const { _converse } = this;

        _converse.api.settings.update({
            'allow_chatboxmove': true
        });

        const chatBoxMoveable = {
            initLocation() {
                // Initialize last known mouse position
                this.prev_pageX = 0;
                if (_converse.connection.connected) {
                    this.currentXPos = this.model.get('move-right');
                }
                return this;
            },

            onChatBoxMove(ev, trigger = true) {
                if (!_converse.allow_chatboxmove) {
                    return true;
                }

                // Record element attributes for mouseMove().
                const flyout = this.el.querySelector('.box-flyout'),
                    style = window.getComputedStyle(flyout);

                let diff;
                if (_converse.move.direction.indexOf('move-right') === 0) {
                    diff = this.prev_pageX - ev.pageX;
                    if (diff) {
                        this.prev_pageX = ev.pageX;
                        this.setChatBoxWidth(this.width);
                    }
                }
                this.height = parseInt(style.height.replace(/px$/, ''), 10);
                _converse.move = {
                    'chatbox': this,
                    'direction': 'move-right'
                };
            }
        };
        Object.assign(_converse.ChatBoxView.prototype, chatBoxMoveable);

        /************************ BEGIN Event Handlers ************************/

        function registerGlobalEventHandlers() {
            document.addEventListener('mousemove', function(ev) {
                if (!_converse.allow_chatboxmove) {
                    return true;
                }
                ev.preventDefault();
                _converse.move.chatbox.resizeChatBox(ev);
            });

            document.addEventListener('mouseup', function(ev) {
                if (!_converse.allow_chatboxmove) {
                    return true;
                }

                ev.preventDefault();

                if (_converse.connection.connected) {
                    _converse.move.chatbox.model.save({
                        'move-right': this.model.right
                    });
                }
                _converse.chatboxmove = null;
            });
        }

        _converse.api.listen.on('registeredGlobalEventHandlers', registerGlobalEventHandlers);

        _converse.api.listen.on('beforeShowingChatView', view =>
            view.initDragResize().setDimensions()
        );
    }
});
