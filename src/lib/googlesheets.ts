import { google } from "googleapis";

// Google Sheets 클라이언트 초기화
function getGoogleSheetsClient() {
  // Base64 인코딩된 환경변수 우선 사용
  const base64Credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;

  if (!base64Credentials) {
    throw new Error(
      "Google Service Account 키가 설정되지 않았습니다. GOOGLE_SERVICE_ACCOUNT_KEY 또는 GOOGLE_SERVICE_ACCOUNT_KEY를 설정하세요."
    );
  }

  try {
    const credentials = Buffer.from(base64Credentials, "base64").toString(
      "utf-8"
    );

    // JSON 파싱 후 private_key의 개행문자 처리
    const parsedCredentials = JSON.parse(credentials);

    // private_key에서 \\n을 실제 개행문자로 변환
    if (parsedCredentials.private_key) {
      parsedCredentials.private_key = parsedCredentials.private_key.replace(
        /\\n/g,
        "\n"
      );
    }

    const auth = new google.auth.GoogleAuth({
      credentials: parsedCredentials,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    return google.sheets({ version: "v4", auth });
  } catch (error: any) {
    console.error("Google Service Account 키 파싱 오류:", error);
    console.error("Base64 환경변수 존재:", !!base64Credentials);

    throw new Error(`Google Service Account 키 파싱 실패: ${error.message}`);
  }
}

// 요약 시트가 존재하는지 확인하고 없으면 생성하는 함수
async function ensureSummarySheetExists(sheets: any, spreadsheetId: string) {
  try {
    // 요약 시트가 있는지 확인
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: "시뮬레이션 요약!A1",
    });
  } catch (error: any) {
    try {
      // 요약 시트 생성
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: "시뮬레이션 요약",
                },
              },
            },
          ],
        },
      });

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "시뮬레이션 요약!A1:F1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            ["생성일시", "총 단계", "총 턴", "완료 단계", "상태", "시트명"],
          ],
        },
      });
    } catch (createError: any) {
      // 시트가 이미 존재하거나 다른 오류 처리
      if (createError.message.includes("already exists")) {
      } else {
        console.error("시뮬레이션 요약 시트 생성 실패:", createError.message);
        throw createError;
      }
    }
  }
}

// 개별 시뮬레이션 시트가 존재하는지 확인하고 없으면 생성하는 함수
async function ensureSimulationSheetExists(
  sheets: any,
  spreadsheetId: string,
  sheetName: string
) {
  try {
    // 시트가 있는지 확인
    await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A1`,
    });
  } catch (error: any) {
    try {
      // 새 시트 생성
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: sheetName,
                },
              },
            },
          ],
        },
      });
    } catch (createError: any) {
      // 시트가 이미 존재하거나 다른 오류 처리
      if (createError.message.includes("already exists")) {
      } else {
        console.error(`시트 "${sheetName}" 생성 실패:`, createError.message);
        throw createError;
      }
    }
  }
}

// 시뮬레이션 결과를 Google Sheets에 저장하는 함수
export async function saveSimulationToGoogleSheets(simulationData: {
  conversation: any[];
  summary: any;
  timestamp: string;
  prompts: {
    chatbotSystemPrompt: string;
    userPersonaPrompt: string;
    stepPrompts: any;
  };
}) {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return null;
  }

  try {
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 메인 시트에 요약 정보 추가
    const summaryRow = [
      new Date(simulationData.timestamp).toLocaleString("ko-KR"),
      simulationData.summary.totalSteps,
      simulationData.summary.totalTurns,
      simulationData.summary.completedSteps,
      simulationData.summary.completedSteps ===
      simulationData.summary.totalSteps
        ? "완료"
        : "부분완료",
      `시뮬레이션-${simulationData.timestamp.split("T")[0]}`,
    ];

    // 요약 시트 확인 및 생성
    await ensureSummarySheetExists(sheets, spreadsheetId);

    // 요약 시트에 데이터 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: "시뮬레이션 요약!A:F",
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [summaryRow],
      },
    });

    // 대화 로그를 위한 새 시트 이름
    const sheetName = `시뮬레이션-${simulationData.timestamp.split("T")[0]}-${
      simulationData.timestamp.split("T")[1].split(":")[0]
    }${simulationData.timestamp.split("T")[1].split(":")[1]}`;

    // 개별 시뮬레이션 시트 생성
    await ensureSimulationSheetExists(sheets, spreadsheetId, sheetName);

    // 헤더 행 추가
    const headers = ["단계", "메시지", "추론", "단계완료여부", "시간"];
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A1:E1`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [headers],
      },
    });

    // 대화 데이터 변환
    const conversationRows = simulationData.conversation.map((entry) => {
      let message = "";
      let reasoning = "";
      let isStepComplete = "";

      if (typeof entry.message === "object" && entry.message.response_to_user) {
        // 챗봇 메시지인 경우 모든 필드 추출
        message = entry.message.response_to_user;
        reasoning = entry.message.reasoning || "";
        isStepComplete =
          entry.message.is_step_complete !== undefined
            ? entry.message.is_step_complete
              ? "예"
              : "아니오"
            : "";
      } else if (typeof entry.message === "string") {
        // 사용자 메시지인 경우
        message = entry.message;
        reasoning = ""; // 사용자 메시지는 추론 없음
        isStepComplete = ""; // 사용자 메시지는 단계완료여부 없음
      } else {
        // 기타 경우
        message = JSON.stringify(entry.message);
        reasoning = "";
        isStepComplete = "";
      }

      return [
        `${entry.step}-${entry.turn}`,
        entry.speaker === "chatbot" ? "🤖 챗봇" : "🧑‍💻 사용자",
        message,
        reasoning,
        isStepComplete,
        new Date(entry.timestamp).toLocaleString("ko-KR"),
      ];
    });

    // 대화 데이터 추가 (RAW 옵션으로 수식 파싱 방지)
    if (conversationRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:E`,
        valueInputOption: "RAW",
        requestBody: {
          values: conversationRows,
        },
      });
    }

    // 프롬프트 정보를 별도 섹션에 추가 (등호를 피해서 수식 파싱 오류 방지)
    const promptData = [
      [""], // 빈 행
      ["━━━━━━━━━ 설정 정보 ━━━━━━━━━"],
      ["챗봇 시스템 프롬프트:", simulationData.prompts.chatbotSystemPrompt],
      ["사용자 페르소나 프롬프트:", simulationData.prompts.userPersonaPrompt],
      [""], // 빈 행
      ["━━━━━━━━━ 단계별 프롬프트 ━━━━━━━━━"],
    ];

    // 단계별 프롬프트 추가
    Object.entries(simulationData.prompts.stepPrompts).forEach(
      ([step, prompt]) => {
        promptData.push([`${step} 단계:`, prompt as string]);
      }
    );

    // 프롬프트 데이터 추가 (RAW 옵션으로 수식 파싱 방지)
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:E`,
      valueInputOption: "RAW",
      requestBody: {
        values: promptData,
      },
    });

    // 스프레드시트 URL 생성
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    return {
      success: true,
      spreadsheetId,
      sheetName,
      url: spreadsheetUrl,
    };
  } catch (error: any) {
    console.error("Google Sheets 저장 중 오류 발생:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

// Google Sheets 초기 설정을 위한 함수
export async function initializeGoogleSheets() {
  if (!process.env.GOOGLE_SHEET_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY) {
    return null;
  }

  try {
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 요약 시트가 있는지 확인하고 없으면 생성
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: "시뮬레이션 요약!A1",
      });
    } catch {
      // 요약 시트 생성
      await sheets.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: {
          requests: [
            {
              addSheet: {
                properties: {
                  title: "시뮬레이션 요약",
                },
              },
            },
          ],
        },
      });

      // 헤더 추가
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: "시뮬레이션 요약!A1:F1",
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: [
            ["생성일시", "총 단계", "총 턴", "완료 단계", "상태", "시트명"],
          ],
        },
      });
    }

    return { success: true };
  } catch (error: any) {
    console.error("Google Sheets 초기화 오류:", error);
    return { success: false, error: error.message };
  }
}
