// reveal.js — moi phan hien dan mot lan khi cuon toi; khong chay khi nguoi xem tat hieu ung chuyen dong.
(function () {
  const els = [...document.querySelectorAll('.eo-rv')];
  const show = (el) => el.classList.add('in');
  let still = true;
  try { still = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { /* trinh duyet cu */ }
  if (still || !('IntersectionObserver' in window)) { els.forEach(show); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
  }, {rootMargin: '0px 0px -8% 0px', threshold: 0.06});
  els.forEach((el) => io.observe(el));
  // in ra giay hoac mo bang link toi giua trang: hien het
  window.addEventListener('beforeprint', () => els.forEach(show));
})();
