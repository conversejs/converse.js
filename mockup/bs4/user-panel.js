/*global Backbone, _, window */
const UserPanel = Backbone.NativeView.extend({
    el: 'div#users',

    initialize () {
        this.render();
    },

    render () {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'user-panel.html', true);
        xhr.onload = () => {
            this.el.innerHTML = xhr.responseText;
        }
        xhr.send();
    }
});
