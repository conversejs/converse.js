/*global Backbone, _, window */
const ChatRoom = Backbone.NativeView.extend({
    el: '.chatroom',

    initialize () {
        this.render();
    },

    render () {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'chatroom.html', true);
        xhr.onload = () => {
            var parser = new DOMParser();
            var doc = parser.parseFromString(xhr.responseText, "text/html");
            this.el.innerHTML = doc.querySelector('.chatroom').innerHTML;
            window.renderAvatars(this.el);
        }
        xhr.send();
    }
});
