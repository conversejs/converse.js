/*global Backbone, _, window */
const UserPanel = Backbone.NativeView.extend({
    el: '.controlbox-pane',

    initialize () {
        this.render();
    },

    render () {
        const xhr = new XMLHttpRequest();
        xhr.open('GET', 'user-panel.html', true);
        xhr.onload = () => {
            this.el.innerHTML = xhr.responseText;
            this.modals = _.map(this.el.querySelectorAll('[data-toggle="modal"]'), (modal_el) => 
                new window.Modal(modal_el, {
                    backdrop: 'static', // we don't want to dismiss Modal when Modal or backdrop is the click event target
                    keyboard: true // we want to dismiss Modal on pressing Esc key
                }));
            this.renderAvatar();
        }
        xhr.send();
    },

    renderAvatar () {
        const canvasses = document.querySelectorAll('canvas.avatar');
        _.each(canvasses, (canvas_el) => {
            const avatar_url = canvas_el.getAttribute('data-avatar');
            if (!avatar_url) {
                return;
            }
            const ctx = canvas_el.getContext('2d');
            const img = new Image();

            img.onload = function () {
                const canvas = ctx.canvas ;
                const hRatio = canvas.width  / img.width    ;
                const vRatio =  canvas.height / img.height  ;
                const ratio  = Math.min ( hRatio, vRatio );
                const centerShift_x = ( canvas.width - img.width*ratio ) / 2;
                const centerShift_y = ( canvas.height - img.height*ratio ) / 2;  
                ctx.clearRect(0,0,canvas.width, canvas.height);
                ctx.drawImage(img, 0,0, img.width, img.height, centerShift_x,centerShift_y,img.width*ratio, img.height*ratio);  
            };
            img.src = avatar_url;
        });

    }
});
