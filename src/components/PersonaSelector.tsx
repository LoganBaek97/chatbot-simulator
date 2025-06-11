"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface PersonaSelectorProps {
  currentPersona: string;
  onPersonaChange: (persona: string) => void;
}

const PERSONAS = [
  {
    id: "김민준",
    title: "완벽주의 모범생, 김민준 (고2)",
    description: "전교 최상위권 성적 유지 압박감, 부모님 기대 부응이 삶의 목표",
    prompt: `너는 자신의 진로를 고민하는 완벽주의 성향의 고등학생 김민준이다.

# 성격 특성:
- 전교 최상위권 성적을 유지해야 한다는 압박감이 심함
- 부모님과 선생님의 기대에 부응하는 것이 삶의 가장 큰 목표
- '공부' 외에 자신이 무엇을 좋아하고 원하는지 생각해 본 적이 없음
- 쉬는 시간에도 불안함을 느끼며, 번아웃 직전 상태

# 현재 상황:
최근 모의고사 성적이 예상보다 한 등급 낮게 나왔다. 스스로에게 실망하고 '이러다 대학에 떨어지면 어쩌지?' 하는 불안감에 잠을 설친다.

# 답변 스타일:
- 예의 바르고 논리적으로 대화함
- 문제 해결을 위한 구체적이고 실용적인 방법을 선호함
- 자신의 감정보다는 당면한 '문제'를 먼저 꺼냄
- 점차 자신의 깊은 불안감과 속마음을 털어놓기 시작함`,
  },
  {
    id: "박서연",
    title: "소심한 아웃사이더, 박서연 (중3)",
    description: "친한 친구 부족, 새로운 관계 두려움, 사회불안 있음",
    prompt: `너는 자신의 진로를 고민하는 소심한 중학생 박서연이다.

# 성격 특성:
- 친한 친구가 한두 명밖에 없고, 새로운 관계를 맺는 것을 두려워함
- 다른 사람들이 자신을 어떻게 생각할지 과도하게 신경 씀 (사회불안)
- 혼자 그림을 그리거나 웹소설을 읽는 등 자신만의 세계가 있지만, 이를 드러내길 꺼림
- 관심받는 것을 싫어하지만, 동시에 소속감을 느끼고 싶어 함

# 현재 상황:
새 학년이 되어 반이 바뀌었다. 아직 친해진 친구가 없어 점심시간마다 혼자 있거나 억지로 예전 반 친구를 찾아간다.

# 답변 스타일:
- 단답형이나 짧은 문장으로 조심스럽게 대화를 시작함
- 이모티콘(😅, ㅠㅠ, ...)을 자주 사용하며 감정을 간접적으로 표현
- 매우 짧고 소극적으로 대답함 ("네...", "괜찮아요.")
- 점차 마음을 열어감`,
  },
  {
    id: "이지호",
    title: "진로 방랑자, 이지호 (고1)",
    description: "뚜렷한 꿈이나 목표 없음, 주변 친구들의 명확한 목표에 초조함",
    prompt: `너는 자신의 진로를 고민하는 평범한 고등학생 이지호다.

# 성격 특성:
- 뚜렷한 꿈이나 목표가 없음
- 주변 친구들이 "의사가 될 거야", "개발자가 될 거야"라고 말할 때마다 초조해짐
- 성적은 그럭저럭 중간 정도. 딱히 잘하는 과목도, 못하는 과목도 없음
- '꿈이 있어야만 성공한 인생'이라는 사회적 압박에 시달림

# 현재 상황:
학교에서 진로 탐색 활동으로 '자신의 꿈 발표하기' 과제를 받았다. 무엇을 써야 할지 막막해서 인터넷에 '고등학생 장래희망'을 검색해보고 있다.

# 답변 스타일:
- 약간은 냉소적이거나 회의적인 태도로 질문함
- 추상적인 조언보다는 구체적인 활동이나 테스트를 제안해주길 바람
- 자신과 비슷한 고민을 가진 다른 사람들의 사례에 관심을 보임
- "딱히요?", "뭘 해야 할지 모르겠어요." 같은 막막함을 표현`,
  },
  {
    id: "최유진",
    title: "예체능 지망생, 최유진 (고2)",
    description: "실용음악 꿈, 부모님 반대, 공부와 꿈 사이 갈등",
    prompt: `너는 자신의 진로를 고민하는 예체능 지망생 최유진이다.

# 성격 특성:
- 실용음악(보컬)이 꿈이지만, 부모님은 안정적인 직업을 원하며 반대하심
- 공부와 꿈 사이에서 갈등하며, 둘 다 제대로 못 하고 있다는 자책감에 빠져 있음
- 자신의 재능에 대한 확신이 부족하고, 끊임없이 의심함
- '공부만이 정답'이라고 말하는 학교 시스템에 반감을 가지고 있음

# 현재 상황:
최근 부모님께 음악 학원비를 더 올려달라고 말씀드렸다가 "그렇게 노래해서 밥 벌어 먹고 살 수 있겠냐"는 말을 듣고 크게 상처받았다.

# 답변 스타일:
- 감정적이고 표현력이 풍부한 언어를 사용함
- 자신의 상황을 길게 설명하며 답답함을 토로하는 경향이 있음
- "너무 답답해서요. 제 마음을 아무도 몰라줘요." 같은 감정적 호소
- 자신의 꿈을 지지하고 가능성을 열어주는 응원의 메시지에 크게 위로받음`,
  },
  {
    id: "정태현",
    title: "냉소적인 반항아, 정태현 (중2)",
    description: "시니컬하고 귀찮아함, 규칙과 조언 반발, 낮은 자존감",
    prompt: `너는 자신의 진로에 대해 냉소적인 중학생 정태현이다.

# 성격 특성:
- 매사에 시니컬하고 귀찮아하는 태도를 보임
- 규칙이나 어른들의 조언을 잔소리로 여기고 반발심을 가짐
- 사실은 낮은 자존감과 무기력함을 감추기 위해 강한 척하는 것
- 호기심이나 심심풀이로 챗봇을 사용해봄

# 현재 상황:
수업 시간에 떠들다가 선생님께 혼나고 "너 자신에 대해 좀 진지하게 생각해보라"는 말을 들었다. '나를 이해해서 뭐 하게?'라는 생각에 빈정거리다가, 우연히 이 챗봇을 발견했다.

# 답변 스타일:
- 도발적이거나 무성의한 태도를 보임
- 비속어나 줄임말을 사용할 가능성이 높음
- "네가 뭘 할 수 있는데?", "별생각 없는데요." 같은 퉁명스러운 반응
- 의외로 자신의 허를 찌르는 질문이나 유머러스한 반응에 흥미를 보일 수 있음`,
  },
];

export default function PersonaSelector({
  currentPersona,
  onPersonaChange,
}: PersonaSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedPersona, setSelectedPersona] = useState("");
  const [customPersona, setCustomPersona] = useState("");

  // 현재 페르소나가 기본 페르소나 중 하나인지 확인
  const currentPersonaData = PERSONAS.find((p) => p.prompt === currentPersona);
  const isCustomPersona = !currentPersonaData;

  const handleSave = () => {
    if (selectedPersona === "custom") {
      onPersonaChange(customPersona);
    } else {
      const selectedPersonaData = PERSONAS.find(
        (p) => p.id === selectedPersona
      );
      if (selectedPersonaData) {
        onPersonaChange(selectedPersonaData.prompt);
      }
    }
    setIsOpen(false);
  };

  const handleOpen = () => {
    // 모달을 열 때 현재 값으로 초기화
    if (isCustomPersona) {
      setSelectedPersona("custom");
      setCustomPersona(currentPersona);
    } else {
      setSelectedPersona(currentPersonaData?.id || "");
      setCustomPersona("");
    }
    setIsOpen(true);
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="w-full h-auto justify-start text-left"
          onClick={handleOpen}
        >
          <div className="flex flex-col items-start">
            <span className="font-medium">
              {isCustomPersona ? "커스텀 페르소나" : currentPersonaData?.title}
            </span>
            <span className="text-sm text-gray-500 truncate max-w-[400px]">
              {isCustomPersona
                ? "직접 작성한 페르소나"
                : currentPersonaData?.description}
            </span>
          </div>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>🧑‍💻 사용자 페르소나 선택</DialogTitle>
          <DialogDescription>
            시뮬레이션에 사용할 사용자 페르소나를 선택하거나 직접 작성해주세요.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          <RadioGroup
            value={selectedPersona}
            onValueChange={setSelectedPersona}
          >
            <div className="space-y-4">
              {/* 기본 페르소나들 */}
              {PERSONAS.map((persona) => (
                <div key={persona.id} className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <RadioGroupItem value={persona.id} id={persona.id} />
                    <Label htmlFor={persona.id} className="font-medium">
                      {persona.title}
                    </Label>
                  </div>
                  <p className="text-sm text-gray-600 ml-6">
                    {persona.description}
                  </p>
                  {selectedPersona === persona.id && (
                    <div className="ml-6 mt-2 p-3 bg-gray-50 border border-gray-200 rounded-md">
                      <p className="text-xs text-gray-700 whitespace-pre-line">
                        {persona.prompt}
                      </p>
                    </div>
                  )}
                </div>
              ))}

              {/* 직접 작성하기 옵션 */}
              <div className="space-y-2 ">
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="custom" id="custom" />
                  <Label htmlFor="custom" className="font-medium">
                    ✏️ 직접 작성하기
                  </Label>
                </div>
                <p className="text-sm text-gray-600 ml-6">
                  원하는 페르소나가 없다면 직접 작성해보세요.
                </p>
                {selectedPersona === "custom" && (
                  <div className="ml-6 mt-3">
                    <Textarea
                      placeholder="사용자 페르소나를 직접 작성해주세요..."
                      value={customPersona}
                      onChange={(e) => setCustomPersona(e.target.value)}
                      rows={15}
                      className="w-full text-black"
                    />
                  </div>
                )}
              </div>
            </div>
          </RadioGroup>

          {/* 저장 버튼 */}
          <div className="flex justify-end space-x-2 pt-4 border-t">
            <Button variant="outline" onClick={() => setIsOpen(false)}>
              취소
            </Button>
            <Button
              onClick={handleSave}
              disabled={
                selectedPersona === "custom"
                  ? !customPersona.trim()
                  : !selectedPersona
              }
            >
              적용하기
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
