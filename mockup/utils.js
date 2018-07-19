/*global _, converse_utils */
const u = converse_utils;

window.renderAvatars = function (el) {
    el = el || document;
    const canvasses = el.querySelectorAll('canvas.chat-msg__avatar');
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

function toggleSpoilerMessage (ev) {
    if (ev && ev.preventDefault) {
        ev.preventDefault();
    }
    const toggle_el = ev.target,
          icon_el = toggle_el.firstElementChild;

    u.slideToggleElement(
        toggle_el.parentElement.parentElement.querySelector('.spoiler')
    );
    if (toggle_el.getAttribute("data-toggle-state") == "closed") {
        toggle_el.textContent = 'Show less';
        icon_el.classList.remove("fa-eye");
        icon_el.classList.add("fa-eye-slash");
        toggle_el.insertAdjacentElement('afterBegin', icon_el);
        toggle_el.setAttribute("data-toggle-state", "open");
    } else {
        toggle_el.textContent = 'Show more';
        icon_el.classList.remove("fa-eye-slash");
        icon_el.classList.add("fa-eye");
        toggle_el.insertAdjacentElement('afterBegin', icon_el);
        toggle_el.setAttribute("data-toggle-state", "closed");
    }
}

window.initSpoilers = function () {
    const spoilers = document.querySelectorAll('.spoiler-toggle');
    _.each(spoilers, (spoiler_el) => {
        spoiler_el.addEventListener('click', toggleSpoilerMessage);
    });
}
