/*global Backbone, _, window */
const UserPanel = Backbone.NativeView.extend({
    el: '.controlbox-pane',

    initialize () {
        this.render();
    },

    render () {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'controlbox.html', true);
        xhr.onload = () => {
            this.el.innerHTML = xhr.responseText;
            this.modals = _.map(this.el.querySelectorAll('[data-toggle="modal"]'), (modal_el) => 
                new window.Modal(modal_el, {
                    backdrop: 'static', // we don't want to dismiss Modal when Modal or backdrop is the click event target
                    keyboard: true // we want to dismiss Modal on pressing Esc key
                }));
            window.renderAvatars();
            window.initSpoilers();
        }
        xhr.send();
    }
});
