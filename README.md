# BIT 계산 시스템 (Novel AI 기반)

텍스트 입력에 대한 BIT_MAX와 BIT_MIN 값을 실시간으로 계산, 저장, 조회하는 웹 애플리케이션입니다. Novel AI 개발을 위한 기반 시스템으로, 문자열의 비트 패턴을 분석하고 예측하는 기능을 제공합니다.

## 📋 목차

- [주요 기능](#주요-기능)
- [시스템 요구사항](#시스템-요구사항)
- [설치 및 실행](#설치-및-실행)
- [사용법](#사용법)
- [API 문서](#api-문서)
- [데이터 저장 구조](#데이터-저장-구조)
- [BIT 계산 알고리즘](#bit-계산-알고리즘)
- [프로젝트 구조](#프로젝트-구조)
- [성능 최적화](#성능-최적화)
- [트러블슈팅](#트러블슈팅)
- [개발 가이드](#개발-가이드)

## 🚀 주요 기능

### 1. 실시간 BIT 계산
- 텍스트 입력 시 즉시 BIT_MAX, BIT_MIN 계산
- 유니코드 기반 문자 분석
- 다국어 지원 (한국어, 영어, 일본어, 중국어, 러시아어 등)

### 2. 예측 기능
- **NEXT_MAX/NEXT_MIN 예측**: 최근 히스토리 기반 선형 회귀 예측
- **예측 입력값 표시**: 입력 과정에서 처음 15개, 중간 15개, 마지막 15개 부분 문자열의 BIT 값 표시
- 최근 20개 데이터를 기반으로 다음 값을 예측

### 3. 자동 저장 및 조회
- **자동 저장**: 입력 시 서버에 자동 저장 (중복 방지)
- **출처 표시**: "저장" (새로운 데이터) 또는 "조회" (기존 데이터) 표시
- **조회 우선**: 저장 전 서버에서 먼저 조회하여 중복 확인

### 4. 계층적 데이터 저장
- max/min 값의 자릿수별 폴더 구조로 자동 분류
- 각 레코드는 max와 min 폴더에 각각 저장
- NDJSON 형식으로 효율적인 데이터 관리

### 5. 근사 검색
- 정확한 경로에 데이터가 없으면 하위 폴더 재귀 탐색
- 최대 3단계 상위 폴더까지 확장 검색
- 근사값 기반 데이터 조회 지원

### 6. 사용자 인터페이스
- **텍스트 영역**: 긴 소설이나 문장도 입력 가능한 textarea
- **실시간 계산**: 입력과 동시에 결과 표시
- **기록 보기**: 최근 25개 기록 상시 표시
- **예측 입력값**: 부분 문자열별 BIT 값 실시간 표시

## 💻 시스템 요구사항

- **Node.js**: v14 이상 (v18 권장)
- **npm**: v6 이상
- **브라우저**: Chrome, Edge, Firefox, Safari (최신 버전)
- **운영체제**: Windows, Linux, macOS

## 📦 설치 및 실행

### 1. 저장소 클론

```bash
git clone https://github.com/yoohyunseog/NovelAI.git
cd NovelAI
```

### 2. 의존성 설치

```bash
cd server
npm install
```

설치되는 패키지:
- `express`: 웹 서버 프레임워크
- `cors`: Cross-Origin Resource Sharing 지원
- `morgan`: HTTP 요청 로깅
- `dotenv`: 환경 변수 관리

### 3. 서버 실행

#### Windows (PowerShell)
```bash
cd server
$env:PORT=8123; npm start
```

#### Linux/Mac
```bash
cd server
PORT=8123 npm start
```

서버가 성공적으로 시작되면 다음 메시지가 표시됩니다:
```
Server listening on http://0.0.0.0:8123
Serving static from: E:\GameTools\dev
```

### 4. 접속

브라우저에서 다음 주소로 접속:
- **BIT 계산 UI**: http://localhost:8123/bit_ui.html
- **데이터베이스 대시보드**: http://localhost:8123/database/index.html
- **서버 상태 확인**: http://localhost:8123/health

## 📄 페이지별 설명

### 1. bit_ui.html - BIT 계산 메인 UI
실시간 BIT 계산 및 예측 기능을 제공하는 메인 인터페이스입니다.
- **주요 기능**:
  - 텍스트 입력 시 실시간 BIT_MAX, BIT_MIN 계산
  - NEXT_MAX/NEXT_MIN 예측 기능
  - 예측 입력값 표시 (처음/중간/마지막 15개)
  - 자동 저장 및 조회 기능
  - 최근 25개 기록 표시
  - 세션 히스토리 관리 (IndexedDB)

### 2. database/index.html - 데이터베이스 대시보드
데이터 수동 저장 및 조회를 위한 관리 인터페이스입니다.
- **주요 기능**:
  - 수동 데이터 저장 (문자열, MAX, MIN 값 입력)
  - MAX/MIN 값 기반 데이터 조회
  - 조회 결과 테이블 표시
  - 화면 초기화 기능

### 3. novel_composition.html - 소설 구성 요소 분석
소설 텍스트를 분석하여 속성(구성 요소)을 추출하는 도구입니다.
- **주요 기능**:
  - GPT-4o-mini를 활용한 소설 텍스트 분석
  - 등장인물, 배경 설정, 주요 사건, 감정/분위기, 테마/주제, 스타일/톤 등 속성 추출
  - 각 속성에 대한 BIT 값 계산 및 저장
  - 추출된 속성 카드 표시 및 클릭 시 검색 페이지 이동

### 4. novel_composition_new.html - 소설 구성 요소 분석 (개선판)
`novel_composition.html`의 개선 버전으로 추가 기능을 제공합니다.
- **추가 기능**:
  - GPT 분석 결과 자동 저장
  - 속성별 저장 상태 표시 (저장 완료/중복/실패)
  - 속성 카드 클릭 시 좌측 속성 목록으로 스크롤 및 강조
  - 하단 로그 출력 영역 (최대 50개 메시지)
  - 콘솔 출력 자동 캡처 및 표시

### 5. novel_composition_new2.html - 소설 구성 도구 (최신판)
소설 제목 및 챕터 관리 기능이 추가된 완전한 소설 구성 도구입니다.
- **주요 기능**:
  - **소설 제목 및 챕터 구성**: 소설 제목 입력 및 챕터 추가/수정/삭제
  - **계층적 데이터 저장**: 소설 제목 → 챕터 → 속성 → 데이터 구조
  - **이중 프롬프트 시스템**:
    - **프롬프트 1**: 텍스트 분석 및 다중 속성 추출
    - **프롬프트 2**: 단일 속성 결정 후 소설 작가 역할로 내용 작성
  - **속성 필터링**: 소설 제목 및 챕터 기반 속성 검색 (BIT 유사도 기반)
  - **속성 입력란**: 프롬프트 2 사용 시 자동으로 선택된 속성 표시
  - **프롬프트 로그**: GPT에 전달된 프롬프트 확인 (데이터 제외)
  - **중복 처리**: 기존 데이터가 있으면 수정 버튼 표시 (자동 저장 안 함)
  - **데이터 표시 제한**: 저장된 속성 목록에서 데이터는 150자까지만 표시
  - **복사 기능**: 각 데이터 항목에 복사 버튼 추가
  - **마크다운 제거**: GPT 응답에서 마크다운 문자 자동 제거

### 6. gpt_auto.html - GPT 자동 속성/데이터 분석
GPT를 활용한 자동 속성 및 데이터 분석 도구입니다.
- **주요 기능**:
  - 텍스트 입력 후 GPT 자동 분석
  - 속성과 데이터 자동 분리
  - BIT 값 계산 및 저장
  - 실시간 조회 및 검색 기능
  - 조회 결과 자동 입력 기능

### 7. gpt_auto_new.html - GPT 자동 분석 (개선판)
`gpt_auto.html`의 개선 버전입니다.
- **추가 기능**:
  - **검색 옵션**: 속성으로만 검색 (기본값) / 속성+데이터 검색
  - **BIT 기반 유사도 검색**: 속성 BIT 값 기반 유사도 계산 (최대 100%)
  - **정확한 유사도 계산**: 텍스트 또는 BIT 값 완전 일치 시 100% 표시
  - **실시간 검색**: 입력 시 자동으로 유사 속성 검색
  - **결과 정렬**: 유사도 높은 순으로 정렬 (100% 일치 우선)

### 8. bit_search.html - BIT 값 기반 검색
BIT 값으로 속성 및 데이터를 검색하는 도구입니다.
- **주요 기능**:
  - 속성 BIT 값 또는 데이터 BIT 값으로 검색
  - 검색 결과 표시 (속성명, 데이터, BIT 값)
  - 속성별 데이터 목록 표시
  - 데이터 추가 기능 (모달)

### 9. real_time.html - 실시간 속성/데이터 분석
실시간으로 속성과 데이터를 분석하고 저장하는 도구입니다.
- **주요 기능**:
  - 실시간 속성 및 데이터 입력
  - 자동 저장 기능
  - BIT 값 실시간 계산 및 표시
  - 저장 상태 로그 출력

### 10. input_tools.html - 입력 도구
텍스트 입력 및 BIT 계산을 위한 간단한 도구입니다.
- **주요 기능**:
  - 텍스트 입력
  - BIT 값 계산
  - 기본적인 저장 및 조회 기능

## 📖 사용법

### 웹 UI 사용법

#### BIT 계산 UI (`bit_ui.html`)

1. **텍스트 입력**
   - textarea에 원하는 텍스트 입력 (단어, 문장, 소설 등)
   - 입력 시 실시간으로 BIT_MAX, BIT_MIN 계산됨

2. **자동 저장**
   - "자동 저장" 체크박스로 저장 기능 활성화/비활성화
   - 활성화 시 입력할 때마다 서버에 자동 저장
   - 중복 데이터는 자동으로 감지되어 저장하지 않음

3. **예측 기능**
   - NEXT_MAX, NEXT_MIN: 최근 히스토리 기반 예측값 표시
   - 예측 입력값: 입력 과정에서 부분 문자열별 BIT 값 표시
     - 처음 15개: 문자열의 시작 부분
     - 중간 15개: 문자열의 중간 부분
     - 마지막 15개: 문자열의 끝 부분

4. **기록 보기**
   - 최근 25개 기록 자동 표시
   - 각 기록의 출처 표시 ("저장" 또는 "조회")
   - ASCII 코드, BIT_MAX, BIT_MIN 값 확인

5. **기타 기능**
   - 내보내기: JSON 형식으로 히스토리 내보내기
   - 기록 비우기: 세션 히스토리 초기화

#### 데이터베이스 대시보드 (`database/index.html`)

1. **수동 저장**
   - 입력 필드에 문자열, MAX, MIN 값 입력
   - "Save" 버튼으로 서버에 저장

2. **데이터 조회**
   - MAX 또는 MIN 값 입력
   - "Fetch" 버튼으로 서버에서 조회
   - 결과는 테이블에 표시

3. **화면 초기화**
   - "Clear Screen" 버튼으로 결과 테이블 초기화

## 🔌 API 문서

### POST /api/log

레코드를 서버에 저장합니다.

**요청:**
```bash
curl -X POST http://localhost:8123/api/log \
  -H "Content-Type: application/json" \
  -d '{
    "t": 1761863999718,
    "s": "테스트 문자열",
    "max": 2.4642619047619045,
    "min": 3.316238095238095
  }'
```

**파라미터:**
- `t` (optional): 타임스탬프 (밀리초). 생략 시 현재 시간 사용
- `s`: 입력 문자열
- `max`: BIT_MAX 값
- `min`: BIT_MIN 값

**응답 (성공):**
```json
{
  "ok": true,
  "files": {
    "max": "server/data/max/2/4/6/4/2/6/1/9/0/4/8/max_bit/log.ndjson",
    "min": "server/data/min/3/3/1/6/2/3/8/0/9/5/2/min_bit/log.ndjson"
  }
}
```

**응답 (중복):**
```json
{
  "ok": true,
  "deduped": true
}
```

**응답 (오류):**
```json
{
  "ok": false,
  "error": "에러 메시지"
}
```

### GET /api/log/by-max

MAX 값을 기준으로 데이터를 조회합니다.

**요청:**
```bash
curl "http://localhost:8123/api/log/by-max?nb_max=2.4&n=200"
```

**파라미터:**
- `nb_max` (required): 조회할 MAX 값
- `n` (optional): 최대 반환 레코드 수 (기본: 200, 최대: 5000)

**응답:**
```json
{
  "ok": true,
  "params": { "nb_max": 2.4 },
  "file": "server/data/max/2/4/6/4/2/6/1/9/0/4/8/max_bit/log.ndjson",
  "count": 5,
  "items": [
    {
      "t": 1761863999718,
      "s": "입력 문자열",
      "max": 2.4642619047619045,
      "min": 3.316238095238095
    },
    ...
  ]
}
```

**특징:**
- 정확한 경로에 데이터가 없으면 하위 폴더 재귀 탐색
- 최대 3단계 상위 폴더까지 확장 검색
- 근사값 기반 검색 지원

### GET /api/log/by-min

MIN 값을 기준으로 데이터를 조회합니다.

**요청:**
```bash
curl "http://localhost:8123/api/log/by-min?nb_min=3.0&n=200"
```

**파라미터:**
- `nb_min` (required): 조회할 MIN 값
- `n` (optional): 최대 반환 레코드 수 (기본: 200, 최대: 5000)

**응답:** GET /api/log/by-max와 동일한 형식

### GET /health

서버 상태를 확인합니다.

**요청:**
```bash
curl http://localhost:8123/health
```

**응답:**
```json
{
  "ok": true,
  "status": "healthy"
}
```

## 💾 데이터 저장 구조

### 폴더 구조

데이터는 `server/data/` 디렉토리에 다음과 같이 저장됩니다:

```
server/data/
├── max/
│   ├── 2/
│   │   ├── 4/
│   │   │   ├── 6/
│   │   │   │   ├── 4/
│   │   │   │   │   └── ... (자릿수별 폴더)
│   │   │   │   │       └── max_bit/
│   │   │   │   │           └── log.ndjson
│   │   │   │   └── ...
│   │   │   └── ...
│   │   └── ...
│   └── ...
└── min/
    ├── 3/
    │   ├── 3/
    │   │   └── ... (자릿수별 폴더)
    │   │       └── min_bit/
    │   │           └── log.ndjson
    │   └── ...
    └── ...
```

### 폴더 생성 규칙

1. **MAX 값 폴더 생성**
   - `max` 값을 소수점 10자리까지 고정 (`toFixed(10)`)
   - 소수점을 제거한 숫자 문자열의 각 자릿수를 폴더로 생성
   - 예: `2.4642619047619045` → `2`, `4`, `6`, `4`, `2`, `6`, `1`, `9`, `0`, `4`, `8`
   - 최종 경로: `max/2/4/6/4/2/6/1/9/0/4/8/max_bit/log.ndjson`

2. **MIN 값 폴더 생성**
   - 동일한 방식으로 `min` 폴더에 저장
   - 예: `3.316238095238095` → `min/3/3/1/6/2/3/8/0/9/5/2/min_bit/log.ndjson`

3. **NDJSON 형식**
   - 각 레코드는 한 줄에 하나의 JSON 객체
   - 마지막 줄은 개행 문자로 끝남
   - 파일에 append 방식으로 추가되어 효율적

### 저장 예시

**입력:**
```json
{
  "t": 1761863999718,
  "s": "안녕하세요",
  "max": 2.4642619047619045,
  "min": 3.316238095238095
}
```

**저장 위치:**
- `server/data/max/2/4/6/4/2/6/1/9/0/4/8/max_bit/log.ndjson`
- `server/data/min/3/3/1/6/2/3/8/0/9/5/2/min_bit/log.ndjson`

**파일 내용:**
```
{"t":1761863999718,"s":"안녕하세요","max":2.4642619047619045,"min":3.316238095238095}
```

## 🧮 BIT 계산 알고리즘

### BIT 계산의 기본 원리

BIT (Bit Information Theory) 계산은 문자열을 유니코드 배열로 변환하고, 이를 기반으로 MAX와 MIN 값을 계산합니다.

#### 1. 문자열 → 유니코드 변환

`wordNbUnicodeFormat` 함수를 사용하여 문자열을 유니코드 배열로 변환:
- 각 문자에 언어별 prefix 추가 (한국어: 1000000, 일본어: 2000000/3000000/4000000 등)
- 최종 배열: `[prefix + unicode_value, ...]`

**예시:**
```
"안녕" → [1000504, 10045397]
```

#### 2. BIT_MAX_NB 계산

- Forward Time Flow (정방향 시간 흐름)
- `calculateBit(nb, bit = 5.5, reverse = false)` 호출
- COUNT = 200으로 설정 (정확도 향상)
- 범위 기반 증분 계산

#### 3. BIT_MIN_NB 계산

- Reverse Time Flow (역방향 시간 흐름)
- `calculateBit(nb, bit = 5.5, reverse = true)` 호출
- NBA100 배열을 역순으로 처리

#### 4. 계산 파라미터

- **COUNT**: 200 (계산 정확도 조절)
- **BIT_NB**: 5.5 (기본 비트 값)
- **SUPER_BIT**: 이전 계산 결과 유지 (범위 초과 시 사용)

### 예측 알고리즘

선형 회귀(Linear Regression)를 사용하여 다음 값을 예측:

```javascript
y = ax + b
```

- `x`: 데이터 인덱스 (1, 2, 3, ...)
- `y`: BIT 값 (MAX 또는 MIN)
- `a`: 기울기 (slope)
- `b`: 절편 (intercept)

최근 20개 데이터를 기반으로 다음 값을 계산합니다.

## 📁 프로젝트 구조

```
.
├── bit_ui.html                  # BIT 계산 메인 UI
├── bit_search.html              # BIT 값 기반 검색 도구
├── database/
│   └── index.html              # 데이터베이스 대시보드
├── gpt_auto.html                # GPT 자동 속성/데이터 분석
├── gpt_auto_new.html            # GPT 자동 분석 (개선판)
├── input_tools.html             # 입력 도구
├── novel_composition.html       # 소설 구성 요소 분석
├── novel_composition_new.html   # 소설 구성 요소 분석 (개선판)
├── novel_composition_new2.html # 소설 구성 도구 (최신판)
├── real_time.html               # 실시간 속성/데이터 분석
├── server/
│   ├── server.js                # Express 서버 및 API
│   ├── package.json             # Node.js 의존성
│   └── data/                    # 데이터 저장 디렉토리
│       ├── max/                 # MAX 값 기반 폴더 구조
│       └── min/                 # MIN 값 기반 폴더 구조
├── backups/                     # 백업 파일 (자동 생성)
│   └── backup-YYYY-MM-DD_HH-mm-ss/
├── README.md                    # 이 파일
└── .gitignore                   # Git 무시 파일
```

### 주요 파일 설명

- **bit_ui.html**: 
  - 실시간 BIT 계산 UI
  - 예측 기능, 예측 입력값 표시
  - 자동 저장 및 조회 기능
  - IndexedDB를 통한 세션 히스토리 관리

- **novel_composition_new2.html**:
  - 소설 제목 및 챕터 관리
  - 계층적 데이터 저장 및 조회
  - 이중 프롬프트 시스템 (분석 모드 / 작가 모드)
  - BIT 기반 유사도 검색
  - 자동 저장 및 수정 기능

- **gpt_auto_new.html**:
  - GPT 기반 자동 속성 분석
  - BIT 유사도 검색 (속성으로만 검색 기본)
  - 정확한 유사도 계산 (100% 일치 우선)

- **bit_search.html**:
  - BIT 값 기반 속성 및 데이터 검색
  - 검색 결과 상세 표시
  - 데이터 추가 기능

- **server/server.js**:
  - Express.js 기반 REST API 서버
  - 데이터 저장/조회 엔드포인트
  - 중복 방지 로직
  - 재귀 폴더 탐색 기능
  - 속성/데이터 계층 관리 API

- **database/index.html**:
  - 데이터베이스 대시보드
  - 수동 저장 및 조회 기능
  - 데이터 관리 인터페이스

## ⚡ 성능 최적화

### 1. 디바운싱 및 쓰로틀링

- **입력 디바운싱**: 120ms 지연으로 불필요한 계산 방지
- **예측 쓰로틀링**: 250ms 간격으로 예측 계산 제한
- **예측 입력값 디바운싱**: 300ms 지연 후 계산

### 2. 비동기 처리

- `requestAnimationFrame`을 사용한 배치 처리
- 한 번에 10개씩 처리하여 UI 블로킹 방지

### 3. 계산 범위 제한

- 예측 입력값: 처음 15개, 중간 15개, 마지막 15개만 계산 (총 최대 45개)
- 긴 문자열에서도 성능 유지

### 4. 서버 최적화

- 중복 체크를 위한 인메모리 Set 사용
- 파일 기반 중복 확인
- 재귀 탐색 시 최대 깊이 제한 (3단계)

## 🔧 트러블슈팅

### 서버가 시작되지 않음

**문제**: `Error: listen EADDRINUSE`

**해결책:**
```bash
# Windows
Get-NetTCPConnection -LocalPort 8123 | Select-Object -ExpandProperty OwningProcess | Stop-Process -Force

# Linux/Mac
lsof -ti:8123 | xargs kill -9
```

### CORS 오류

**문제**: `Access to fetch at 'file:///...' has been blocked by CORS policy`

**해결책:**
- 파일을 직접 열지 말고 서버를 통해 접속: `http://localhost:8123/bit_ui.html`
- 또는 `getServerUrl()` 함수가 자동으로 처리합니다

### 데이터가 저장되지 않음

**확인사항:**
1. 서버가 실행 중인지 확인
2. `bit_ui.html`에서 "자동 저장" 체크박스가 활성화되어 있는지 확인
3. 브라우저 개발자 도구의 네트워크 탭에서 API 호출 확인
4. 서버 콘솔 로그 확인

### 조회 결과가 없음

**확인사항:**
1. 정확한 경로에 데이터가 있는지 확인
2. 서버가 하위 폴더까지 재귀 탐색하는지 확인
3. `nb_max` 또는 `nb_min` 파라미터 값 확인

## 👨‍💻 개발 가이드

### 개발 환경 설정

1. **의존성 설치**
   ```bash
   cd server
   npm install
   ```

2. **환경 변수 설정 (선택사항)**
   ```bash
   # .env 파일 생성
   PORT=8123
   DATA_DIR=./server/data
   ```

3. **개발 모드 실행**
   ```bash
   # nodemon 사용 (자동 재시작)
   npm install -g nodemon
   nodemon server.js
   ```

### 코드 구조

#### Frontend (`bit_ui.html`)

- **BIT 계산 로직**: 외부 스크립트(`bitCalculation.js`) 우선 사용, 없으면 로컬 구현
- **UI 업데이트**: `update()` 함수에서 실시간 계산 및 표시
- **서버 통신**: `getServerUrl()` 함수로 프로토콜별 URL 처리
- **히스토리 관리**: `sessionHistory` 배열과 IndexedDB 사용

#### Backend (`server/server.js`)

- **데이터 저장**: `/api/log` POST 엔드포인트
- **데이터 조회**: `/api/log/by-max`, `/api/log/by-min` GET 엔드포인트
- **폴더 생성**: `nestedPathFromNumber()` 함수
- **재귀 탐색**: `findAllLogFiles()` 함수

### 새로운 기능 추가

1. **Frontend 기능 추가**
   - `bit_ui.html`에 UI 요소 추가
   - JavaScript 함수 작성
   - 서버 API 호출 추가

2. **Backend API 추가**
   - `server/server.js`에 새 엔드포인트 추가
   - 필요한 로직 구현
   - 에러 처리 추가

### 테스트

```bash
# 서버 상태 확인
curl http://localhost:8123/health

# 데이터 저장 테스트
curl -X POST http://localhost:8123/api/log \
  -H "Content-Type: application/json" \
  -d '{"s":"test","max":2.5,"min":3.0}'

# 데이터 조회 테스트
curl "http://localhost:8123/api/log/by-max?nb_max=2.5&n=10"
```

## 🔐 보안 고려사항

- 현재는 로컬 개발용으로 설계됨
- 프로덕션 환경에서는 다음 사항을 고려하세요:
  - 인증/인가 추가
  - 입력 검증 강화
  - CORS 정책 설정
  - Rate limiting 추가
  - HTTPS 사용

## 📝 라이선스

MIT License

## 🤝 기여

이슈 리포트 및 풀 리퀘스트를 환영합니다!

## 📞 문의

프로젝트 관련 문의사항은 GitHub Issues를 통해 제출해주세요.

---

**Novel AI 프로젝트 기반 시스템** | 개발 중
