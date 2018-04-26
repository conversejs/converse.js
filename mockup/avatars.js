/*global _ */
window.renderAvatars = function (el) {
    const canvasses = el.querySelectorAll('canvas.avatar');
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
