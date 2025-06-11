# Vercel 배포 가이드

## 배포 전 준비사항

### 1. 환경 변수 설정

Vercel 대시보드에서 다음 환경 변수들을 설정해야 합니다:

```
AZURE_OPENAI_ENDPOINT=your-azure-openai-endpoint
AZURE_OPENAI_API_KEY=your-azure-openai-api-key
AZURE_OPENAI_DEPLOYMENT_NAME=your-deployment-name
OPENAI_API_VERSION=2024-08-01-preview
```

### 2. Vercel CLI를 사용한 배포

1. Vercel CLI 설치:

```bash
npm i -g vercel
```

2. 프로젝트 루트에서 배포:

```bash
vercel
```

3. 첫 배포 시 설정:

- Project name: `chatbot-simulator`
- Framework: `Other`
- Build settings: 기본값 사용

### 3. GitHub를 통한 배포

1. GitHub에 프로젝트 푸시
2. Vercel 대시보드에서 "New Project" 선택
3. GitHub 저장소 연결
4. 환경 변수 설정
5. 배포 시작

## 주요 설정

- 프론트엔드: React + Vite (client 폴더)
- 백엔드: Express.js (server 폴더)
- API 경로: `/api/*`는 서버로 라우팅
- 정적 파일: 클라이언트 빌드 결과물 서빙

## 배포 후 확인사항

1. 프론트엔드가 정상적으로 로드되는지 확인
2. API 엔드포인트가 작동하는지 확인
3. 환경 변수가 올바르게 설정되었는지 확인
