/*
DragResize v1.1
(c) 2005-2006 Angus Turnbull, TwinHelix Designs http://www.twinhelix.com

Licensed under the CC-GNU LGPL, version 2.1 or later:
http://creativecommons.org/licenses/LGPL/2.1/
This is distributed WITHOUT ANY WARRANTY; without even the implied
warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.

Simplified and modified for Converse.js by JC Brand https://opkode.com
*/

(function (root, factory) {
    if (typeof define === 'function' && define.amd) {
        define("dragresize", [], function() { return factory(); });
    } else {
        root.DragResize = factory();
    }
}(this, function () {
    function cancelEvent(e, c) {
        e.returnValue = false;
        if (e.preventDefault) {
            e.preventDefault();
        }
        if (c) {
            e.cancelBubble = true;
            if (e.stopPropagation) {
                e.stopPropagation();
            }
        }
    }

    // *** DRAG/RESIZE CODE ***
    function DragResize(myName, config) {
        var props = {
            myName: myName,                  // Name of the object.
            enabled: true,                   // Global toggle of drag/resize.
            handles: ['tl', 'tm', 'tr',
            'ml', 'mr', 'bl', 'bm', 'br'],   // Array of drag handles: top/mid/bot/right.
            isElement: null,                 // Function ref to test for an element.
            element: null,                   // The currently selected element.
            handle: null,                    // Active handle reference of the element.
            minWidth: 10, minHeight: 10,     // Minimum pixel size of elements.
            zIndex: 1,                       // The highest Z-Index yet allocated.
            lastMouseX: 0, lastMouseY: 0,    // Last processed mouse positions.
            mOffX: 0, mOffY: 0,              // A known offset between position & mouse.
            elmW: 0, elmH: 0,                // Element size.
            allowBlur: true,                 // Whether to allow automatic blur onclick.
            ondragfocus: null,               // Event handler functions.
            ondragstart: null,
            ondragend: null,
            ondragblur: null
        };
        for (var p in props) {
            this[p] = (typeof config[p] == 'undefined') ? props[p] : config[p];
        }
    };


    DragResize.prototype.apply = function(node) {
        /* Adds object event handlers to the specified DOM node */
        $(node).bind('mousedown', this.mouseDown.bind(this));
        $(node).bind('mousemove', this.mouseMove.bind(this));
        $(node).bind('mouseup', this.mouseUp.bind(this));
    };


    DragResize.prototype.select = function(newElement) { 
        with (this) {
            // Selects an element for dragging.
            if (!document.getElementById || !enabled) return;

            // Activate and record our new dragging element.
            if (newElement && (newElement != element) && enabled) {
                element = newElement;
                // Elevate it
                element.style.zIndex = ++zIndex;
                // Record element attributes for mouseMove().
                elmW = element.offsetWidth;
                elmH = element.offsetHeight;
                if (ondragfocus) this.ondragfocus();
            }
        }
    };

    DragResize.prototype.deselect = function(delHandles) {
        with (this) {
            // Immediately stops dragging an element. If 'delHandles' is true, this
            // remove the handles from the element and clears the element flag,
            // completely resetting the .
            if (!document.getElementById || !enabled) return;

            if (delHandles) {
                if (ondragblur) this.ondragblur();
                element = null;
            }
            handle = null;
            mOffX = 0;
            mOffY = 0;
        }
    };

    DragResize.prototype.mouseDown = function(e) {
        with (this) {
            // Suitable elements are selected for drag/resize on mousedown.
            // We also initialise the resize boxes, and drag parameters like mouse position etc.
            if (!document.getElementById || !enabled) return true;

            var elm = e.target || e.srcElement,
                newElement = null,
                newHandle = null,
                hRE = new RegExp(myName + '-([trmbl]{2})', '');

            while (elm) {
                // Loop up the DOM looking for matching elements. Remember one if found.
                if (elm.className) {
                    if (!newHandle && (hRE.test(elm.className))) newHandle = elm;
                    if (isElement(elm)) { newElement = elm; break }
                }
                elm = elm.parentNode;
            }

            // If this isn't on the last dragged element, call deselect(),
            // which will hide its handles and clear element.
            if (element && (element != newElement) && allowBlur) deselect(true);

            // If we have a new matching element, call select().
            if (newElement && (!element || (newElement == element))) {
                // Stop mouse selections if we're dragging a handle.
                if (newHandle) cancelEvent(e);
                select(newElement, newHandle);
                handle = newHandle;
                if (handle && ondragstart) this.ondragstart(hRE.test(handle.className));
            }
        }
    };


    DragResize.prototype.updateMouseCoordinates = function (e) {
        /* Update last processed mouse positions */
        this.mOffX = this.mOffY = 0;
        this.lastMouseX = e.pageX || e.clientX + document.documentElement.scrollLeft;
        this.lastMouseY = e.pageY || e.clientY + document.documentElement.scrollTop;
    };


    DragResize.prototype.operaHack = function (e) {
        // Evil, dirty, hackish Opera select-as-you-drag fix.
        if (window.opera && document.documentElement) {
            var oDF = document.getElementById('op-drag-fix');
            if (!oDF) {
                var oDF = document.createElement('input');
                oDF.id = 'op-drag-fix';
                oDF.style.display = 'none';
                document.body.appendChild(oDF);
            }
            oDF.focus();
        }
    };

    DragResize.prototype.resizeElement = function (e) {
        // Let it create an object representing the drag offsets.
        var resize = this.resizeHandleDrag(e) ? true : false;
        // Assign new info back to the element, with minimum dimensions.
        this.element.style.width =  this.elmW + 'px';
        this.element.style.height = this.elmH + 'px';
        this.operaHack();
        return e;
    };


    DragResize.prototype.mouseMove = function (e) {
        /* Continuously offsets the dragged element by the difference between the
         * previous mouse position and the current mouse position.
         */
        if (!this.enabled) return true;
        if (!this.handle) {
            // We're not dragging anything
            this.updateMouseCoordinates(e);
            return true;
        }
        cancelEvent(this.resizeElement(e));
    };


    DragResize.prototype.mouseUp = function(e) {
        with (this) {
            // On mouseup, stop dragging, but don't reset handler visibility.
            if (!document.getElementById || !enabled) return;
            var hRE = new RegExp(myName + '-([trmbl]{2})', '');
            if (handle && ondragend) this.ondragend(hRE.test(handle.className));
            deselect(false);
        }
    };


    DragResize.prototype.resizeHandleDrag = function(e) {
        /* Checks to see whether the
         * drag is from a resize handle created above; if so, it changes the stored
         * elm* dimensions and mOffX/Y.
         */
        var x = e.pageX || e.clientX + document.documentElement.scrollLeft;
        var y = e.pageY || e.clientY + document.documentElement.scrollTop;
        var diffX = x - this.lastMouseX + this.mOffX;
        var diffY = y - this.lastMouseY + this.mOffY;
        var hClass = this.handle &&
                this.handle.className &&
                this.handle.className.match(new RegExp(this.myName + '-([tmblr]{2})')) ? RegExp.$1 : '';

        with (this) {
            // If the hClass is one of the resize handles, resize one or two dimensions.
            // Bounds checking is the hard bit -- basically for each edge, check that the
            // element doesn't go under minimum size, and doesn't go beyond its boundary.
            var dY = diffY, dX = diffX, processed = false;
            if (hClass.indexOf('t') >= 0) {
                rs = 1;
                if (elmH - dY < minHeight) mOffY = (dY - (diffY = elmH - minHeight));
                elmH -= diffY;
                processed = true;
            }
            if (hClass.indexOf('b') >= 0) {
                rs = 1;
                if (elmH + dY < minHeight) mOffY = (dY - (diffY = minHeight - elmH));
                elmH += diffY;
                processed = true;
            }
            this.updateMouseCoordinates(e);
            return processed;
        }
    };
    return DragResize;
}));
