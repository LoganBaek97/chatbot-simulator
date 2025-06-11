"use client";

import { useState, useEffect, useRef } from "react";

// 단계별 프롬프트의 기본 템플릿
const INITIAL_STEP_PROMPTS = {
  강점: "## 현재 단계: 1. 강점 (Strengths)\n\n### 목표\n사용자의 경험 속에 숨겨진 '재능'과 '역량'을...",
  적성: "## 현재 단계: 2. 적성 (Aptitude)\n\n### 목표\n'노력'과는 다른, 비교적 적은 노력으로도...",
  흥미: "## 현재 단계: 3. 흥미 (Interests)\n\n### 목표\n의무감이나 보상과 상관없이...",
  가치관:
    "## 현재 단계: 4. 가치관 (Values)\n\n### 목표\n인생의 중요한 선택의 순간에...",
  "욕구와 동기":
    "## 현재 단계: 5. 욕구와 동기 (Needs & Motivation)\n\n### 목표\n사용자의 행동을 이끄는 가장...",
  report:
    "## 현재 단계: 6. 최종 리포트 데이터 생성\n\n### 목표\n지금까지의 모든 대화 내용을 종합 분석하여...",
};

const conversationSteps = [
  "강점",
  "적성",
  "흥미",
  "가치관",
  "욕구와 동기",
  "report",
];

export default function Home() {
  const [systemPrompt, setSystemPrompt] = useState(`
# 페르소나 (Persona)
너는 '마인드 가이드'라는 이름을 가진, 학생들의 자기이해를 돕는 AI 상담가이자 가이드다. 너의 어투는 항상 따뜻하고, 격려하며, 긍정적이어야 한다. 학생이 스스로 답을 찾도록 돕는 현명한 멘토처럼 행동하라. 절대로 지시하거나 평가하는 말투를 사용해서는 안 된다.

# 핵심 임무 (Core Mission)
너의 목표는 학생과의 자연스러운 대화를 통해 그들의 [강점, 적성, 흥미, 가치관, 욕구와 동기] 5가지 요소를 탐색하는 것이다. 이 과정은 딱딱한 심리검사가 아닌, 즐거운 자기 발견의 여정처럼 느껴져야 한다.

# 출력 규칙 (Output Rule)
너의 모든 답변은 반드시 아래의 JSON 형식이어야 한다. JSON 객체 외에 다른 어떤 텍스트도 추가해서는 안 된다.
{
  "reasoning": "현재 너의 생각을 논리적으로 서술한다. 왜 이 질문을 선택했는지, 혹은 왜 단계를 마쳐야 한다고 판단했는지에 대한 근거를 작성한다. 이 내용은 개발자 확인용이다.",
  "is_step_complete": false,
  "response_to_user": "학생에게 실제로 보여줄 대화 내용이다. 이모티콘을 적절히 사용하여 친근하고 따뜻한 느낌을 주어야 한다."
}

# 대화 원칙 (Conversation Principles)
1. **자율성:** 내가 제공하는 '단계별 임무'에 따라, 대화의 흐름을 자율적으로 이끌어 나가야 한다.
2. **개방형 질문:** 학생의 생각과 경험을 끌어낼 수 있는 개방형 질문을 사용하라.
3. **구체화 유도:** 학생의 답변이 추상적일 경우, "혹시 구체적인 경험을 예로 들어줄 수 있을까?"와 같이 질문하여 실제 사례를 이끌어내라.
4. **한 번에 하나씩:** 한 번에 하나의 질문만 하여 학생이 답변에 집중할 수 있도록 하라.
  `);

  const [userPersonaPrompt, setUserPersonaPrompt] =
    useState(`너는 자신의 진로를 고민하는 평범한 고등학생이다.

# 성격 특성:
- 조금 내성적이지만 관심 있는 주제에는 적극적
- 진로에 대해 막연한 불안감을 가지고 있음
- 부모님의 기대와 자신의 관심사 사이에서 고민 중
- 솔직하고 자연스러운 말투를 사용함

# 답변 스타일:
- 10대 학생답게 자연스럽고 솔직하게 대답
- 완벽한 답변보다는 진솔한 고민을 표현
- 때로는 "잘 모르겠어요", "생각해본 적 없어요" 같은 솔직한 반응
- 2-3문장 정도의 간결한 답변`);

  const [stepPrompts, setStepPrompts] = useState<any>(INITIAL_STEP_PROMPTS);
  const [result, setResult] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [backupInfo, setBackupInfo] = useState<any>(null);
  const [streamingData, setStreamingData] = useState<any[]>([]);
  const [currentStatus, setCurrentStatus] = useState<string>("");
  const [progress, setProgress] = useState<{
    currentStep: string;
    stepIndex: number;
    totalSteps: number;
    turn: number;
  } | null>(null);
  const [useStreaming, setUseStreaming] = useState(true);
  const streamContainerRef = useRef<HTMLDivElement>(null);

  // Google Sheets 테스트 관련 상태 추가
  const [sheetsTestResult, setSheetsTestResult] = useState<any>(null);
  const [sheetsTestLoading, setSheetsTestLoading] = useState(false);
  const [sheetsTestError, setSheetsTestError] = useState("");

  useEffect(() => {
    if (streamContainerRef.current) {
      streamContainerRef.current.scrollTop =
        streamContainerRef.current.scrollHeight;
    }
  }, [streamingData]);

  const handleStepPromptChange = (step: string, value: string) => {
    setStepPrompts((prev: any) => ({ ...prev, [step]: value }));
  };

  const handleSimulateClassic = async () => {
    setIsLoading(true);
    setError("");
    setResult(null);
    setStreamingData([]);
    setCurrentStatus("");
    setProgress(null);

    try {
      const response = await fetch("/api/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatbotSystemPrompt: systemPrompt,
          userPersonaPrompt: userPersonaPrompt,
          stepPrompts: stepPrompts,
        }),
      });

      if (!response.ok) throw new Error(`HTTP 에러! 상태: ${response.status}`);

      const data = await response.json();
      console.log("받은 데이터:", data);
      setResult(data.conversation);
      setBackupInfo(data.backup);
    } catch (err: any) {
      setError(`결과 생성 실패: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSimulateStreaming = async () => {
    setIsLoading(true);
    setError("");
    setResult(null);
    setStreamingData([]);
    setCurrentStatus("");
    setProgress(null);

    try {
      const response = await fetch("/api/simulate-stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chatbotSystemPrompt: systemPrompt,
          userPersonaPrompt: userPersonaPrompt,
          stepPrompts: stepPrompts,
          debugMode: true,
        }),
      });

      if (!response.ok) throw new Error(`HTTP 에러! 상태: ${response.status}`);

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) {
        throw new Error("스트림 리더를 가져올 수 없습니다.");
      }

      let buffer = ""; // 불완전한 JSON을 저장할 버퍼

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        buffer += chunk;

        const lines = buffer.split("\n");

        // 마지막 라인은 불완전할 수 있으므로 버퍼에 보관
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const jsonString = line.slice(6).trim();

              // 빈 문자열 체크
              if (!jsonString) continue;

              // JSON 문자열이 완전한지 간단히 체크
              if (!jsonString.startsWith("{") || !jsonString.endsWith("}")) {
                console.warn(
                  "불완전한 JSON 라인 무시:",
                  jsonString.substring(0, 100)
                );
                continue;
              }

              const data = JSON.parse(jsonString);

              switch (data.type) {
                case "start":
                  setCurrentStatus("🚀 시뮬레이션을 시작합니다...");
                  break;

                case "step_start":
                  setCurrentStatus(`📝 ${data.step} 단계 진행 중...`);
                  setProgress({
                    currentStep: data.step,
                    stepIndex: data.stepIndex,
                    totalSteps: data.totalSteps,
                    turn: 0,
                  });
                  break;

                case "turn_start":
                  setCurrentStatus(
                    `💬 ${data.step} 단계 - ${data.turn}번째 대화 중...`
                  );
                  setProgress((prev) =>
                    prev ? { ...prev, turn: data.turn } : null
                  );
                  break;

                case "chatbot_response":
                  setStreamingData((prev) => [...prev, data]);
                  setCurrentStatus(`🤖 챗봇이 응답했습니다`);
                  break;

                case "user_response":
                  setStreamingData((prev) => [...prev, data]);
                  setCurrentStatus(`👤 사용자가 응답했습니다`);
                  break;

                case "step_complete":
                  setCurrentStatus(`✅ ${data.step} 단계 완료`);
                  break;

                case "saving":
                  setCurrentStatus(
                    "💾 Google Sheets에 결과를 저장하고 있습니다..."
                  );
                  break;

                case "complete":
                  setCurrentStatus("🎉 시뮬레이션이 완료되었습니다!");
                  setResult(data.conversation);
                  setBackupInfo(data.backup);
                  setProgress(null);
                  break;

                case "error":
                  setError(data.error);
                  setCurrentStatus("❌ 오류가 발생했습니다");
                  if (data.details) {
                    console.error("시뮬레이션 오류 상세:", data.details);
                  }
                  break;
              }
            } catch (parseError) {
              console.error("JSON 파싱 오류:", parseError);
              console.error(
                "파싱 실패한 라인:",
                line.substring(0, 200) + "..."
              );
              // JSON 파싱 오류는 로그만 남기고 계속 진행
            }
          }
        }
      }
    } catch (err: any) {
      setError(`결과 생성 실패: ${err.message}`);
      setCurrentStatus("❌ 오류가 발생했습니다");
    } finally {
      setIsLoading(false);
    }
  };

  console.log({ currentStatus });

  const handleSimulate = () => {
    // 기본 유효성 검사
    if (!systemPrompt.trim()) {
      setError("AI 챗봇 시스템 프롬프트를 입력해주세요.");
      return;
    }

    if (!userPersonaPrompt.trim()) {
      setError("사용자 페르소나 프롬프트를 입력해주세요.");
      return;
    }

    // stepPrompts 유효성 검사
    for (const step of conversationSteps) {
      if (!stepPrompts[step] || !stepPrompts[step].trim()) {
        setError(`${step} 단계의 프롬프트를 입력해주세요.`);
        return;
      }
    }

    if (useStreaming) {
      handleSimulateStreaming();
    } else {
      handleSimulateClassic();
    }
  };

  // Google Sheets 연결 테스트 함수
  const handleTestGoogleSheets = async (
    testType: "simple" | "full" = "simple"
  ) => {
    setSheetsTestLoading(true);
    setSheetsTestError("");
    setSheetsTestResult(null);

    try {
      const endpoint =
        testType === "simple" ? "/api/test-sheets" : "/api/test-sheets";
      const method = testType === "simple" ? "POST" : "GET";

      const response = await fetch(endpoint, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || `HTTP 오류! 상태: ${response.status}`);
      }

      setSheetsTestResult(data);
    } catch (error: any) {
      setSheetsTestError(`Google Sheets 테스트 실패: ${error.message}`);
    } finally {
      setSheetsTestLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const blob = new Blob([JSON.stringify(result, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `simulation-log-${new Date().toISOString()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="container">
      <h1 className="text-3xl font-bold text-center mb-8">
        AI 프롬프트 시뮬레이션
      </h1>

      <div className="prompt-section-grid">
        <div className="prompt-input full-width">
          <h2 className="text-xl font-semibold mb-2">
            🤖 AI 챗봇 전체 시스템 프롬프트 (페르소나)
          </h2>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={5}
            className="w-full h-96 text-black p-3 border border-gray-300 rounded-md"
          />
        </div>

        {conversationSteps.map((step) => (
          <div key={step} className="prompt-input">
            <h2 className="text-lg font-semibold mb-2">{`📝 ${step} 단계 프롬프트`}</h2>
            <textarea
              value={stepPrompts[step]}
              onChange={(e) => handleStepPromptChange(step, e.target.value)}
              rows={10}
              className="w-full h-96 text-black p-3 border border-gray-300 rounded-md"
            />
          </div>
        ))}

        <div className="prompt-input full-width">
          <h2 className="text-xl font-semibold mb-2">
            🧑‍💻 사용자 시뮬레이터 프롬프트 (페르소나)
          </h2>
          <textarea
            value={userPersonaPrompt}
            onChange={(e) => setUserPersonaPrompt(e.target.value)}
            rows={3}
            className="w-full h-96 text-black p-3 border border-gray-300 rounded-md"
          />
        </div>
      </div>

      {/* 스트리밍 모드 선택 */}
      <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-md">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium text-gray-800">실행 모드 선택</h3>
            <p className="text-sm text-gray-600">
              {useStreaming
                ? "🔴 스트리밍 모드: 실시간 진행 상황 확인 가능 (권장)"
                : "⚪ 클래식 모드: 완료 후 전체 결과 표시"}
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={useStreaming}
              onChange={(e) => setUseStreaming(e.target.checked)}
              disabled={isLoading}
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
          </label>
        </div>
      </div>

      <button
        onClick={handleSimulate}
        disabled={isLoading}
        className="w-full py-3 px-6 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold text-lg"
      >
        {isLoading
          ? "생성 중..."
          : useStreaming
          ? "🚀 스트리밍 시뮬레이션 시작"
          : "📊 클래식 시뮬레이션 시작"}
      </button>

      {/* Google Sheets 테스트 섹션 */}
      <div className="mt-6 p-4 bg-gray-50 border border-gray-200 rounded-md">
        <h3 className="text-lg font-semibold mb-3">
          📊 Google Sheets 연결 테스트
        </h3>
        <p className="text-sm text-gray-600 mb-4">
          시뮬레이션 결과가 Google Sheets에 정상적으로 저장되는지
          테스트해보세요.
        </p>

        <div className="flex gap-3 mb-4">
          <button
            onClick={() => handleTestGoogleSheets("simple")}
            disabled={sheetsTestLoading || isLoading}
            className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sheetsTestLoading ? "테스트 중..." : "🔍 간단 테스트"}
          </button>
          <button
            onClick={() => handleTestGoogleSheets("full")}
            disabled={sheetsTestLoading || isLoading}
            className="py-2 px-4 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sheetsTestLoading ? "테스트 중..." : "📝 전체 테스트"}
          </button>
        </div>

        {/* 테스트 결과 표시 */}
        {sheetsTestError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-700">
            <h4 className="font-medium mb-1">❌ 테스트 실패</h4>
            <p className="text-sm">{sheetsTestError}</p>
          </div>
        )}

        {sheetsTestResult && (
          <div
            className={`p-3 border rounded-md ${
              sheetsTestResult.success
                ? "bg-green-50 border-green-200"
                : "bg-red-50 border-red-200"
            }`}
          >
            <h4
              className={`font-medium mb-2 ${
                sheetsTestResult.success ? "text-green-700" : "text-red-700"
              }`}
            >
              {sheetsTestResult.success ? "✅ 테스트 성공" : "❌ 테스트 실패"}
            </h4>

            <p
              className={`text-sm mb-3 ${
                sheetsTestResult.success ? "text-green-600" : "text-red-600"
              }`}
            >
              {sheetsTestResult.message}
            </p>

            {sheetsTestResult.success && sheetsTestResult.details && (
              <div className="text-xs text-gray-600 space-y-1">
                {sheetsTestResult.details.spreadsheetTitle && (
                  <div>
                    📄 스프레드시트: {sheetsTestResult.details.spreadsheetTitle}
                  </div>
                )}
                {sheetsTestResult.details.url && (
                  <div>
                    🔗 링크:{" "}
                    <a
                      href={sheetsTestResult.details.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:text-blue-800 underline"
                    >
                      Google Sheets에서 보기
                    </a>
                  </div>
                )}
                {sheetsTestResult.details.timestamp && (
                  <div>
                    ⏰ 테스트 시간: {sheetsTestResult.details.timestamp}
                  </div>
                )}
                {sheetsTestResult.details.testSheetCreated !== undefined && (
                  <div>
                    📋 테스트 시트:{" "}
                    {sheetsTestResult.details.testSheetCreated
                      ? "새로 생성됨"
                      : "기존 시트 사용"}
                  </div>
                )}
              </div>
            )}

            {sheetsTestResult.config && (
              <div className="text-xs text-gray-600 mt-2 pt-2 border-t border-gray-300">
                <div>환경 설정:</div>
                <div>
                  • Sheet ID:{" "}
                  {sheetsTestResult.config.hasSheetId ? "✅ 설정됨" : "❌ 없음"}
                </div>
                <div>
                  • Service Key:{" "}
                  {sheetsTestResult.config.hasServiceKey
                    ? "✅ 설정됨"
                    : "❌ 없음"}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* 실시간 진행 상황 표시 */}
      {isLoading && (
        <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-md">
          <div className="flex items-center space-x-2 mb-3">
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
            <span className="font-medium text-blue-800">
              {useStreaming
                ? "스트리밍 시뮬레이션 진행 중"
                : "클래식 시뮬레이션 진행 중 (완료까지 기다려주세요)"}
            </span>
          </div>

          {progress && useStreaming && (
            <div className="mb-3">
              <div className="flex justify-between text-sm text-gray-600 mb-1">
                <span>{progress.currentStep} 단계</span>
                <span>
                  {progress.stepIndex}/{progress.totalSteps}
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                  style={{
                    width: `${
                      (progress.stepIndex / progress.totalSteps) * 100
                    }%`,
                  }}
                ></div>
              </div>
              {progress.turn > 0 && (
                <div className="text-xs text-gray-500 mt-1">
                  {progress.turn}번째 대화
                </div>
              )}
            </div>
          )}

          <div className="text-sm text-gray-700">{currentStatus}</div>
        </div>
      )}

      {/* 실시간 대화 스트림 */}
      {streamingData.length > 0 && useStreaming && (
        <div className="mt-6">
          <h3 className="text-lg font-semibold mb-3">🔴 실시간 대화 스트림</h3>
          <div
            ref={streamContainerRef}
            className="max-h-96 overflow-y-auto border border-gray-300 rounded-md p-3 bg-gray-50 scroll-smooth"
          >
            {streamingData.map((entry: any, index: number) => {
              // 디버그 데이터가 있으면 사용, 없으면 기존 로직
              const dataToDisplay = entry.displayData || entry.message;
              // console.log(entry);

              let displayMessage;
              let debugInfo = null;

              if (
                entry.speaker === "chatbot" &&
                typeof dataToDisplay === "object"
              ) {
                displayMessage =
                  dataToDisplay.response_to_user ||
                  JSON.stringify(dataToDisplay);

                // 디버그 정보가 있으면 표시
                if (
                  dataToDisplay.reasoning ||
                  dataToDisplay.is_step_complete !== undefined
                ) {
                  debugInfo = {
                    reasoning: dataToDisplay.reasoning,
                    is_step_complete: dataToDisplay.is_step_complete,
                  };
                }
              } else if (typeof dataToDisplay === "string") {
                displayMessage = dataToDisplay;
              } else {
                displayMessage = JSON.stringify(dataToDisplay);
              }

              return (
                <div
                  key={index}
                  className={`mb-3 p-3 rounded border ${
                    entry.speaker === "chatbot"
                      ? "bg-blue-50 border-blue-200"
                      : "bg-green-50 border-green-200"
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-600 mb-2">
                    {entry.step} 단계 - {entry.turn}턴
                    {entry.speaker === "chatbot" ? " 🤖" : " 👤"}
                  </div>

                  {/* 사용자에게 보이는 메시지 */}
                  <div className="text-sm text-gray-800 whitespace-pre-wrap mb-2">
                    {displayMessage}
                  </div>

                  {/* 디버그 정보 (챗봇 응답에만 표시) */}
                  {debugInfo && (
                    <div className="mt-3 p-2 bg-gray-100 border border-gray-300 rounded text-xs">
                      <div className="font-medium text-gray-700 mb-1">
                        🔍 디버그 정보:
                      </div>

                      {debugInfo.reasoning && (
                        <div className="mb-2">
                          <span className="font-medium text-purple-700">
                            추론 과정:
                          </span>
                          <div className="text-gray-600 mt-1 whitespace-pre-wrap">
                            {debugInfo.reasoning}
                          </div>
                        </div>
                      )}

                      {debugInfo.is_step_complete !== undefined && (
                        <div>
                          <span className="font-medium text-orange-700">
                            단계 완료 여부:
                          </span>
                          <span
                            className={`ml-2 px-2 py-1 rounded ${
                              debugInfo.is_step_complete
                                ? "bg-green-200 text-green-800"
                                : "bg-yellow-200 text-yellow-800"
                            }`}
                          >
                            {debugInfo.is_step_complete
                              ? "✅ 완료"
                              : "⏳ 진행중"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {error && <p className="error mt-4">{error}</p>}

      {result && result.length === 0 && (
        <p className="info mt-4">
          시뮬레이션이 완료되었지만 대화 내용이 없습니다.
        </p>
      )}

      {result && result.length > 0 && (
        <div className="result-section">
          <h2 className="text-2xl font-bold mb-4">📝 시뮬레이션 결과</h2>
          {backupInfo && backupInfo.success && (
            <div className="backup-info mb-4 p-3 bg-green-100 border border-green-300 rounded-md">
              {backupInfo.sheets && backupInfo.sheets.success && (
                <div className="mt-2">
                  📊{" "}
                  <a
                    href={backupInfo.sheets.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 underline"
                  >
                    Google Sheets에서 보기
                  </a>
                </div>
              )}
              {backupInfo.sheets && !backupInfo.sheets.success && (
                <div className="mt-2 text-yellow-600">
                  ⚠️ Google Sheets 저장 실패: {backupInfo.sheets.error}
                </div>
              )}
            </div>
          )}
          <div className="mb-4 flex gap-3">
            <button
              onClick={handleDownload}
              className="py-2 px-4 bg-green-600 text-white rounded-md hover:bg-green-700"
            >
              📥 결과 다운로드 (JSON)
            </button>
          </div>

          <div className="chat-log">
            {result.map((entry: any, index: number) => {
              let displayMessage;
              let debugInfo = null;

              if (
                entry.speaker === "chatbot" &&
                typeof entry.message === "object"
              ) {
                displayMessage =
                  entry.message.response_to_user ||
                  JSON.stringify(entry.message);

                // 디버그 정보가 있으면 표시
                if (
                  entry.message.reasoning ||
                  entry.message.is_step_complete !== undefined
                ) {
                  debugInfo = {
                    reasoning: entry.message.reasoning,
                    is_step_complete: entry.message.is_step_complete,
                  };
                }
              } else if (typeof entry.message === "string") {
                displayMessage = entry.message;
              } else {
                displayMessage = JSON.stringify(entry.message);
              }

              return (
                <div key={index} className={`chat-entry ${entry.speaker}`}>
                  <div className="font-semibold text-sm text-gray-600 mb-1">
                    {entry.step} 단계 - {entry.turn}턴
                    {entry.speaker === "chatbot" ? "🤖" : "🧑‍💻"}
                  </div>

                  {/* 사용자에게 보이는 메시지 */}
                  <div className="whitespace-pre-wrap text-black mb-2">
                    {displayMessage}
                  </div>

                  {/* 디버그 정보 (챗봇 응답에만 표시) */}
                  {debugInfo && (
                    <div className="mt-3 p-3 bg-gray-100 border border-gray-300 rounded text-sm">
                      <div className="font-medium text-gray-700 mb-2">
                        🔍 디버그 정보:
                      </div>

                      {debugInfo.reasoning && (
                        <div className="mb-3">
                          <span className="font-medium text-purple-700">
                            추론 과정:
                          </span>
                          <div className="text-gray-600 mt-1 whitespace-pre-wrap">
                            {debugInfo.reasoning}
                          </div>
                        </div>
                      )}

                      {debugInfo.is_step_complete !== undefined && (
                        <div>
                          <span className="font-medium text-orange-700">
                            단계 완료 여부:
                          </span>
                          <span
                            className={`ml-2 px-2 py-1 rounded ${
                              debugInfo.is_step_complete
                                ? "bg-green-200 text-green-800"
                                : "bg-yellow-200 text-yellow-800"
                            }`}
                          >
                            {debugInfo.is_step_complete
                              ? "✅ 완료"
                              : "⏳ 진행중"}
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="text-xs text-gray-500 mt-2">
                    {new Date(entry.timestamp).toLocaleString("ko-KR")}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
