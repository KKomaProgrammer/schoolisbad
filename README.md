# 학교는 바뀌어야 한다

학교·사교육 문제를 비판적으로 기록하는 Cloudflare Pages 사이트입니다.

## 배포

Cloudflare Pages에서 이 저장소의 `main` 브랜치를 연결합니다.

- Build command: 비움
- Build output directory: `/` 또는 `.`
- Functions: `functions/` 자동 인식
- KV binding name: `SCHOOLISBAD_KV`

## 필수 환경 변수

Cloudflare Pages → Settings → Environment variables에 추가합니다.

```txt
ADMIN_ID=관리자아이디
ADMIN_PW=관리자PW
ADMIN_SESSION_SECRET=긴랜덤문자열
```

## 감정 검사

`github-jademon/SentimentAI`의 Python 흐름을 Cloudflare Pages Functions에서 실행 가능한 JS 코드로 이식했습니다.

원본 흐름:

```txt
Tokenizer → texts_to_sequences → pad_sequences → Embedding/LSTM/LSTM/Dense(sigmoid) → 0.5 기준 분류
```

현재 백엔드 이식 파일:

```txt
functions/lib/sentiment.js
```

통과 가능 결과는 아래 파일 상단 변수에서 관리합니다.

```txt
functions/api/posts.js
PASS_SENTIMENT_LABELS = ["neutral", "negative"]
```

## 기능

- 비판적 문제 기록 등록
- 글은 IP당 최대 1개
- 본인 글 수정·삭제
- 관리자 글 삭제
- 관리자 선정 증언 최대 4개
- 감정 검사 5회 미통과 시 IP 40분 차단
- 차단 만료 시각을 서버 응답 기준으로 프론트 localStorage에 저장
- 차단 중에는 프론트에서 API 요청 전 안내 문구 표시
- 서버에서도 IP 차단 리스트 재검사
- 관리자 페이지에서 시간순 차단 리스트 확인 및 특정 IP 해제

## 관리자 페이지

직접 접속합니다.

```txt
/admin
```

메인 화면에는 관리자 페이지 접속 버튼을 두지 않습니다.
