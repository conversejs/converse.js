(function () {
    document.addEventListener("DOMContentLoaded", function(event) { 

        window.addEventListener('scroll', function (ev) {
            var navbar = document.querySelector(".navbar");
            var fixed_top = document.querySelector(".navbar-fixed-top");
            var rect = navbar.getBoundingClientRect();
            if (rect.top + window.scrollY > 50) {
                fixed_top.classList.add("top-nav-collapse");
            } else {
                fixed_top.classList.remove("top-nav-collapse");
            }
        });

        var getDocumentHeight = function () {
            return Math.max(
                document.body.scrollHeight, document.documentElement.scrollHeight,
                document.body.offsetHeight, document.documentElement.offsetHeight,
                document.body.clientHeight, document.documentElement.clientHeight
            );
        };

        Array.prototype.forEach.call(document.querySelectorAll('.page-scroll a'), function (el) {
            el.addEventListener('click', function (ev) {
                ev.preventDefault();
                var hash = this.getAttribute("href")
                var endLocation = document.querySelector(hash).offsetTop;
                var startLocation = window.pageYOffset;
                var distance = endLocation - startLocation;
                var start, percentage, position;
                var timeLapsed = 0;

                function scrollAnimation(timestamp) {
                    if (!start) { start = timestamp; }
                    timeLapsed += timestamp - start;
                    percentage = (timeLapsed / parseInt(500, 10));
                    percentage = (percentage > 1) ? 1 : percentage;
                    position = startLocation + (distance * percentage * percentage);
                    window.scrollTo(0, Math.floor(position));

                    var currentLocation = window.pageYOffset;
                    if (position == endLocation ||
                            currentLocation == endLocation ||
                            ((startLocation < endLocation && window.innerHeight + currentLocation) >= getDocumentHeight())) {
                        window.location.hash = hash;
                        return;
                    }
                    window.requestAnimationFrame(scrollAnimation);
                    start = timestamp;
                }
                window.requestAnimationFrame(scrollAnimation);
            });
        });
    });
})();
