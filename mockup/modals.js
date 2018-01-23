/*global Backbone, _, window */
const Modals = Backbone.NativeView.extend({
    el: 'div.modals',

    initialize () {
        this.render();
    },

    render () {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'modals.html', true);
        xhr.onload = () => {
            this.el.innerHTML = xhr.responseText;
        }
        xhr.send();
    }
});
