/*global Backbone, _, window */
const ChatBox = Backbone.NativeView.extend({
    el: '.chatbox:not(.chatroom):not(#controlbox)',

    initialize () {
        this.render();
    },

    render () {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'chatbox.html', true);
        xhr.onload = () => {
            var parser = new DOMParser();
            var doc = parser.parseFromString(xhr.responseText, "text/html");
            this.el.innerHTML = doc.querySelector('.chatbox:not(.chatroom):not(#controlbox)').innerHTML;
            window.renderAvatars(this.el);
        }
        xhr.send();
    }
});
