(function () {
    document.addEventListener("DOMContentLoaded", function(event) { 
        function scrollTo(element, to, duration, hash) {
            if (duration <= 0) return;
            var difference = to - element.scrollTop;
            var perTick = difference / duration * 10;

            setTimeout(function() {
                element.scrollTop = element.scrollTop + perTick;
                if (element.scrollTop === to) {
                    window.location.hash = hash;
                    return;
                }
                scrollTo(element, to, duration - 10, hash);
            }, 10);
        }

        window.addEventListener('scroll', function (ev) {
            var navbar = document.querySelector(".navbar");
            var fixed_top = document.querySelector(".navbar-fixed-top");
            var rect = navbar.getBoundingClientRect();
            if (rect.top + document.body.scrollTop > 50) {
                fixed_top.classList.add("top-nav-collapse");
            } else {
                fixed_top.classList.remove("top-nav-collapse");
            }
        });

        Array.prototype.forEach.call(document.querySelectorAll('.page-scroll a'), function (el) {
            el.addEventListener('click', function (ev) {
                ev.preventDefault();
                var hash = this.getAttribute("href")
                var goal = document.querySelector(hash);
                scrollTo(document.body, goal.offsetTop, 600, hash);
            });
        });
    });
})();
