// server/server.js (Azure 연동 최종 강화 버전)
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { AzureOpenAI } = require("openai"); // 최신 라이브러리 구조

const app = express();
const PORT = process.env.PORT || 8080;

app.use(cors());
app.use(express.json());

const openai = new AzureOpenAI({
  apiVersion: process.env.OPENAI_API_VERSION || "2024-08-01-preview",
  endpoint: process.env.AZURE_OPENAI_ENDPOINT,
  apiKey: process.env.AZURE_OPENAI_API_KEY,
});

const conversationSteps = [
  "강점",
  "적성",
  "흥미",
  "가치관",
  "욕구와 동기",
  "report",
];

// 백업 디렉토리 생성
const backupDir = path.join(__dirname, "backups");
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
}

// Azure OpenAI 호출 함수
async function callAzureOpenAI(messages, maxTokens = 1000) {
  try {
    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4",
      messages: messages,
      max_tokens: maxTokens,
      temperature: 0.7,
    });
    return response.choices[0].message.content;
  } catch (error) {
    console.error("Azure OpenAI 호출 오류:", error);
    throw error;
  }
}

// 채팅 시뮬레이션 API
app.post("/api/simulate", async (req, res) => {
  try {
    const { chatbotSystemPrompt, userPersonaPrompt, stepPrompts } = req.body;

    if (!chatbotSystemPrompt || !userPersonaPrompt || !stepPrompts) {
      return res.status(400).json({
        error:
          "필수 파라미터가 누락되었습니다: chatbotSystemPrompt, userPersonaPrompt, stepPrompts",
      });
    }

    console.log("시뮬레이션 시작...");

    const conversation = [];
    let chatbotHistory = [{ role: "system", content: chatbotSystemPrompt }];
    let userHistory = [{ role: "system", content: userPersonaPrompt }];

    // 6단계 순차적으로 실행
    for (let stepIndex = 0; stepIndex < conversationSteps.length; stepIndex++) {
      const currentStep = conversationSteps[stepIndex];
      const stepPrompt = stepPrompts[currentStep];

      console.log(`\n=== ${currentStep} 단계 시작 ===`);

      // 챗봇에게 단계별 임무 부여
      const taskMessage = {
        role: "user",
        content: stepPrompt,
      };
      chatbotHistory.push(taskMessage);

      let stepCompleted = false;
      let turnCount = 0;
      const maxTurnsPerStep = currentStep === "report" ? 1 : 10; // report는 1턴만

      while (!stepCompleted && turnCount < maxTurnsPerStep) {
        turnCount++;
        console.log(`${currentStep} 단계 - ${turnCount}번째 턴`);

        // 1. 챗봇이 응답 생성
        const chatbotResponse = await callAzureOpenAI(chatbotHistory, 1500);
        console.log("챗봇 응답:", chatbotResponse);

        chatbotHistory.push({ role: "assistant", content: chatbotResponse });

        // 챗봇 응답을 JSON으로 파싱 시도
        let chatbotData;
        try {
          chatbotData = JSON.parse(chatbotResponse);
        } catch (e) {
          console.log("JSON 파싱 실패, 일반 텍스트로 처리");
          chatbotData = {
            reasoning: "JSON 형식이 아닌 응답",
            is_step_complete: false,
            response_to_user: chatbotResponse,
          };
        }

        // 대화 로그에 추가
        conversation.push({
          step: currentStep,
          turn: turnCount,
          speaker: "chatbot",
          message: chatbotData,
          timestamp: new Date().toISOString(),
        });

        // report 단계는 바로 종료 (사용자 응답 불필요)
        if (currentStep === "report") {
          console.log(`${currentStep} 단계 완료 (report)`);
          stepCompleted = true;
          break;
        }

        // 단계 완료 체크 - 완료되었어도 사용자 응답은 받는다
        const isStepComplete = chatbotData.is_step_complete;

        // 2. 사용자 페르소나가 응답 생성
        const userPrompt = `다음은 AI 상담가가 너에게 한 말이야: "${chatbotData.response_to_user}"\n\n이에 대해 자연스럽고 솔직하게 답변해줘. 너의 페르소나에 맞게 2-3문장 정도로 대답해.`;

        userHistory.push({ role: "user", content: userPrompt });
        const userResponse = await callAzureOpenAI(userHistory, 500);
        console.log("사용자 응답:", userResponse);

        userHistory.push({ role: "assistant", content: userResponse });

        // 대화 로그에 추가
        conversation.push({
          step: currentStep,
          turn: turnCount,
          speaker: "user",
          message: userResponse,
          timestamp: new Date().toISOString(),
        });

        // 3. 사용자 응답을 챗봇 히스토리에 추가
        chatbotHistory.push({ role: "user", content: userResponse });

        // 단계 완료 시 루프 종료 (사용자 응답을 받은 후)
        if (isStepComplete) {
          console.log(`${currentStep} 단계 완료 (is_step_complete: true)`);
          stepCompleted = true;
          break;
        }
      }

      if (!stepCompleted && currentStep !== "report") {
        console.log(
          `${currentStep} 단계가 최대 턴 수에 도달했지만 완료되지 않음`
        );
      }
    }

    // 백업 저장
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const filename = `simulation-backup-${timestamp}.json`;
    const backupPath = path.join(backupDir, filename);

    const backupData = {
      timestamp: new Date().toISOString(),
      prompts: {
        chatbotSystemPrompt,
        userPersonaPrompt,
        stepPrompts,
      },
      conversation,
      summary: {
        totalSteps: conversationSteps.length,
        totalTurns: conversation.length,
        completedSteps: conversationSteps.filter((step) =>
          conversation.some((entry) => entry.step === step)
        ).length,
      },
    };

    fs.writeFileSync(backupPath, JSON.stringify(backupData, null, 2));
    console.log(`백업 저장 완료: ${filename}`);

    res.json({
      conversation,
      backup: {
        success: true,
        filename: filename,
        path: backupPath,
      },
      summary: backupData.summary,
    });
  } catch (error) {
    console.error("시뮬레이션 오류:", error);
    res.status(500).json({
      error: "시뮬레이션 중 오류가 발생했습니다",
      details: error.message,
    });
  }
});

// 백업 파일 목록 조회 API
app.get("/api/backups", (req, res) => {
  try {
    const files = fs
      .readdirSync(backupDir)
      .filter((file) => file.endsWith(".json"))
      .map((file) => {
        const filePath = path.join(backupDir, file);
        const stats = fs.statSync(filePath);
        return {
          filename: file,
          size: stats.size,
          created: stats.birthtime,
          modified: stats.mtime,
        };
      })
      .sort((a, b) => b.created - a.created);

    res.json(files);
  } catch (error) {
    console.error("백업 목록 조회 오류:", error);
    res.status(500).json({ error: "백업 목록을 가져올 수 없습니다" });
  }
});

// 특정 백업 파일 다운로드 API
app.get("/api/backups/:filename", (req, res) => {
  try {
    const filename = req.params.filename;
    const filePath = path.join(backupDir, filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: "파일을 찾을 수 없습니다" });
    }

    res.download(filePath);
  } catch (error) {
    console.error("백업 파일 다운로드 오류:", error);
    res.status(500).json({ error: "파일 다운로드 중 오류가 발생했습니다" });
  }
});

app.listen(PORT, () => {
  console.log(`서버가 http://localhost:${PORT}에서 실행 중입니다`);
  console.log(`백업 디렉토리: ${backupDir}`);
});
