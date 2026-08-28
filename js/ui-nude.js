/* =====================================================================
   ui.js  —  네비 · 개인정보 모달 · 카운트업 · 투데이 신청자 (Vanilla, data-* 기반)
   기존 index.html 인라인 스크립트 + personal.js(jQuery 모달)를 바닐라로 이식.
   (각 블록은 해당 요소가 없으면 그냥 건너뜀 → 섹션을 단계적으로 붙여도 안전)
===================================================================== */
(function () {
  'use strict';

  /* ---------- 모바일) 네비: body 패딩 보정 + 스크롤 그림자 + 햄버거 토글 ---------- */
  // var nav = document.querySelector('.site-nav');
  // if (nav) {
  //   var setPT = function () { document.body.style.paddingTop = nav.offsetHeight + 'px'; };
  //   setPT();
  //   window.addEventListener('resize', setPT);

  //   var onScroll = function () { nav.classList.toggle('is-scrolled', window.scrollY > 6); };
  //   onScroll();
  //   window.addEventListener('scroll', onScroll, { passive: true });
  // }

  // var toggle = document.querySelector('.nav__toggle');
  // var menu   = document.getElementById('nav-menu');
  // if (toggle && menu) {
  //   var setOpen = function (open) {
  //     toggle.setAttribute('aria-expanded', open);
  //     menu.classList.toggle('is-open', open);
  //     document.body.classList.toggle('nav-open', open);
  //   };
  //   toggle.addEventListener('click', function () {
  //     setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  //   });
  //   menu.querySelectorAll('a').forEach(function (a) {
  //     a.addEventListener('click', function () { setOpen(false); });
  //   });
  //   window.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  // }

  /* ---------- 개인정보 모달 (data-evt 기반) ---------- */
  var modal = document.querySelector('[data-modal="privacy"]');
  if (modal) {
    var openModal  = function () { modal.classList.add('is-open');    document.body.classList.add('is-modal-open'); };
    var closeModal = function () { modal.classList.remove('is-open'); document.body.classList.remove('is-modal-open'); };
    document.querySelectorAll('[data-evt="open_privacy"]').forEach(function (el) {
      el.addEventListener('click', openModal);
    });
    modal.querySelectorAll('[data-evt="close_privacy"]').forEach(function (el) {
      el.addEventListener('click', closeModal);
    });
    window.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('is-open')) closeModal();
    });
  }

  /* ---------- 섹션 3, 성과 카운트업 (.success__num data-target) ---------- */
  var nums = document.querySelectorAll('.success__num');
  if (nums.length) {
    var animate = function (el) {
      var target = parseFloat(el.dataset.target);
      var isUnit = el.textContent.indexOf('건') !== -1;
      var isPct  = el.textContent.indexOf('%') !== -1;
      var count = 0, step = target / 40;
      var iv = setInterval(function () {
        count += step;
        if (count >= target) { count = target; clearInterval(iv); }
        if (isUnit)      el.textContent = Math.floor(count).toLocaleString() + '건';
        else if (isPct)  el.textContent = count.toFixed(1) + '%';
        else             el.textContent = Math.floor(count).toLocaleString();
      }, 25);
    };
    var io = new IntersectionObserver(function (entries, ob) {
      entries.forEach(function (en) { if (en.isIntersecting) { animate(en.target); ob.unobserve(en.target); } });
    }, { threshold: 0.5 });
    nums.forEach(function (n) { io.observe(n); });
  }

  /* ---------- 섹션 6 입력폼. 투데이 신청자 (#today-count, 날짜 시드 고정난수 25~60) ---------- */
  var todayEl = document.getElementById('today-count');
  if (todayEl) {
    var today = new Date().toISOString().slice(0, 10);
    var seed = 0;
    for (var i = 0; i < today.length; i++) seed += today.charCodeAt(i);
    var min = 25, max = 60;
    todayEl.textContent = (seed % (max - min + 1)) + min;
  }
})();
