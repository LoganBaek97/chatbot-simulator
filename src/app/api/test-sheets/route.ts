import { NextRequest, NextResponse } from "next/server";
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

export async function GET() {
  try {
    // 환경 변수 확인
    if (
      !process.env.GOOGLE_SHEET_ID ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    ) {
      return NextResponse.json(
        {
          success: false,
          error: "Google Sheets 환경 변수가 설정되지 않았습니다.",
          details: {
            hasSheetId: !!process.env.GOOGLE_SHEET_ID,
            hasServiceKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
          },
        },
        { status: 400 }
      );
    }

    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;
    const testSheetName = "테스트시트";
    const timestamp = new Date().toLocaleString("ko-KR");

    // 1. 스프레드시트 접근 테스트
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    // 2. 테스트 시트 생성 또는 확인
    let testSheetExists = false;
    try {
      await sheets.spreadsheets.values.get({
        spreadsheetId,
        range: `${testSheetName}!A1`,
      });
      testSheetExists = true;
    } catch (error) {
      // 시트가 없으면 생성
      try {
        await sheets.spreadsheets.batchUpdate({
          spreadsheetId,
          requestBody: {
            requests: [
              {
                addSheet: {
                  properties: {
                    title: testSheetName,
                  },
                },
              },
            ],
          },
        });

        // 헤더 추가
        await sheets.spreadsheets.values.update({
          spreadsheetId,
          range: `${testSheetName}!A1:C1`,
          valueInputOption: "USER_ENTERED",
          requestBody: {
            values: [["테스트 시간", "상태", "메시지"]],
          },
        });
      } catch (createError: any) {
        if (!createError.message.includes("already exists")) {
          throw createError;
        }
        testSheetExists = true;
      }
    }

    // 3. 테스트 데이터 작성
    const testData = [
      [timestamp, "성공", "Google Sheets API 연결 테스트 완료"],
    ];

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${testSheetName}!A:C`,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: testData,
      },
    });

    // 4. 작성된 데이터 읽기 테스트
    const readResult = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${testSheetName}!A:C`,
    });

    // 5. 스프레드시트 URL 생성
    const spreadsheetUrl = `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;

    return NextResponse.json({
      success: true,
      message: "Google Sheets 연결 테스트가 성공적으로 완료되었습니다.",
      details: {
        spreadsheetTitle: spreadsheetInfo.data.properties?.title,
        spreadsheetId,
        testSheetCreated: !testSheetExists,
        testSheetName,
        dataWritten: true,
        dataRead: readResult.data.values?.length || 0,
        timestamp,
        url: spreadsheetUrl,
      },
      testData: {
        written: testData,
        lastRows: readResult.data.values?.slice(-3) || [], // 마지막 3개 행만 표시
      },
    });
  } catch (error: any) {
    console.error("Google Sheets 테스트 오류:", error);

    return NextResponse.json(
      {
        success: false,
        error: "Google Sheets 테스트 중 오류가 발생했습니다.",
        details: {
          message: error.message,
          name: error.name,
          timestamp: new Date().toLocaleString("ko-KR"),
        },
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    // 환경 변수 확인만 하고 간단한 상태 반환
    if (
      !process.env.GOOGLE_SHEET_ID ||
      !process.env.GOOGLE_SERVICE_ACCOUNT_KEY
    ) {
      return NextResponse.json({
        success: false,
        error: "Google Sheets 환경 변수가 설정되지 않았습니다.",
        config: {
          hasSheetId: !!process.env.GOOGLE_SHEET_ID,
          hasServiceKey: !!process.env.GOOGLE_SERVICE_ACCOUNT_KEY,
        },
      });
    }

    // 간단한 인증 테스트
    const sheets = getGoogleSheetsClient();
    const spreadsheetId = process.env.GOOGLE_SHEET_ID;

    // 스프레드시트 정보만 가져오기 (읽기 전용 테스트)
    const spreadsheetInfo = await sheets.spreadsheets.get({
      spreadsheetId,
    });

    return NextResponse.json({
      success: true,
      message: "Google Sheets 설정이 올바르게 구성되어 있습니다.",
      config: {
        spreadsheetTitle: spreadsheetInfo.data.properties?.title,
        spreadsheetId,
        hasSheetId: true,
        hasServiceKey: true,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({
      success: false,
      error: "Google Sheets 설정 테스트 실패",
      details: error.message,
    });
  }
}
