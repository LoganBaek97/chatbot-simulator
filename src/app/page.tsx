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

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));

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
              let displayMessage;
              if (
                typeof entry.message === "object" &&
                entry.message.response_to_user
              ) {
                displayMessage = entry.message.response_to_user;
              } else if (typeof entry.message === "string") {
                displayMessage = entry.message;
              } else {
                displayMessage = JSON.stringify(entry.message);
              }

              return (
                <div
                  key={index}
                  className={`mb-3 p-2 rounded ${
                    entry.speaker === "chatbot" ? "bg-blue-100" : "bg-green-100"
                  }`}
                >
                  <div className="font-semibold text-sm text-gray-600 mb-1">
                    {entry.step} 단계 - {entry.turn}턴
                    {entry.speaker === "chatbot" ? " 🤖" : " 👤"}
                  </div>
                  <div className="text-sm text-gray-800 whitespace-pre-wrap">
                    {displayMessage}
                  </div>
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
              if (
                typeof entry.message === "object" &&
                entry.message.response_to_user
              ) {
                displayMessage = entry.message.response_to_user;
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
                  <div className="whitespace-pre-wrap text-black">
                    {displayMessage}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
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
