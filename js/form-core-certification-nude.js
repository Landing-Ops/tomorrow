/* =====================================================================
   form-core.js  —  개인회생 리드폼 검증 + 전송 (Vanilla, data-* 기반)
   + 휴대폰 번호 인증 (OTP) 추가
===================================================================== */
(function () {
  'use strict';

  var form = document.querySelector('[data-form="lead"]');
  if (!form) return;

  /* ---------- 구글폼 매핑 (죽은 코드) ----------
     ★ 원래도 실제 전송에 안 쓰이던 구글폼 entry 매핑. 워커 이전(2026-08-18)으로
        구글폼 URL 자체를 제거했으므로 이 매핑도 완전히 무의미. 참고용으로만 남김.
  // var ENTRY = {
  //   name:'entry.361593477', phone:'entry.153916989', inco:'entry.1022218715',
  //   deb:'entry.275184534', comparison:'entry.128646469', impossibility:'entry.223961785',
  //   cause:'entry.1013271769', calltime:'entry.1297879783', message:'entry.534304633',
  //   phoneCheck:'entry.826263640', source:'entry.2051749761'
  // };
  */
  // ★ 구글폼(GOOGLE_FORM_URL)은 원래도 죽은 코드였음(실제 전송은 웹앱2로만) → 이전하며 제거
  var WEBAPP2_URL      = 'https://hopeworkout.softman007.workers.dev/submit';   // 구 GAS 웹앱2 submit → 워커 이전 (2026-08-18). ★JSONP 구조 그대로 — 워커가 callback 지원
  var THANKYOU_URL    = 'https://hopeworkout.com/result';
  
  /* =====================================================================
   ★ 광고 유입 URL 파라미터 사용법 (매체 × 지역 × 연령)
   -----------------------------------------------------------------------
   랜딩 URL 뒤에 아래 파라미터를 붙여서 사용. 순서 무관, 필요한 것만 붙이면 됨.

   mp = 매체 (media)
   rg = 지역 (region)
   ag = 연령 (age)

   예시)

   https://hopeworkout.com/?mp=carrot&rg=all
     → SOURCE: "당근-전국"  (매체,지역만)

   https://hopeworkout.com/?ag=2543
     → SOURCE: "25~43세"  (연령만)

  https://hopeworkout.com/?mp=meta&rg=seoul&ag=4060
     → SOURCE: "메타-서울-40~60세"  (매체,지역만)
  

   https://hopeworkout.com/
     → SOURCE: "직접유입"  (파라미터 아예 없을 때)
   -----------------------------------------------------------------
   ★ 주의: 위 목록에 없는 값을 넣으면 화이트리스트에 안 걸려서 무시됨
   ★ 대소문자 무관 (내부에서 소문자로 변환해서 비교함)
  =================================================================== */

  var MEDIA_MAP  = {
    meta:'메타', facebook:'메타', insta:'인스타그램', youtube:'유튜브', kakao:'카카오톡', carrot:'당근',
    naverda:'네이버DA', naversa:'네이버SA', tiktok:'틱톡',google:'구글', band:'밴드'
  };
  var REGION_MAP = {
    all:'전국',
    seoul:'서울', busan:'부산', daegu:'대구', incheon:'인천',
    gwangju:'광주', daejeon:'대전', ulsan:'울산', sejong:'세종',
    gyeonggi:'경기', gangwon:'강원', chungbuk:'충북', chungnam:'충남',
    jeonbuk:'전북', jeonnam:'전남', gyeongbuk:'경북', gyeongnam:'경남',
    jeju:'제주'
  };

  var TRAFFIC = (function () {
    var q = new URLSearchParams(location.search);
    var saved = {};
    try { saved = JSON.parse(sessionStorage.getItem('traffic') || '{}'); } catch (e) {}

    function pick(key, map, prev) {
      var raw = (q.get(key) || '').trim().toLowerCase();
      if (key === 'ag') {
        if (raw === 'all') return '전연령대';
        if (/^\d{4}$/.test(raw)) return raw.slice(0,2) + '~' + raw.slice(2,4) + '세';
        return prev || '';
      }
      if (map[raw]) return map[raw];
      return prev || '';
    }

    var t = {
      media:  pick('mp', MEDIA_MAP,  saved.media),
      region: pick('rg', REGION_MAP, saved.region),
      age:    pick('ag', null,       saved.age)   // ★ ag는 map 안 쓰므로 null
    };
    try { sessionStorage.setItem('traffic', JSON.stringify(t)); } catch (e) {}
    return t;
  })();

  var SOURCE = [TRAFFIC.media, TRAFFIC.region, TRAFFIC.age].filter(Boolean).join('-')
            || (typeof LANDING_SOURCE !== 'undefined' ? LANDING_SOURCE : '직접유입');

            
  /* ---------- 핸드폰 인증 OTP 설정 (구글앱스 웹앱 API)---------- */
  var OTP_API_URL = 'https://hopeworkout.softman007.workers.dev/otp';   // 구 GAS 웹앱1(OTP) → 워커 이전 (2026-08-18). ★현재 OTP 블록 전체 주석=OFF 상태. 켤 때 워커 KV·시크릿 세팅 필요
  var isPhoneVerified = false;  // 인증 완료 여부

  /* ---------- 필드 수집 (data-field) ---------- */
  var $ = function (key) { return form.querySelector('[data-field="' + key + '"]'); };
  var f = {
    name: $('name'), phone1: $('phone1'), phone2: $('phone2'), phone3: $('phone3'),
    deb: $('deb'), inco: $('inco'),
    region: $('region'), marital: $('marital'), dependents: $('dependents'),   // ★ 위저드 신규 3항목(hidden input)
    comparison: $('comparison'), impossibility: $('impossibility'),
    cause: $('cause'),
    calltime: $('calltime'), message: $('message'), agree: $('agree') 
  };
  var submitBtn = form.querySelector('[data-field="submit"]');
  if (!submitBtn) return;

  var nameRegex  = /^[가-힣]+$/;
  var phoneRegex = /^[0-9]+$/;
  var checkOrder = ['name', 'phone1', 'phone2', 'phone3', 'region', 'marital', 'dependents', 'deb', 'inco', 'comparison', 'impossibility', 'cause', 'calltime', 'message', 'agree'];
  function clearErrors() {
    checkOrder.forEach(function (k) { if (f[k]) f[k].classList.remove('is-invalid'); });
  }

//   /* =====================================================================
//      핸드폰 번호인증 OTP — 폼에 생성된 UI에 스타일 주입 (★기능 OFF시 주석처리★)
//   ===================================================================== */
//   (function injectOtpStyle() {
//     if (document.getElementById('otp-style')) return;
//     var style = document.createElement('style');
//     style.id = 'otp-style';
//     style.textContent =
//       '.otp-row{display:flex;gap:8px;margin-top:6px;align-items:stretch;}' +
//       '.otp-code-input{flex:1 1 auto;min-width:0;}' +
//       '.otp-action-btn{flex:0 0 auto;padding:0 18px;border-radius:var(--radius-lg,12px);' +
//         'font-size:.9rem;font-weight:700;white-space:nowrap;cursor:pointer;' +
//         'border:1.5px solid var(--primary);background:#fff;color:var(--primary);transition:all .15s;}' +
//       '.otp-action-btn.is-verify{background:var(--secondary);border-color:var(--secondary);color:#fff;}' +
//       '.otp-action-btn.is-done{background:var(--accent);border-color:var(--accent);color:#fff;cursor:default;}' +
//       '.otp-action-btn:disabled{opacity:.6;cursor:default;}' +
//       '.otp-msg{font-size:.8125rem;margin-top:6px;}'+
//       '.lf__input[data-field^="phone"][readonly]{background:#f1f3f5;color:#868e96;cursor:default;border-color:#dee2e6;}' +
//       '.lf__input[data-field^="phone"][readonly]:-webkit-autofill,' +
//       '.lf__input[data-field^="phone"][readonly]:-webkit-autofill:hover,' +
//       '.lf__input[data-field^="phone"][readonly]:-webkit-autofill:focus{' +
//         '-webkit-box-shadow:0 0 0 1000px #f1f3f5 inset !important;' +
//         '-webkit-text-fill-color:#868e96 !important;}';
//     document.head.appendChild(style);
//   })();

//   /* =====================================================================
//      핸드폰 번호인증 OTP — UI 주입 (연락처 입력칸 아래에 자동 삽입) / (★기능 OFF시 주석처리★)
//   ===================================================================== */
//   // ★ 전화번호 3분할 대응: 세 칸을 감싸는 .lf__field 를 기준으로 그 아래에 OTP 박스를 삽입
//   var phoneWrapEl = f.phone1 ? (f.phone1.closest('.lf__field') || f.phone1.parentNode) : null;

//   var oldOtp = form.querySelector('[data-otp-box]');
//   if (oldOtp) oldOtp.remove();

//   var otpBox = null;
//   if (phoneWrapEl) {
//     otpBox = document.createElement('div');
//     otpBox.setAttribute('data-otp-box', '');  
//     otpBox.innerHTML =
//       '<p style="font-size:14px;color:#d33;margin-bottom:4px; text-align:left;">타인 번호 도용 방지를 위해 번호 인증을 시행하고 있습니다.</p>' + // 번호인증 카피 ) 타인 번호 도용 방지를 위해 번호인증을 시행하고 있습니다. / 정확한 탕감액 산정을 위해 번호 인증을 진행해주세요.
//       '<div class="otp-row">' +
//         '<input data-otp-code type="text" maxlength="6" inputmode="numeric" ' +
//           'pattern="[0-9]*" autocomplete="off" ' +
//           'class="lf__input otp-code-input" placeholder="인증번호를 입력해주세요" />' +
//         '<button type="button" data-otp-action class="otp-action-btn">인증번호 받기</button>' +
//       '</div>' +
//       '<p data-otp-msg class="otp-msg"></p>';
//     phoneWrapEl.insertAdjacentElement('afterend', otpBox);
//   }

//   /* =====================================================================
//      핸드폰 번호인증 OTP — 요소 참조 + 로직 /  (★기능 OFF시 주석처리★)
//   ===================================================================== */
//   var otpCodeEl    = otpBox ? otpBox.querySelector('[data-otp-code]')   : null;
//   var otpActionBtn = otpBox ? otpBox.querySelector('[data-otp-action]') : null;
//   var otpMsg       = otpBox ? otpBox.querySelector('[data-otp-msg]')    : null;

//   var codeSent = false;

//   function setOtpMsg(text, color) {
//     if (!otpMsg) return;
//     otpMsg.textContent = text || '';
//     otpMsg.style.color = color || '';
//   }

//   function callOtpApi(payload) {
//     return fetch(OTP_API_URL, {
//       method: 'POST',
//       headers: { 'Content-Type': 'text/plain;charset=utf-8' },
//       body: JSON.stringify(payload)
//     }).then(function (r) { return r.json(); });
//   }

//   function getValidPhoneDigits() {
//     // ★ 전화번호 3분할 대응: 세 칸을 합쳐서 11자리 유효성 검사
//     if (!f.phone1 || !f.phone2 || !f.phone3) return '';
//     var d = ((f.phone1.value || '') + (f.phone2.value || '') + (f.phone3.value || '')).replace(/\D/g, '');
//     return /^010\d{8}$/.test(d) ? d : '';
//   }

//   function getCode() {
//     return ((otpCodeEl && otpCodeEl.value) || '').replace(/\D/g, '');
//   }

//   function refreshOtpButton() {
//     if (!otpActionBtn) return;
//     if (isPhoneVerified) {
//       otpActionBtn.textContent = '인증 완료';
//       otpActionBtn.className = 'otp-action-btn is-done';
//       otpActionBtn.disabled = true;
//       return;
//     }
//     otpActionBtn.disabled = false;
//     if (codeSent && getCode().length === 6) {
//       otpActionBtn.textContent = '인증번호 확인';
//       otpActionBtn.className = 'otp-action-btn is-verify';
//     } else {
//       otpActionBtn.textContent = codeSent ? '인증번호 재발송' : '인증번호 받기';
//       otpActionBtn.className = 'otp-action-btn';
//     }
//   }

//  function doSend() {
//   var phone = getValidPhoneDigits();
//   if (!phone) { alert('휴대폰 번호를 정확히 입력해주세요.'); return; }

//   otpActionBtn.disabled = true;
//   setOtpMsg('인증번호 발송 중...', '');

//   callOtpApi({ action: 'send', phone: phone })
//     .then(function (res) {
//       if (res.ok) {
//         codeSent = true;
//         setOtpMsg('인증번호를 발송했습니다. (3분 이내 입력)', '#1a7f37');
//         alert('핸드폰 문자로 [인증번호]가 전송되었습니다.\n6자리를 입력하고 [인증번호 확인]을 눌러주세요.');
//         if (otpCodeEl) otpCodeEl.focus();
//       } else {
//         alert(res.message || '발송에 실패했습니다. 다시 시도해주세요.');
//         setOtpMsg(res.message || '발송에 실패했습니다.', '#d33');
//       }
//     })
//     .catch(function () {
//       alert('네트워크 오류로 발송에 실패했습니다.');
//       setOtpMsg('네트워크 오류로 발송에 실패했습니다.', '#d33');
//     })
//     .then(function () { refreshOtpButton(); });
// }

//   function doVerify() {
//     var phone = getValidPhoneDigits();
//     var code = getCode();
//     if (code.length !== 6) { alert('인증번호 6자리를 입력해주세요.'); return; }
//     otpActionBtn.disabled = true;
//     setOtpMsg('확인 중...', '');
//     callOtpApi({ action: 'verify', phone: phone, code: code })
//       .then(function (res) {
//         if (res.ok) {
//           isPhoneVerified = true;
//           if (otpCodeEl) otpCodeEl.disabled = true;
//           // ★ 인증 완료 → 번호 입력칸 잠금
//           //   (인증받은 번호와 최종 제출되는 번호가 어긋나는 것을 원천 차단)
//           [f.phone1, f.phone2, f.phone3].forEach(function (el) {
//             if (el) el.readOnly = true;
//           });
//           setOtpMsg('', '');
//           alert('인증이 완료되었습니다.');
//           refreshOtpButton();
//           updateButton();  // 인증 완료 후 버튼 상태 갱신
//         } else {
//           alert(res.message || '인증에 실패했습니다.');
//           setOtpMsg(res.message || '인증에 실패했습니다.', '#d33');
//           refreshOtpButton();
//         }
//       })
//       .catch(function () {
//         alert('네트워크 오류로 확인에 실패했습니다.');
//         refreshOtpButton();
//       });
//   }

//   // 버튼 클릭 → 발송/확인 분기
//   if (otpActionBtn) {
//     otpActionBtn.addEventListener('click', function () {
//       if (isPhoneVerified) return;
//       if (codeSent && getCode().length === 6) doVerify();
//       else doSend();
//     });
//   }

//   // 코드 입력 → 숫자 6자리 제한 + 버튼 갱신
//   if (otpCodeEl) {
//     otpCodeEl.addEventListener('input', function () {
//       otpCodeEl.value = otpCodeEl.value.replace(/\D/g, '').slice(0, 6);
//       refreshOtpButton();
//     });
//   }

//   // 전화번호 변경 시 → 인증 초기화
//   // ★ 전화번호 3분할 대응: 세 칸 중 어느 하나라도 바뀌면 인증 초기화
//   //   (숫자만 필터링/자동 포커스 이동은 아래 initPhoneInputs() 가 담당하므로 여기선 제외)
//   [f.phone1, f.phone2, f.phone3].forEach(function (el) {
//     if (!el) return;
//     el.addEventListener('input', function () {
//       if (!isPhoneVerified && !codeSent) return;
//       isPhoneVerified = false;
//       codeSent = false;
//       if (otpCodeEl) { otpCodeEl.disabled = false; otpCodeEl.value = ''; }
//       setOtpMsg('번호가 변경되어 다시 인증이 필요합니다.', '#d33');
//       refreshOtpButton();
//       updateButton();
//     });
//   });

//   refreshOtpButton(); // 초기 상태

  /* =====================================================================
     전화번호 3분할 입력 편의 처리
     - 숫자만 입력되도록 필터링
     - 자릿수 다 채우면 자동으로 다음 칸으로 포커스 이동
  ===================================================================== */
  (function initPhoneInputs() {
    var parts = [f.phone1, f.phone2, f.phone3];
    parts.forEach(function (el, idx) {
      if (!el) return;
      el.addEventListener('input', function () {
        // 숫자 외 문자 제거 + 최대 자릿수 제한
        var max = parseInt(el.getAttribute('maxlength'), 10) || 4;
        el.value = el.value.replace(/\D/g, '').slice(0, max);

        // 자릿수를 다 채우면 다음 입력칸으로 자동 이동
        if (el.value.length === max && parts[idx + 1]) {
          parts[idx + 1].focus();
        }
      });
    });
  })();

  /* =====================================================================
     검증
  ===================================================================== */
  function validate() {
    clearErrors();
    var v = {};
    ['name', 'phone1', 'phone2', 'phone3', 'inco', 'deb','comparison','impossibility', 'cause', 'calltime','message'].forEach(function (k) {
      v[k] = (f[k] && f[k].value || '').trim();
    });

    if (!nameRegex.test(v.name) || v.name.length < 2) {
      f.name.classList.add('is-invalid');
      return { ok: false, msg: '성함 입력을 확인하세요.' }; 
    }

    /* ---------- 전화번호 3분할 검증 ---------- */
    if (v.phone1.length === 0 || v.phone2.length === 0 || v.phone3.length === 0) {
      if (!v.phone1.length) f.phone1.classList.add('is-invalid');
      if (!v.phone2.length) f.phone2.classList.add('is-invalid');
      if (!v.phone3.length) f.phone3.classList.add('is-invalid');
      return { ok: false, msg: '전화번호를 입력하세요.' };
    }
    if (v.phone1 !== '010' || !phoneRegex.test(v.phone1)) {
      f.phone1.classList.add('is-invalid');
      return { ok: false, msg: '전화번호 입력을 확인하세요.' };
    }
    if (v.phone2.length !== 4 || !phoneRegex.test(v.phone2)) {
      f.phone2.classList.add('is-invalid');
      return { ok: false, msg: '전화번호 입력을 확인하세요.' };
    }
    if (v.phone3.length !== 4 || !phoneRegex.test(v.phone3)) {
      f.phone3.classList.add('is-invalid');
      return { ok: false, msg: '전화번호 입력을 확인하세요.' };
    }
    // 휴대폰 번호 인증 완료 여부 확인 (★기능 OFF시 주석처리★)
    // if (!isPhoneVerified) {
    //   f.phone1.classList.add('is-invalid');
    //   return { ok: false, msg: '휴대폰 인증을 완료해주세요.' };
    // }

    if (!v.inco) { f.inco.classList.add('is-invalid'); return { ok: false, msg: '월평균 소득을 입력하세요.' }; }
    if (v.inco === 'disallow') {
      f.inco.classList.add('is-invalid');
      return { ok: false, msg: '개인회생 신청이 불가합니다.' };
    }

    if (!v.deb) { f.deb.classList.add('is-invalid'); return { ok: false, msg: '총 채무액을 입력하세요.' }; }
    if (v.deb === 'disallow') {
      f.deb.classList.add('is-invalid');
      return { ok: false, msg: '개인회생 신청이 불가합니다.' };
    }

    // if (!v.comparison) { f.comparison.classList.add('is-invalid'); return { ok: false, msg: '재산대비 채무액 범주를 선택하세요.' }; }
    // if (v.comparison === 'disallow') {
    //   f.comparison.classList.add('is-invalid');
    //   return { ok: false, msg: '개인회생 신청이 불가합니다.' };
    // }

    // if (!v.impossibility) { f.impossibility.classList.add('is-invalid'); return { ok: false, msg: '담보/세금체납 범주를 선택하세요.' }; }
    // if (v.impossibility === 'disallow') {
    //   f.impossibility.classList.add('is-invalid');
    //   return { ok: false, msg: '개인회생 신청이 불가합니다.' };
    // }

    // if (!v.cause) { f.cause.classList.add('is-invalid'); return { ok: false, msg: '채무 발생 원인을 선택하세요.' }; }
    if (!v.calltime) { f.calltime.classList.add('is-invalid'); return { ok: false, msg: '통화 가능 시간대를 선택하세요.' }; }
    // if (v.message.length < 2) { f.message.classList.add('is-invalid'); return { ok: false, msg: '문의사항을 입력하세요.' }; }
    if (!f.agree.checked) { f.agree.classList.add('is-invalid'); return { ok: false, msg: '개인정보 동의를 해주세요.' }; }

    return { ok: true, msg: '최대 예상탕감액 안내받기' };
  }

  /* =====================================================================
     버튼 상태 갱신
  ===================================================================== */
  function updateButton() {
    var r = validate();
    if (r.ok) {
      submitBtn.disabled = false;
      submitBtn.textContent = '최대 예상탕감액 안내받기';
      submitBtn.style.background = 'var(--color-cta-main-strong)';
      submitBtn.style.cursor = 'pointer';
    } else {
      submitBtn.disabled = true;
      submitBtn.textContent = r.msg;
      submitBtn.style.background = 'var(--color-cta-disabled)';
      submitBtn.style.cursor = 'default';
    }
  }

  checkOrder.forEach(function (k) {
    if (!f[k]) return;
    f[k].addEventListener('input', updateButton);
    f[k].addEventListener('change', updateButton);
  });
  updateButton(); // 초기 1회

  /* =====================================================================
     웜업 — 폼 첫 터치 시 웹앱2 인스턴스를 미리 깨움 (콜드스타트 완화)
     · action=ping 은 서버에서 unknown_action 으로 즉시 리턴됨 (시트 미접근)
     · 유저가 폼 채우는 동안 warm 상태가 유지돼 제출 체감이 줄어듦
  ===================================================================== */
  var warmed = false;
  function warmUp() {
    if (warmed) return;
    warmed = true;
    var cb = 'warmCb_' + Date.now();
    window[cb] = function () { delete window[cb]; };
    var s = document.createElement('script');
    // ★ 워커에선 웜업 전용 라우트 /ping 사용. (WEBAPP2_URL은 /submit이라, 여기에 ping을 태우면
    //   action 무시하고 submit 로직을 타서 빈 리드가 저장될 수 있음 → 반드시 /ping 으로 분리)
    s.src = 'https://hopeworkout.softman007.workers.dev/ping?callback=' + cb;
    s.onerror = function () { delete window[cb]; };
    document.body.appendChild(s);
  }
  if (f.name) f.name.addEventListener('focus', warmUp, { once: true });

  /* =====================================================================
      전송 (웹앱2 submit — JSONP 방식, uid 발급받아 땡큐페이지로 이동)
    ======================================================================== */
  function buildSubmitParams(requestId) {
    var params = {
      action: 'submit',
      name: (f.name.value || '').trim(),
      phone: ((f.phone1.value || '').trim() + (f.phone2.value || '').trim() + (f.phone3.value || '').trim()),   // ★ 3분할 입력값을 11자리로 합쳐서 전송 (시트 저장·중복체크 형식 유지)
      region: (f.region && f.region.value || '').trim(),          // ★ 위저드 신규: 거주지역
      marital: (f.marital && f.marital.value || '').trim(),        // ★ 위저드 신규: 혼인여부
      dependents: (f.dependents && f.dependents.value || '').trim(), // ★ 위저드 신규: 부양가족수
      inco: (f.inco.value || '').trim(),                          // ★ 이제 만원 단위 숫자 (구 범위선택 아님)
      deb: (f.deb.value || '').trim(),                            // ★ 이제 만원 단위 숫자
      calltime: (f.calltime.value || '').trim(),
      source: SOURCE,
      requestId: requestId   // ★ 이번 제출(1차+재시도) 전체가 공유하는 고유 ID — 서버가 재시도 감지용으로 사용
    };
    return new URLSearchParams(params);
  }

  /* ---------- 폼 제출 로딩 오버레이 (index.html의 #submit-loading-overlay 제어) ---------- */
  var submitLoadingOverlay = document.getElementById('submit-loading-overlay');
  function showLoadingOverlay() {
    if (submitLoadingOverlay) submitLoadingOverlay.style.display = 'flex';
  }
  function hideLoadingOverlay() {
    if (submitLoadingOverlay) submitLoadingOverlay.style.display = 'none';
  }

  function resetSubmitButton() {
    submitBtn.disabled = false;
    submitBtn.textContent = '예상탕감액 진단 신청하기';
    submitBtn.style.background = 'var(--color-cta-main-strong)';
    submitBtn.style.cursor = 'pointer';
  }

  var SUBMIT_TIMEOUT_MS   = 25000;   // ★ 시도당 타임아웃 (8초 → 10 -> 25초)
  var SUBMIT_MAX_ATTEMPTS = 2;        // 최초 시도 1 + 재시도 1

  function attemptSubmit(attemptNo, requestId) {
    var callbackName = 'leadSubmitCb_' + Date.now() + '_' + attemptNo;
    var script = document.createElement('script');
    var settled = false;

    function cleanup() {
      if (script.parentNode) script.parentNode.removeChild(script);
      delete window[callbackName];
    }

    var timeoutId = setTimeout(function () {
      if (settled) return;
      settled = true;
      cleanup();

      if (attemptNo < SUBMIT_MAX_ATTEMPTS) {
        attemptSubmit(attemptNo + 1, requestId);   // ★ 같은 requestId로 재시도 → 서버가 중복 아닌 재시도로 인식
      } else {
        hideLoadingOverlay();
        alert('네트워크 지연으로 접수가 지연되고 있습니다. 잠시 후 다시 시도해주세요.');
        resetSubmitButton();
      }
    }, SUBMIT_TIMEOUT_MS);

    window[callbackName] = function (data) {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      cleanup();
      hideLoadingOverlay();   // ★ 서버 응답 도착 → 결과 안내 직전에 오버레이 제거

      if (data && data.ok) {
        alert('신청이 완료되었습니다.');
        try { sessionStorage.setItem('lead_name', (f.name.value || '').trim()); } catch (e) {}
        window.scrollTo({ top: 0, behavior: 'smooth' });
        window.location.href = THANKYOU_URL + '?uid=' + data.uid;

      } else if (data && data.reason === 'duplicate') {
        alert('이미 접수된 번호입니다. 신청이 불가합니다.');
        resetSubmitButton();
      } else {
        alert('접수 처리 중 오류가 발생했습니다. 다시 시도해주세요.');
        resetSubmitButton();
      }
    };

    var params = buildSubmitParams(requestId);
    params.append('callback', callbackName);

    script.src = WEBAPP2_URL + '?' + params.toString();
    script.onerror = function () {
      if (settled) return;
      settled = true;
      clearTimeout(timeoutId);
      cleanup();

      if (attemptNo < SUBMIT_MAX_ATTEMPTS) {
        attemptSubmit(attemptNo + 1, requestId);   // ★ 재시도
      } else {
        hideLoadingOverlay();
        alert('네트워크 오류가 발생했습니다. 다시 시도해주세요.');
        resetSubmitButton();
      }
    };
    document.body.appendChild(script);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var r = validate();
    if (!r.ok) { alert(r.msg); return; }

    submitBtn.disabled = true;
    submitBtn.textContent = '전송 중입니다';
    submitBtn.style.background = 'var(--color-cta-disabled)';
    submitBtn.style.cursor = 'default';

    showLoadingOverlay();   // ★ 클릭 즉시 오버레이 표시 (재시도가 일어나도 계속 유지됨)

    /* =====================================================================
       ★ 제휴사(리플/이정용) 폼 동시 전송 — partner-form.js 가 있을 때만 실행
       - 반드시 웹앱2 호출(attemptSubmit)보다 먼저 실행해야 함.
         웹앱2 응답 후 땡큐페이지로 페이지 이동이 일어나면,
         그 순간 진행 중이던 제휴사 전송이 끊길 수 있기 때문.
       - partner-form.js를 로드하지 않으면 이 블록은 그냥 건너뜀 (연동 OFF).
         즉 제휴 연동을 끄고 싶으면 index.html에서 script 태그만 빼면 됨.
    ===================================================================== */
    if (typeof window.submitPartnerForm === 'function') {
      window.submitPartnerForm();
    }

/* ★ requestId를 전화번호별로 세션에 보관 —
       응답 유실로 수동 재시도할 때 같은 requestId를 재사용해야
       서버가 "재시도"로 인식하고 기존 uid를 돌려줌 (중복 차단에 갇히지 않음) */
    var phoneKey = ((f.phone1.value || '') + (f.phone2.value || '') + (f.phone3.value || '')).replace(/\D/g, '');
    var storeKey = 'lead_req_' + phoneKey;
    var requestId = null;
    try { requestId = sessionStorage.getItem(storeKey); } catch (e) {}
    if (!requestId) {
      requestId = 'req_' + Date.now() + '_' + Math.random().toString(36).slice(2);
      try { sessionStorage.setItem(storeKey, requestId); } catch (e) {}
    }
    attemptSubmit(1, requestId);
  });
})();