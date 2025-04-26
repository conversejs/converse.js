(function () {
    document.addEventListener('DOMContentLoaded', function () {
        new bootstrap.Carousel('#screenshotCarousel', {
            interval: 4000,
            ride: 'carousel',
            wrap: true,
        });

        window.addEventListener('scroll', function () {
            const navbarBrand = document.querySelector('.navbar-brand');
            const navbar = document.querySelector('.navbar');
            const rect = navbar.getBoundingClientRect();
            if (rect.top + window.scrollY > 100) {
                navbar.classList.add('top-nav-collapse');
                navbarBrand.style.display = 'inline-block';
            } else {
                navbar.classList.remove('top-nav-collapse');
                navbarBrand.style.display = 'none';
            }
        });

        const getDocumentHeight = function () {
            return Math.max(
                document.body.clientHeight,
                document.body.offsetHeight,
                document.body.scrollHeight,
                document.documentElement.clientHeight,
                document.documentElement.offsetHeight,
                document.documentElement.scrollHeight
            );
        };

        Array.prototype.forEach.call(document.querySelectorAll('.page-scroll a'), function (el) {
            el.addEventListener('click', function (ev) {
                ev.preventDefault();
                Array.prototype.forEach.call(document.querySelectorAll('.page-scroll'), function (child) {
                    child.classList.remove('active');
                });
                this.parentElement.classList.add('active');

                let hash = this.getAttribute('href');
                let endLocation = document.querySelector(hash).offsetTop;
                let startLocation = window.pageYOffset;
                let distance = endLocation - startLocation;
                let start, percentage, position;
                let timeLapsed = 0;

                function scrollAnimation(timestamp) {
                    if (!start) {
                        start = timestamp;
                    }
                    timeLapsed += timestamp - start;
                    percentage = timeLapsed / parseInt(500, 10);
                    percentage = percentage > 1 ? 1 : percentage;
                    position = startLocation + distance * percentage * percentage;
                    window.scrollTo(0, Math.floor(position));

                    let currentLocation = window.pageYOffset;
                    if (
                        position == endLocation ||
                        currentLocation == endLocation ||
                        (startLocation < endLocation && window.innerHeight + currentLocation) >= getDocumentHeight()
                    ) {
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
