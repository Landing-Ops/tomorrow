/* =====================================================================
   carousel.js  —  후기 슬라이더 (Vanilla JS)
   
   ★ 이 파일은 두 가지 기능을 합친 코드입니다 ★
   [A] 슬라이드 자동재생 기능 — 전환, dots, 버튼, 자동재생 타이머, hover/터치 정지
   [B] 그래프 막대 애니메이션 기능 — 슬라이드 진입 시 막대 높이 차오르는 효과
   
   두 기능은 goTo() 함수 안에서만 서로 연결됩니다.
   (슬라이드가 바뀔 때 → activate() 호출 → 그래프 애니메이션 실행)
====================================================================== */
(function () {
  'use strict';

  var root = document.querySelector('.section.testimonials');
  if (!root) return;

  var track   = root.querySelector('.ts__track');
  var slides  = Array.prototype.slice.call(root.querySelectorAll('.ts__slide'));
  var prevBtn = root.querySelector('.ts__nav--prev');
  var nextBtn = root.querySelector('.ts__nav--next');
  var dots    = Array.prototype.slice.call(root.querySelectorAll('.ts__dot'));
  if (!track || !slides.length) return;

  var index = 0;
  var DURATION = 18000;
  var timer = null;
  var isPaused = false;


  /* =====================================================================
     [B] 그래프 막대 애니메이션 기능
     — 이 구역만 지우면 그래프 애니메이션이 꺼지고, 슬라이드 기능은 그대로 작동함
  ===================================================================== */

  function usableHeight(chartEl) {
    var cs = getComputedStyle(chartEl);
    var pt = parseFloat(cs.paddingTop) || 0;
    var pb = parseFloat(cs.paddingBottom) || 0;
    return Math.max(0, chartEl.clientHeight - pt - pb);
  }

  function setBarsForSlide(slide) {
    var chart = slide.querySelector('.ts__miniChart');
    if (!chart) return;

    var useH = usableHeight(chart);
    var beforeRatio = parseFloat(chart.dataset.before) || 0.90;
    var afterRatio  = parseFloat(chart.dataset.after)  || 0.20;

    var beforeBar = chart.querySelector('.ts__bar--before');
    var afterBar  = chart.querySelector('.ts__bar--after');

    if (beforeBar) beforeBar.style.setProperty('--bar-h', '0px');
    if (afterBar)  afterBar.style.setProperty('--bar-h', '0px');

    requestAnimationFrame(function () {
      requestAnimationFrame(function () {
        if (beforeBar) beforeBar.style.setProperty('--bar-h', Math.round(useH * beforeRatio) + 'px');
        if (afterBar)  afterBar.style.setProperty('--bar-h', Math.round(useH * afterRatio) + 'px');
      });
    });
  }

  function resetBars(slide) {
    slide.querySelectorAll('.ts__bar').forEach(function (b) {
      b.style.setProperty('--bar-h', '0px');
    });
  }

  function activate(i) {
    slides.forEach(function (s, si) {
      s.classList.toggle('is-active', si === i);
      if (si === i) setBarsForSlide(s);
      else resetBars(s);
    });
  }

  // 화면 회전/리사이즈 시 현재 슬라이드 그래프 재계산
  var resizeRaf = 0;
  function onResize() {
    cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(function () {
      setBarsForSlide(slides[index]);
    });
  }
  window.addEventListener('resize', onResize);
  window.addEventListener('orientationchange', onResize);


  /* =====================================================================
     [A] 슬라이드 자동재생 기능
     — 전환·dots·버튼·자동재생·hover/터치 정지·키보드·화면진입 감지
  ===================================================================== */

  function goTo(i) {
    index = (i + slides.length) % slides.length;
    track.style.transform = 'translate3d(' + (-index * 100) + '%,0,0)';
    dots.forEach(function (d, di) { d.setAttribute('aria-selected', di === index ? 'true' : 'false'); });
    activate(index);   // ★ [B] 그래프 애니메이션 트리거 (여기서만 연결됨)
  }
  function next() { goTo(index + 1); }
  function prev() { goTo(index - 1); }

  // 자동재생 타이머
  function tick()  { if (!isPaused) next(); }
  function start() { stop(); timer = setInterval(tick, DURATION); }
  function stop()  { if (timer) clearInterval(timer); }

  // prev/next 버튼 클릭
  if (nextBtn) nextBtn.addEventListener('click', function () { next(); start(); });
  if (prevBtn) prevBtn.addEventListener('click', function () { prev(); start(); });

  // dots 클릭
  dots.forEach(function (d, di) { d.addEventListener('click', function () { goTo(di); start(); }); });

  // PC: 마우스 hover 시 정지
  root.addEventListener('mouseenter', function () { isPaused = true; });
  root.addEventListener('mouseleave', function () { isPaused = false; });

  // 모바일: 화면 터치 중 정지
  root.addEventListener('touchstart', function () { isPaused = true; }, { passive: true });
  root.addEventListener('touchend', function () { isPaused = false; start(); }, { passive: true });

  // 키보드 화살표 이동
  root.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowRight') { next(); start(); }
    if (e.key === 'ArrowLeft')  { prev(); start(); }
  });
  root.setAttribute('tabindex', '0');

  // 화면에 섹션이 보이면 자동재생 시작
  var io = new IntersectionObserver(function (entries) {
    if (entries.some(function (e) { return e.isIntersecting; })) {
      goTo(0);
      start();
      io.disconnect();
    }
  }, { threshold: 0.2 });
  io.observe(root);

})();