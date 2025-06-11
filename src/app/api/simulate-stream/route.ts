import { NextRequest, NextResponse } from "next/server";
import { AzureOpenAI } from "openai";
import { saveSimulationToGoogleSheets } from "@/lib/googlesheets";

// Vercel timeout 설정 (10분)
export const maxDuration = 600;

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
    // 메시지 유효성 검사
    const validMessages = messages.filter((msg) => {
      return (
        msg &&
        typeof msg === "object" &&
        msg.role &&
        msg.content &&
        typeof msg.content === "string" &&
        msg.content.trim().length > 0
      );
    });

    if (validMessages.length === 0) {
      throw new Error("유효한 메시지가 없습니다.");
    }

    const response = await openai.chat.completions.create({
      model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME || "gpt-4",
      messages: validMessages,
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content;
    // console.log({ content });
    if (!content || typeof content !== "string") {
      throw new Error("Azure OpenAI로부터 유효한 응답을 받지 못했습니다.");
    }

    return content;
  } catch (error) {
    console.error("Azure OpenAI 호출 오류:", error);
    throw error;
  }
}

export async function POST(request: NextRequest) {
  const {
    chatbotSystemPrompt,
    userPersonaPrompt,
    stepPrompts,
    debugMode = false,
  } = await request.json();

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
          try {
            // controller가 닫혔는지 확인
            if (controller.desiredSize === null) {
              console.warn("Controller is already closed, skipping update");
              return;
            }

            const jsonString = JSON.stringify(data);
            const chunk = `data: ${jsonString}\n\n`;
            controller.enqueue(new TextEncoder().encode(chunk));
          } catch (error) {
            console.error("sendUpdate 오류:", error);
            // controller가 이미 닫힌 경우 더 이상 시도하지 않음
            if (error instanceof Error && error.message.includes("closed")) {
              console.warn(
                "Controller가 이미 닫혔습니다. 더 이상 업데이트를 시도하지 않습니다."
              );
              return;
            }

            // JSON 직렬화 오류인 경우에만 재시도
            if (
              error instanceof Error &&
              error.name === "TypeError" &&
              !error.message.includes("closed") &&
              controller.desiredSize !== null
            ) {
              try {
                const errorChunk = `data: ${JSON.stringify({
                  type: "error",
                  error: "데이터 직렬화 오류",
                  timestamp: new Date().toISOString(),
                })}\n\n`;
                controller.enqueue(new TextEncoder().encode(errorChunk));
              } catch (secondError) {
                console.error("에러 메시지 전송 실패:", secondError);
              }
            }
          }
        };

        sendUpdate({
          type: "start",
          message: "시뮬레이션을 시작합니다...",
          timestamp: new Date().toISOString(),
          debugMode,
        });

        // 6단계 순차적으로 실행
        for (
          let stepIndex = 0;
          stepIndex < conversationSteps.length;
          stepIndex++
        ) {
          const currentStep = conversationSteps[stepIndex];
          const stepPrompt = stepPrompts[currentStep];

          // stepPrompt 유효성 검사
          if (
            !stepPrompt ||
            typeof stepPrompt !== "string" ||
            stepPrompt.trim().length === 0
          ) {
            sendUpdate({
              type: "error",
              error: `${currentStep} 단계의 프롬프트가 유효하지 않습니다.`,
              timestamp: new Date().toISOString(),
            });
            continue;
          }

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
            content: stepPrompt.trim(),
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

            // 챗봇 응답 유효성 검사
            if (
              !chatbotResponse ||
              typeof chatbotResponse !== "string" ||
              chatbotResponse.trim().length === 0
            ) {
              sendUpdate({
                type: "error",
                error: `${currentStep} 단계에서 챗봇 응답이 유효하지 않습니다.`,
                timestamp: new Date().toISOString(),
              });
              break;
            }

            chatbotHistory.push({
              role: "assistant",
              content: chatbotResponse.trim(),
            });

            // 챗봇 응답을 JSON으로 파싱 시도
            let chatbotData: {
              reasoning: string;
              is_step_complete: boolean;
              response_to_user: string;
            };
            try {
              chatbotData = JSON.parse(chatbotResponse || "{}");
            } catch (e) {
              chatbotData = {
                reasoning: "JSON 형식이 아닌 응답",
                is_step_complete: false,
                response_to_user: chatbotResponse.trim(),
              };
            }

            // response_to_user 유효성 검사
            if (
              !chatbotData.response_to_user ||
              typeof chatbotData.response_to_user !== "string" ||
              chatbotData.response_to_user.trim().length === 0
            ) {
              chatbotData.response_to_user =
                chatbotResponse.trim() || "응답을 생성할 수 없습니다.";
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
              // 디버그 모드일 때 전체 데이터 포함, 아닐 때는 response_to_user만
              displayData: debugMode
                ? chatbotData
                : { response_to_user: chatbotData.response_to_user },
            });

            // report 단계는 바로 종료
            if (currentStep === "report") {
              stepCompleted = true;
              break;
            }

            const isStepComplete = chatbotData.is_step_complete;

            // 2. 사용자 페르소나가 응답 생성
            const userPrompt = `다음은 AI 상담가가 너에게 한 말이야: "${chatbotData.response_to_user}". 너의 페르소나에 맞게 대답해.`;

            // userPrompt 유효성 검사
            if (!userPrompt || userPrompt.trim().length === 0) {
              sendUpdate({
                type: "error",
                error: `${currentStep} 단계에서 사용자 프롬프트 생성에 실패했습니다.`,
                timestamp: new Date().toISOString(),
              });
              break;
            }

            userHistory.push({ role: "user", content: userPrompt.trim() });
            const userResponse = await callAzureOpenAI(userHistory, 500);

            // 사용자 응답 유효성 검사
            if (
              !userResponse ||
              typeof userResponse !== "string" ||
              userResponse.trim().length === 0
            ) {
              sendUpdate({
                type: "error",
                error: `${currentStep} 단계에서 사용자 응답이 유효하지 않습니다.`,
                timestamp: new Date().toISOString(),
              });
              break;
            }

            userHistory.push({
              role: "assistant",
              content: userResponse.trim(),
            });

            // 대화 로그에 추가
            const userEntry = {
              step: currentStep,
              turn: turnCount,
              speaker: "user",
              message: userResponse.trim(),
              timestamp: new Date().toISOString(),
            };
            conversation.push(userEntry);

            // 사용자 응답을 실시간으로 전송
            sendUpdate({
              type: "user_response",
              ...userEntry,
            });

            // 3. 사용자 응답을 챗봇 히스토리에 추가
            chatbotHistory.push({ role: "user", content: userResponse.trim() });

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

        // controller가 아직 열려있는 경우에만 에러 메시지 전송
        if (controller.desiredSize !== null) {
          try {
            const errorUpdate = {
              type: "error",
              error: `시뮬레이션 중 오류가 발생했습니다: ${error.message}`,
              details: {
                name: error.name,
                message: error.message,
                stack: error.stack?.slice(0, 500), // 스택 트레이스 일부만 포함
                timestamp: new Date().toISOString(),
              },
              timestamp: new Date().toISOString(),
            };

            const chunk = `data: ${JSON.stringify(errorUpdate)}\n\n`;
            controller.enqueue(new TextEncoder().encode(chunk));
          } catch (enqueueError) {
            console.error("에러 메시지 전송 실패:", enqueueError);
          }
        } else {
          console.warn(
            "Controller가 이미 닫혀서 에러 메시지를 전송할 수 없습니다."
          );
        }

        // controller가 아직 열려있는 경우에만 닫기
        if (controller.desiredSize !== null) {
          controller.close();
        }
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
