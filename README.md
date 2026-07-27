# 우리 캘린더

웨딩플래너의 캘린더 기능만 분리한 독립 Next.js 앱입니다. 기존 Firebase Data Connect를 그대로 사용하므로 같은 계정으로 로그인하면 기존 일정이 이어집니다.

운영 주소: [https://calendar-seven-blue.vercel.app](https://calendar-seven-blue.vercel.app)

## 포함된 기능

- 월간 캘린더와 날짜별 일정
- 일정 등록·수정·삭제
- 신랑·신부·공통 담당 구분
- 카카오 장소 검색
- 날짜별 장소 지도와 방문 동선
- 웹 공유·카카오톡 공유·링크 복사
- 기존 카카오 또는 이메일 계정 로그인

업체 후보·예약·잔금 마커와 일정 조율 기능은 의도적으로 제외했습니다.

## 로컬 실행

Node.js 24가 필요합니다.

```bash
npm install
copy .env.example .env.local
npm run dev
```

브라우저에서 `http://localhost:3000`을 엽니다.

## 환경변수

`.env.example`을 기준으로 설정합니다.

- `AUTH_SECRET`: 32자 이상의 임의 문자열
- `FIREBASE_SERVICE_ACCOUNT_JSON`: Firebase 서비스 계정 JSON 전체
- `NEXT_PUBLIC_FIREBASE_*`: 이메일 로그인용 Firebase 웹 앱 값
- `FIREBASE_DATA_CONNECT_*`: 기존 `wedding-server` connector 값
- `KAKAO_REST_API_KEY`: 카카오 로그인·장소 검색·자동차 경로
- `NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY`: 지도와 카카오 공유
- `APP_URL`, `PUBLIC_APP_URL`: 배포된 캘린더 주소

기존 웨딩플래너와 같은 `FIREBASE_DATA_CONNECT_*` 값을 사용하면 일정 데이터가 공유됩니다. 이 저장소는 이미 배포된 connector를 호출할 뿐이며, Data Connect 스키마를 별도로 배포하지 않습니다.

## Vercel 배포

이 앱은 서버 인증, Route Handler, Firebase Admin을 사용하므로 정적 GitHub Pages에서는 실행할 수 없습니다.

1. Vercel에서 `namyeoungchan/calendar` 저장소를 새 프로젝트로 가져옵니다.
2. 기존 웨딩플래너 Vercel 프로젝트의 Firebase·Data Connect·카카오 환경변수를 새 프로젝트에도 등록합니다.
3. `APP_URL`과 `PUBLIC_APP_URL`을 새 운영 주소로 지정합니다.
4. 카카오 개발자 콘솔에 다음 값을 추가합니다.
   - Redirect URI: `https://새주소/api/auth/kakao/callback`
   - JavaScript SDK 도메인: `https://새주소`
   - 제품 링크 도메인: `https://새주소`
5. Firebase Authentication의 승인된 도메인에 새 호스트를 추가합니다.
6. Vercel에서 Production 배포를 실행합니다.

## 검증

```bash
npm run typecheck
npm run build
```
