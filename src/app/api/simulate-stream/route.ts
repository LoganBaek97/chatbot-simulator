import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { saveSimulationToGoogleSheets } from "@/lib/googlesheets";

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

// Azure OpenAI 호출 함수
async function callAzureOpenAI(messages: any[], maxTokens = 1000) {
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

export async function POST(request: NextRequest) {
  const { chatbotSystemPrompt, userPersonaPrompt, stepPrompts } =
    await request.json();

  if (!chatbotSystemPrompt || !userPersonaPrompt || !stepPrompts) {
    return NextResponse.json(
      {
        error:
          "필수 파라미터가 누락되었습니다: chatbotSystemPrompt, userPersonaPrompt, stepPrompts",
      },
      { status: 400 }
    );
  }

  // ReadableStream을 사용한 스트리밍 응답
  const stream = new ReadableStream({
    async start(controller) {
      try {
        const conversation: any[] = [];
        let chatbotHistory = [{ role: "system", content: chatbotSystemPrompt }];
        let userHistory = [{ role: "system", content: userPersonaPrompt }];

        // 진행 상황을 실시간으로 전송
        const sendUpdate = (data: any) => {
          const chunk = `data: ${JSON.stringify(data)}\n\n`;
          controller.enqueue(new TextEncoder().encode(chunk));
        };

        sendUpdate({
          type: "start",
          message: "시뮬레이션을 시작합니다...",
          timestamp: new Date().toISOString(),
        });

        // 6단계 순차적으로 실행
        for (
          let stepIndex = 0;
          stepIndex < conversationSteps.length;
          stepIndex++
        ) {
          const currentStep = conversationSteps[stepIndex];
          const stepPrompt = stepPrompts[currentStep];

          sendUpdate({
            type: "step_start",
            step: currentStep,
            stepIndex: stepIndex + 1,
            totalSteps: conversationSteps.length,
            timestamp: new Date().toISOString(),
          });

          // 챗봇에게 단계별 임무 부여
          const taskMessage = {
            role: "user",
            content: stepPrompt,
          };
          chatbotHistory.push(taskMessage);

          let stepCompleted = false;
          let turnCount = 0;
          const maxTurnsPerStep = currentStep === "report" ? 1 : 10;

          while (!stepCompleted && turnCount < maxTurnsPerStep) {
            turnCount++;

            sendUpdate({
              type: "turn_start",
              step: currentStep,
              turn: turnCount,
              maxTurns: maxTurnsPerStep,
              timestamp: new Date().toISOString(),
            });

            // 1. 챗봇이 응답 생성
            const chatbotResponse = await callAzureOpenAI(chatbotHistory, 1500);
            chatbotHistory.push({
              role: "assistant",
              content: chatbotResponse,
            });

            // 챗봇 응답을 JSON으로 파싱 시도
            let chatbotData;
            try {
              chatbotData = JSON.parse(chatbotResponse || "{}");
            } catch (e) {
              chatbotData = {
                reasoning: "JSON 형식이 아닌 응답",
                is_step_complete: false,
                response_to_user: chatbotResponse,
              };
            }

            // 대화 로그에 추가
            const chatbotEntry = {
              step: currentStep,
              turn: turnCount,
              speaker: "chatbot",
              message: chatbotData,
              timestamp: new Date().toISOString(),
            };
            conversation.push(chatbotEntry);

            // 챗봇 응답을 실시간으로 전송
            sendUpdate({
              type: "chatbot_response",
              ...chatbotEntry,
            });

            // report 단계는 바로 종료
            if (currentStep === "report") {
              stepCompleted = true;
              break;
            }

            const isStepComplete = chatbotData.is_step_complete;

            // 2. 사용자 페르소나가 응답 생성
            const userPrompt = `다음은 AI 상담가가 너에게 한 말이야: "${chatbotData.response_to_user}"\n\n이에 대해 자연스럽고 솔직하게 답변해줘. 너의 페르소나에 맞게 2-3문장 정도로 대답해.`;

            userHistory.push({ role: "user", content: userPrompt });
            const userResponse = await callAzureOpenAI(userHistory, 500);
            userHistory.push({ role: "assistant", content: userResponse });

            // 대화 로그에 추가
            const userEntry = {
              step: currentStep,
              turn: turnCount,
              speaker: "user",
              message: userResponse,
              timestamp: new Date().toISOString(),
            };
            conversation.push(userEntry);

            // 사용자 응답을 실시간으로 전송
            sendUpdate({
              type: "user_response",
              ...userEntry,
            });

            // 3. 사용자 응답을 챗봇 히스토리에 추가
            chatbotHistory.push({ role: "user", content: userResponse });

            if (isStepComplete) {
              stepCompleted = true;
              break;
            }
          }

          sendUpdate({
            type: "step_complete",
            step: currentStep,
            completed: stepCompleted,
            timestamp: new Date().toISOString(),
          });
        }

        // 시뮬레이션 요약 정보
        const summary = {
          totalSteps: conversationSteps.length,
          totalTurns: conversation.length,
          completedSteps: conversationSteps.filter((step) =>
            conversation.some((entry) => entry.step === step)
          ).length,
        };

        // Google Sheets에 저장 시도
        sendUpdate({
          type: "saving",
          message: "Google Sheets에 결과를 저장하고 있습니다...",
          timestamp: new Date().toISOString(),
        });

        const timestamp = new Date().toISOString();
        let sheetsResult = null;

        try {
          sheetsResult = await saveSimulationToGoogleSheets({
            conversation,
            summary,
            timestamp,
            prompts: {
              chatbotSystemPrompt,
              userPersonaPrompt,
              stepPrompts,
            },
          });
        } catch (error: any) {
          console.error("Google Sheets 저장 실패:", error);
        }

        // 최종 결과 전송
        sendUpdate({
          type: "complete",
          conversation,
          summary,
          backup: {
            success: true,
            filename: `simulation-backup-${timestamp.replace(
              /[:.]/g,
              "-"
            )}.json`,
            timestamp,
            sheets: sheetsResult,
          },
          timestamp: new Date().toISOString(),
        });

        controller.close();
      } catch (error: any) {
        console.error("스트리밍 시뮬레이션 오류:", error);

        const errorUpdate = {
          type: "error",
          error: "시뮬레이션 중 오류가 발생했습니다: " + error.message,
          timestamp: new Date().toISOString(),
        };

        const chunk = `data: ${JSON.stringify(errorUpdate)}\n\n`;
        controller.enqueue(new TextEncoder().encode(chunk));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    },
  });
}
