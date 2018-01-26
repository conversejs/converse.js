/*global Backbone, _, window */
const Sidebar = Backbone.NativeView.extend({
    el: 'div.sidebar',

    events: {
        'click .hamburger': 'onHamburgerClicked'
    },

    initialize () {
        this.render();
    },

    onHamburgerClicked () {
        const hamburger = document.querySelector('.hamburger');
        const converse_el = document.querySelector('#conversejs');
        if (_.includes(converse_el.classList, 'sidebar-open')) {
            converse_el.classList.remove('sidebar-open');
            hamburger.classList.remove('fa-times');
            hamburger.classList.add('fa-bars');
        } else {
            converse_el.classList.add('sidebar-open');
            hamburger.classList.remove('fa-bars');
            hamburger.classList.add('fa-times');
        }
    },

    render () {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'sidebar.html', true);
        xhr.onload = () => {
            this.el.innerHTML = xhr.responseText;
        }
        xhr.send();
    }
});
