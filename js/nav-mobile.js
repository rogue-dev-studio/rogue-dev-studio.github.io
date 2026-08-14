(function () {
    var top = document.querySelector('.top');
    var toggle = document.querySelector('.nav-toggle');
    var nav = document.querySelector('.top nav');
    if (!top || !toggle || !nav) return;

    function setOpen(open) {
        top.classList.toggle('is-open', open);
        toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
        toggle.setAttribute('aria-label', open ? 'Tutup menu' : 'Buka menu');
        toggle.textContent = open ? 'Tutup' : 'Menu';
    }

    toggle.addEventListener('click', function () {
        setOpen(!top.classList.contains('is-open'));
    });

    nav.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', function () {
            setOpen(false);
        });
    });
})();
