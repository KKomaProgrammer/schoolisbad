# 학교는 바뀌어야 한다

대한민국 학교·사교육 문제를 기록하고 비판하는 Cloudflare Pages 사이트입니다.

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

## 선택 환경 변수

```txt
SENTIMENT_AI_URL=https://your-sentiment-api.example.com/predict
```

`github-jademon/SentimentAI`는 Python/TensorFlow 기반이라 Cloudflare Pages Functions에서 직접 실행할 수 없습니다. 그래서 서버 API는 먼저 `SENTIMENT_AI_URL`을 호출하고, 값이 없거나 실패하면 Cloudflare Edge에서 동작하는 JS 감정 검사기로 대체합니다.

외부 SentimentAI API 응답 예시는 아래 중 하나면 됩니다.

```json
{ "label": "negative" }
```

```json
{ "result": "부정" }
```

통과 가능 결과는 `functions/api/posts.js` 상단의 `PASS_SENTIMENT_LABELS` 변수에서 관리합니다. 기본값은 `neutral`, `negative`입니다.

## 기능

- 문제점 등록, 목록 표시
- 글은 IP당 최대 1개
- 본인 글 수정·삭제
- 관리자 글 삭제
- 관리자 선정 글 최대 4개
- 감정 검사 5회 미통과 시 IP 40분 차단
- 차단 만료 시각을 서버 응답 기준으로 프론트 localStorage에 저장
- 차단 중에는 프론트에서 API 요청 전 안내 문구 표시
- 서버에서도 IP 차단 리스트 재검사
- 관리자 페이지에서 시간순 차단 리스트 확인 및 특정 IP 해제

## 관리자 페이지

```txt
/admin
```

로그인은 서버의 `/api/enter`에서 처리하고, 이후 관리자 API는 Bearer 세션으로 보호됩니다.
