# RSS Insight (Obsidian Plugin)

지정한 시간 슬롯(예: `08:00`, `17:00`) 기준으로 RSS/Atom 피드를 수집해서,
해당 시간 구간에 발행된 항목만 Obsidian 노트로 저장하는 플러그인입니다.

AI 요약 없이 원문 메타데이터를 정리해 저장하는 용도에 맞춰 설계했습니다.

## What It Does

- 시간 슬롯 기반 수집 (`HH:MM,HH:MM` 형식)
- 윈도우 필터링
  - 예: `17:00` 실행 시 `08:00 ~ 17:00` 발행분만 저장
- 주제(Topic)별 섹션 정리
- RSS + Atom 파싱
- 수집 결과를 Vault 폴더에 Markdown 노트로 생성/갱신
- frontmatter는 핵심 메타데이터만 최소 저장(한글 키)
- 자동 실행(Obsidian 실행 중 분 단위 체크) + 수동 명령 실행
- 시작 시 캐치업(앱이 꺼져 있던 동안 놓친 윈도우 자동 보충 수집)
- 키워드 포함/제외 필터
- 피드 간 중복 제거 강화(링크/제목 정규화)
- 토픽 관련성 점수 필터(무관 기사 자동 제외)
- 피드 토픽과 기사 내용이 강하게 어긋나면 자동 제외(토픽 불일치 필터)
- 품질 점수 + 토픽 우선순위 가중치 + 토픽 다양성 보정으로 기사 선택
- 선호/비선호 피드백 기반 개인 선호도 학습(수동 학습 실행)
- 생성 노트 형식 미리보기 팝업
- 간편 설정 모드(핵심 옵션만 노출) + 고급 옵션 토글
- 우선순위 입력값과 실제 피드 목록의 토픽 매핑 상태를 실시간 표시
- 피드 토픽 기준 우선순위 자동 동기화 버튼
- 신뢰도 높은 추천 RSS 목록 미리보기 + 주제별 자동 추가(2개/3개)
- 인터넷 검색 연동 보조 피드(Google News RSS 검색) 자동 추가
- 기본 상한 + 구독 피드/토픽 규모 기반 자동 상한 확장
- 기사별 4요소 점수 템플릿 자동 삽입
- 영어 등 비한글 항목 자동 번역(웹 번역 또는 로컬 Ollama 선택)
- Ollama 모델 자동 탐지 + 추천 + 드롭다운 선택
- 번역 description은 300자 미리보기로 저장, 원문 description은 접힘(details)으로 보관
- feed description이 비어있으면 기사 링크에서 meta/본문 문단을 보강 추출 시도
- 주요 도메인(한국경제/동아/연합뉴스TV/코인미디어) 사이트별 본문 selector 우선 추출

## Important Limitation

- 정확히 08:00/17:00에 실행되려면 해당 시각에 Obsidian이 켜져 있어야 합니다.
- 앱이 꺼져 있어도, 다음 실행 시 `Catch up on startup`이 켜져 있으면 놓친 윈도우를 자동으로 보충 수집합니다.
- 아주 오래 꺼져 있었다면 `Max catch-up windows per run` 제한 때문에 여러 틱에 나눠 수집됩니다.

## Settings

- `Auto fetch`: 자동 체크/수집 on/off
- `Settings language`: 설정창 언어 전환(한국어/영문, 동시 표시는 안 함)
- `Show advanced options`: 끄면 핵심 옵션만 표시(권장)
- `Beginner preset`: 균형형/엄격형 1클릭 프리셋
- `Topic feed count check`: 우선순위 6개 토픽 각각의 활성 피드 수를 `부족/적정/초과`로 표시(권장 2~3개)
- `Schedule times`: `08:00,17:00` 형식
- `Catch up on startup`: 시작 시 누락 윈도우 자동 보충
- `Max catch-up windows per run`: 1회 실행당 보충 최대 윈도우 수
- `Base max items per window`: 품질 선별 기본 상한
- `Adaptive max items`: 구독 피드/토픽 수를 기준으로 상한 자동 확장
- `Adaptive cap upper bound`: 자동 확장 시 최대 상한
- `Topic diversity minimum per topic`: 토픽별 최소 확보 개수(권장 2)
- `Topic max items per topic`: 토픽별 최대 허용 개수(최대 3, 권장 3)
- `Topic diversity penalty`: 토픽 편중 완화 가중치(높을수록 분산 강화)
- `Output folder`: 노트 저장 폴더 (Vault 기준 경로)
- `Filename prefix`: 생성 파일명 접두어
- `Include description`: description/summary 포함 여부
- `Description max length`: description 최대 길이
- `Write empty notes`: 결과가 없어도 빈 리포트 생성 여부
- `Enable translation`: 번역 기능 on/off
- `Translation provider`: `Web translate` 또는 `Local Ollama`
- `Target language`: 기본 `ko`
- `Translate only non-Korean`: 한글 포함 텍스트는 번역 제외
- `Keep original text`: 번역 결과 아래 원문 유지
- `Translate title`, `Translate description`: 번역 대상 선택
- `Web translation endpoint`: 웹 번역 엔드포인트(기본값 제공)
- `Ollama base URL`: 로컬 Ollama 서버 주소
- `Ollama model`: 탐지된 모델 중 선택(추천 모델 표시)
- `Enhanced dedupe`: 피드 간 중복 제거 강화
- `Keyword filter`: 포함/제외 키워드 필터
- `Include keywords`: 포함 키워드(쉼표/줄바꿈)
- `Exclude keywords`: 제외 키워드(쉼표/줄바꿈)
- `Topic relevance filter`: 토픽에 맞는 기사만 통과
- `Minimum topic relevance score`: 토픽 필터 최소 점수(-2~10)
- `Topic priority weighting`: 토픽 우선순위 가중치 사용
- `Topic priority order`: 우선순위 토픽 순서(쉼표/줄바꿈)
- `Applied priority preview`: 실제 인식된 우선순위 + 인식 불가 토큰 확인
- `Live feed alignment`: 우선순위와 현재 피드 토픽의 실시간 정합성 확인
- `Sync priority from feed topics`: 현재 피드 토픽 기준으로 우선순위 자동 채움
- `Priority max boost`: 1순위 토픽 최대 가중치(0~12)
- `Apply preference learning`: 선호도 학습 점수 적용
- `Write feedback checkboxes`: 기사별 선호/비선호 체크박스 삽입
- `Preference score weight`: 학습 점수 반영 강도
- `Preference learning status`: 학습 토큰 수/마지막 학습 시각 + 학습 버튼
- `Score template`: 점수 템플릿 삽입 여부
- `Default score value`: 점수 기본값(1-5)
- `Action threshold`: 액션 후보 기준 점수
  - 노트 상단 요약에 1회 표시됩니다(기사별 반복 출력 제거)
- `Enable RSS Dashboard sync`: RSS Dashboard에 추가한 피드를 자동 동기화 (기본값: 꺼짐)
- `RSS Dashboard data path`: 기본값 `.obsidian/plugins/rss-dashboard/data.json`
- `Feeds`: topic/name/url/enabled 관리
- `Recommended feed status`: 우선순위 토픽별 추천 피드 반영 비율
- `Auto add recommended RSS`: 추천 피드를 주제당 2개/3개로 자동 보강
- `Add web-search feeds`: Google News 검색 RSS를 토픽별 보조 피드로 추가(고급 모드)

## Commands

- `Run due RSS window captures now`
- `Capture latest completed RSS window now`
- `Sync feeds from RSS Dashboard now`
- `Refresh Ollama translation models`
- `Refresh preference learning profile`
- `Preview RSS note template`
- `Preview recommended RSS feeds`
- `Add recommended RSS feeds (target 2 per topic)`
- `Add Google News search feeds by topic`

## RSS Dashboard 연동

1. RSS Dashboard 플러그인이 같은 Vault에 설치되어 있어야 합니다.
2. RSS Insight 설정에서 `Enable RSS Dashboard sync`를 켭니다.
3. 기본 경로 `.obsidian/plugins/rss-dashboard/data.json`를 유지합니다.
4. `Sync feeds from RSS Dashboard now` 명령을 실행하거나, RSS Insight 자동 실행 시 동기화됩니다.

동기화 규칙:

- RSS Dashboard에 새로 추가된 feed는 RSS Insight에 자동 생성됩니다.
- feed 주제(topic)는 RSS Dashboard의 folder 값을 기본으로 사용합니다.
- 같은 URL이 수동 feed와 겹치면 수동 feed를 우선합니다.

## Build

```bash
npm install
npm run check
npm run build
```

빌드 결과:

- `main.js`
- `manifest.json`
- `styles.css`

## BRAT 배포 방식 (GitHub Release)

1. GitHub 저장소 생성 후 코드 push
2. `manifest.json`의 `version` 업데이트
3. `versions.json`에 버전 매핑 추가
4. `npm run build`
5. GitHub Release 생성
6. Release Assets에 아래 3개 첨부
   - `manifest.json`
   - `main.js`
   - `styles.css`
7. BRAT에서 repo URL로 플러그인 추가

## Suggested Initial Feed Topics

- AI
- 정치
- 교육
- 경제-부동산
- 주식
- 코인
