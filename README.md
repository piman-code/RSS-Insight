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
- 자동 실행(Obsidian 실행 중 분 단위 체크) + 수동 명령 실행
- 키워드 포함/제외 필터
- 피드 간 중복 제거 강화(링크/제목 정규화)
- 기사별 4요소 점수 템플릿 자동 삽입

## Important Limitation

- 자동 수집은 **Obsidian 앱이 실행 중일 때만** 동작합니다.
- 앱이 꺼져 있는 동안의 정확한 시각 실행 보장이 필요하면 OS 스케줄러와 외부 스크립트 방식을 같이 쓰는 것이 좋습니다.

## Settings

- `Auto fetch`: 자동 체크/수집 on/off
- `Schedule times`: `08:00,17:00` 형식
- `Output folder`: 노트 저장 폴더 (Vault 기준 경로)
- `Filename prefix`: 생성 파일명 접두어
- `Include description`: description/summary 포함 여부
- `Description max length`: description 최대 길이
- `Write empty notes`: 결과가 없어도 빈 리포트 생성 여부
- `Enhanced dedupe`: 피드 간 중복 제거 강화
- `Keyword filter`: 포함/제외 키워드 필터
- `Include keywords`: 포함 키워드(쉼표/줄바꿈)
- `Exclude keywords`: 제외 키워드(쉼표/줄바꿈)
- `Score template`: 점수 템플릿 삽입 여부
- `Default score value`: 점수 기본값(1-5)
- `Action threshold`: 액션 후보 기준 점수
- `Enable RSS Dashboard sync`: RSS Dashboard에 추가한 피드를 자동 동기화
- `RSS Dashboard data path`: 기본값 `.obsidian/plugins/rss-dashboard/data.json`
- `Feeds`: topic/name/url/enabled 관리

## Commands

- `Run due RSS window captures now`
- `Capture latest completed RSS window now`
- `Sync feeds from RSS Dashboard now`

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
