# BIT 계산 시스템

BIT_MAX와 BIT_MIN을 실시간으로 계산하고 저장하는 웹 애플리케이션입니다.

## 기능

- **실시간 BIT 계산**: 텍스트 입력 시 BIT_MAX, BIT_MIN 자동 계산
- **예측 기능**: 최근 히스토리 기반 NEXT_MAX, NEXT_MIN 예측
- **자동 저장**: 서버에 자동으로 데이터 저장 (중복 방지)
- **계층적 저장**: max/min 값에 따라 자동 폴더 분류 저장
- **근사 검색**: 서버 API를 통한 근사값 검색 지원

## 설치

### 요구사항

- Node.js (v14 이상)
- npm

### 설치 방법

```bash
cd server
npm install
```

## 실행

```bash
cd server
npm start
```

기본적으로 `http://localhost:8123`에서 서버가 실행됩니다.

포트를 변경하려면:

```bash
cd server
$env:PORT=8123; npm start  # Windows PowerShell
# 또는
PORT=8123 npm start       # Linux/Mac
```

## 사용법

### 웹 UI

1. 브라우저에서 `http://localhost:8123/bit_ui.html` 접속
2. 텍스트 입력 시 자동으로 BIT_MAX, BIT_MIN 계산
3. 자동 저장 체크박스로 서버 저장 여부 제어
4. 기록 보기에서 히스토리 확인

### 데이터베이스 대시보드

`http://localhost:8123/database/index.html`에서:
- 레코드 수동 저장
- 서버 데이터 조회

## API 사용법

### 저장 (POST /api/log)

```bash
curl -X POST http://localhost:8123/api/log \
  -H "Content-Type: application/json" \
  -d '{"s":"테스트","max":2.73,"min":3.07}'
```

**응답:**
```json
{
  "ok": true,
  "files": {
    "max": "경로/to/max/.../max_bit/log.ndjson",
    "min": "경로/to/min/.../min_bit/log.ndjson"
  }
}
```

중복 데이터인 경우:
```json
{
  "ok": true,
  "deduped": true
}
```

### 조회 (GET /api/log/by-max)

```bash
curl "http://localhost:8123/api/log/by-max?nb_max=2.4&n=200"
```

**파라미터:**
- `nb_max`: 조회할 MAX 값
- `n`: 최대 반환 레코드 수 (기본: 200, 최대: 5000)

**응답:**
```json
{
  "ok": true,
  "params": { "nb_max": 2.4 },
  "file": "경로",
  "count": 5,
  "items": [
    { "t": 1761863999718, "s": "입력", "max": 2.46, "min": 3.31 },
    ...
  ]
}
```

정확한 경로에 데이터가 없으면 하위 폴더를 재귀 탐색하여 관련 데이터를 모두 반환합니다.

### 조회 (GET /api/log/by-min)

```bash
curl "http://localhost:8123/api/log/by-min?nb_min=3.0&n=200"
```

## 데이터 저장 구조

데이터는 `server/data/` 디렉토리에 다음과 같이 저장됩니다:

```
server/data/
├── max/
│   ├── 2/
│   │   ├── 4/
│   │   │   ├── 6/
│   │   │   │   └── ...
│   │   │   │       └── max_bit/
│   │   │   │           └── log.ndjson
│   └── ...
└── min/
    ├── 3/
    │   ├── 3/
    │   │   └── ...
    │   │       └── min_bit/
    │   │           └── log.ndjson
    └── ...
```

### 폴더 생성 규칙

- `max` 값의 소수점 10자리를 자릿수별로 폴더 생성
- `min` 값의 소수점 10자리를 자릿수별로 폴더 생성
- 각 폴더 최하위에 `max_bit` 또는 `min_bit` 서브폴더 생성
- 최종 `log.ndjson` 파일에 NDJSON 형식으로 저장

### 예시

- `max=2.4642619047619045` → `max/2/4/6/4/2/6/1/9/0/4/8/max_bit/log.ndjson`
- `min=3.316238095238095` → `min/3/3/1/6/2/3/8/0/9/5/2/min_bit/log.ndjson`

## 중복 저장 방지

서버는 다음 조건으로 중복을 판단합니다:

- 동일한 `s` (입력 문자열)
- 동일한 `max` 값 (부동소수점 오차 1e-10 이내)
- 동일한 `min` 값 (부동소수점 오차 1e-10 이내)

중복 데이터는 저장하지 않고 `deduped: true` 응답을 반환합니다.

## 파일 구조

```
.
├── bit_ui.html          # BIT 계산 UI
├── database/
│   └── index.html       # 데이터베이스 대시보드
├── server/
│   ├── server.js        # Express 서버
│   ├── package.json     # Node.js 의존성
│   └── data/            # 데이터 저장 디렉토리
│       ├── max/         # MAX 값 기반 폴더
│       └── min/         # MIN 값 기반 폴더
└── README.md            # 이 파일
```

## 기술 스택

- **Frontend**: HTML, JavaScript (Vanilla)
- **Backend**: Node.js, Express.js
- **데이터 형식**: NDJSON (Newline Delimited JSON)

## 라이선스

MIT

