import { google } from "googleapis";

// Google Sheets 클라이언트 초기화
function getGoogleSheetsClient() {
  const credentials = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!credentials) {
    throw new Error("Google Service Account 키가 설정되지 않았습니다.");
  }

  const auth = new google.auth.GoogleAuth({
    credentials: JSON.parse(credentials),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });

  return google.sheets({ version: "v4", auth });
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
    console.log("Google Sheets 설정이 없어 백업을 건너뜁니다.");
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

    // 새 시트 생성
    try {
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
    } catch (error: any) {
      // 시트가 이미 존재하면 무시
      if (!error.message.includes("already exists")) {
        throw error;
      }
    }

    // 헤더 행 추가
    const headers = ["단계", "턴", "화자", "메시지", "시간"];
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
      if (typeof entry.message === "object" && entry.message.response_to_user) {
        message = entry.message.response_to_user;
      } else if (typeof entry.message === "string") {
        message = entry.message;
      } else {
        message = JSON.stringify(entry.message);
      }

      return [
        entry.step,
        entry.turn,
        entry.speaker === "chatbot" ? "🤖 챗봇" : "🧑‍💻 사용자",
        message,
        new Date(entry.timestamp).toLocaleString("ko-KR"),
      ];
    });

    // 대화 데이터 추가
    if (conversationRows.length > 0) {
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:E`,
        valueInputOption: "USER_ENTERED",
        requestBody: {
          values: conversationRows,
        },
      });
    }

    // 프롬프트 정보를 별도 섹션에 추가
    const promptData = [
      [""], // 빈 행
      ["=== 설정 정보 ==="],
      ["챗봇 시스템 프롬프트:", simulationData.prompts.chatbotSystemPrompt],
      ["사용자 페르소나 프롬프트:", simulationData.prompts.userPersonaPrompt],
      [""], // 빈 행
      ["=== 단계별 프롬프트 ==="],
    ];

    // 단계별 프롬프트 추가
    Object.entries(simulationData.prompts.stepPrompts).forEach(
      ([step, prompt]) => {
        promptData.push([`${step} 단계:`, prompt as string]);
      }
    );

    // 프롬프트 데이터 추가
    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:E`,
      valueInputOption: "USER_ENTERED",
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
