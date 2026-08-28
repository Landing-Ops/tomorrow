// obf.config.js
// ─────────────────────────────────────────────────────────────
// 난독화 강도 프리셋 정의 + 파일별 매핑
// ★ 파일 추가 / 제외 / 강도변경은 전부 이 파일에서만 한다.
// ─────────────────────────────────────────────────────────────

// [공통] 모든 프리셋이 상속하는 베이스
const BASE = {
  compact: true,
  simplify: true,
  target: 'browser',
  stringArray: true,
  stringArrayEncoding: ['base64'],
  identifierNamesGenerator: 'mangled',
};

// [MINIMAL] light 로도 깨지는 파일용 — 문자열/구조 일절 안 건드림
//   · string-array 자체를 OFF → 문자열이 원본 그대로 남음 (base64 디코더 없음)
//   · 변수/함수명만 mangle. -nude.js(난독화 0) 바로 위 단계.
//   · JSONP 콜백 문자열이 base64 디코딩에서 깨지는 파일에 사용
const MINIMAL = {
  compact: true,
  simplify: true,
  target: 'browser',
  identifierNamesGenerator: 'mangled',
  stringArray: false,          // ★ 핵심: 문자열 배열/인코딩 전부 없음
  selfDefending: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  splitStrings: false,
  numbersToExpressions: false,
};

// [LIGHT] 깨지기 쉬운 파일용 — 문자열만 가리고 구조는 안 건드림
//   · self-defending / control-flow / dead-code 전부 OFF
//   · form.submit(), JSONP 동적 콜백, iframe 미러링 계열에 안전
const LIGHT = {
  ...BASE,
  stringArrayThreshold: 0.75,
  selfDefending: false,
  controlFlowFlattening: false,
  deadCodeInjection: false,
  splitStrings: false,
  numbersToExpressions: false,
};

// [MEDIUM] 일반 파일용 — 구조 변형 넣되 위험 옵션은 절제
const MEDIUM = {
  ...BASE,
  stringArrayThreshold: 1,
  splitStrings: true,
  splitStringsChunkLength: 8,
  numbersToExpressions: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.5,
  deadCodeInjection: false,   // 용량 대비 효용 낮아 기본 OFF
  selfDefending: false,       // 디버깅 방해 크므로 heavy 에서만
};

// [HEAVY] 핵심 로직 보호용 — 최고 강도
//   · 검증/전송 로직처럼 노출되면 안 되는 파일에만
const HEAVY = {
  ...BASE,
  stringArrayThreshold: 1,
  stringArrayEncoding: ['base64'],
  splitStrings: true,
  splitStringsChunkLength: 5,
  numbersToExpressions: true,
  controlFlowFlattening: true,
  controlFlowFlatteningThreshold: 0.8,
  deadCodeInjection: true,
  deadCodeInjectionThreshold: 0.2,
  selfDefending: true,
};

// ─────────────────────────────────────────────────────────────
// 파일별 매핑
//   preset: 'minimal' | 'light' | 'medium' | 'heavy'
//   · 파일 추가: files 배열에 { src, preset, reason } 한 줄 추가
//   · 파일 제외: 해당 항목 삭제 (또는 빌드 시 --skip=키워드)
//   · reason 은 "왜 이 강도인지" 근거 — 나중 유지보수용이니 꼭 남길 것
// ─────────────────────────────────────────────────────────────
module.exports = {
  presets: { minimal: MINIMAL, light: LIGHT, medium: MEDIUM, heavy: HEAVY },

  files: [
    // ── index.html (랜딩페이지) ──
    {
      src: 'js/carousel-nude.js',
      preset: 'minimal',
      reason: '-'
    },
    {
      src: 'js/form-core-certification-nude.js',
      preset: 'medium',
      reason: 'JSONP 동적 콜백명(leadSubmitCb_). heavy 시 self-defending/CF-flattening이 window[cbName] 참조 깨뜨려 응답 후 리다이렉트 멈춤 → medium.'
    },
    {
      src: 'js/wizard-nude.js',
      preset: 'minimal',
      reason: '-'
    },
    {
      src: 'js/ui-nude.js',
      preset: 'minimal',
      reason: '-'
    },

    // ── result.html (땡큐페이지) ──
    {
      src: 'js/thanks-uid-resolver-nude.js',
      preset: 'minimal',
      reason: 'light(base64)도 JSONP 콜백 문자열 깨뜨림 → 브라우저 charAt/in;chars 에러. string-array 통째로 꺼야 함 → minimal.'
    },
    {
      src: 'js/thanks-tracking-nude.js',
      preset: 'medium',
      reason: 'sendBeacon 트래킹. 로직 노출 방지하되 전송 안정성 필요.'
    },
    {
      src: 'js/thanks-countdown-nude.js',
      preset: 'minimal',
      reason: 'boot()를 이벤트 콜백으로 넘김(addEventListener). medium CF-flattening이 이벤트 바인딩 깨뜨려 타이머 미작동 → light. (UI 로직이라 노출 손해 적음)'
    },
    {
      src: 'js/thanks-review-cards-nude.js',
      preset: 'minimal',
      reason: 'light(base64)에서 브라우저 charAt 에러 다수. string-array 통째로 꺼야 함 → minimal. (UI 로직이라 노출 손해 적음)'
    },
    {
      src: 'js/thanks-verdicts-nude.js',
      preset: 'heavy',
      reason: '단순 마퀴. 뭘 걸어도 안 깨져서 강도 올려도 무방.'
    },

  ],
};