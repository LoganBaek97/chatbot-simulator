# AI 챗봇 시뮬레이터

Next.js로 구축된 AI 챗봇과 사용자 간의 대화 시뮬레이션 도구입니다.

## 기능

- AI 챗봇 페르소나 설정
- 사용자 페르소나 설정
- 6단계 대화 시뮬레이션 (강점, 적성, 흥미, 가치관, 욕구와 동기, 리포트)
- 실시간 대화 로그 및 결과 다운로드

## 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **AI**: Azure OpenAI / OpenAI API
- **배포**: Vercel

## 로컬 개발 환경 설정

1. 의존성 설치:
   \`\`\`bash
   npm install
   \`\`\`

2. 환경 변수 설정:
   \`env.example\` 파일을 참고하여 \`.env.local\` 파일을 생성하고 다음 변수들을 설정하세요:

\`\`\`
AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
OPENAI_API_VERSION=2024-08-01-preview

# Google Sheets 통합 (선택사항)

GOOGLE_SHEET_ID=your-google-sheet-id
GOOGLE_SERVICE_ACCOUNT_KEY={"type":"service_account",...}
\`\`\`

3. 개발 서버 실행:
   \`\`\`bash
   npm run dev
   \`\`\`

4. 브라우저에서 [http://localhost:3000](http://localhost:3000) 접속

## Google Sheets 연동 설정 (선택사항)

시뮬레이션 결과를 Google Sheets에 자동으로 저장하려면:

### 1. Google Cloud 프로젝트 생성

1. [Google Cloud Console](https://console.cloud.google.com/) 접속
2. 새 프로젝트 생성 (예: "chatbot-simulator")
3. 프로젝트 선택

### 2. Google Sheets API 활성화

1. "API 및 서비스" > "라이브러리" 클릭
2. "Google Sheets API" 검색 후 선택
3. "사용" 클릭

### 3. 서비스 계정 생성

1. "API 및 서비스" > "사용자 인증 정보" 클릭
2. "사용자 인증 정보 만들기" > "서비스 계정" 선택
3. 서비스 계정 이름 입력 (예: "sheets-service")
4. "만들기 및 계속" 클릭

### 4. 서비스 계정 키 생성

1. 생성된 서비스 계정 클릭
2. "키" 탭 > "키 추가" > "새 키 만들기"
3. "JSON" 선택 후 "만들기"
4. 다운로드된 JSON 파일 내용을 `GOOGLE_SERVICE_ACCOUNT_KEY`에 설정

### 5. Google Sheets 생성 및 공유

1. [Google Sheets](https://sheets.google.com/)에서 새 시트 생성
2. 시트 제목: "AI 챗봇 시뮬레이션 로그"
3. "공유" 버튼 클릭
4. 서비스 계정 이메일 주소 추가 (JSON 파일의 `client_email` 값)
5. 권한을 "편집자"로 설정

### 6. 시트 ID 가져오기

Google Sheets URL에서 ID 추출:

```
https://docs.google.com/spreadsheets/d/SHEET_ID/edit
```

`SHEET_ID` 부분을 복사하여 `GOOGLE_SHEET_ID`에 설정

## Vercel 배포

### 방법 1: Vercel CLI 사용

\`\`\`bash
npm i -g vercel
vercel
\`\`\`

### 방법 2: GitHub 연동

1. GitHub에 코드 푸시
2. [Vercel 대시보드](https://vercel.com/dashboard)에서 "New Project" 선택
3. GitHub 저장소 연결
4. 환경 변수 설정 (위의 환경 변수들을 Vercel 대시보드에서 설정)
5. 배포 시작

## 사용법

1. 웹사이트에 접속
2. AI 챗봇 시스템 프롬프트 설정
3. 각 단계별 프롬프트 설정
4. 사용자 페르소나 프롬프트 설정
5. "결과물 생성하기" 버튼 클릭
6. 시뮬레이션 결과 확인 및 다운로드

## 프로젝트 구조

\`\`\`
├── src/
│ ├── app/
│ │ ├── api/simulate/
│ │ │ └── route.ts # API 엔드포인트
│ │ ├── globals.css # 글로벌 스타일
│ │ ├── layout.tsx # 루트 레이아웃
│ │ └── page.tsx # 메인 페이지
├── package.json
├── next.config.js
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json # Vercel 배포 설정
└── env.example # 환경 변수 예시
\`\`\`

## 라이선스

ISC
