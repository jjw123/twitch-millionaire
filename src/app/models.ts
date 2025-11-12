export type AnswerKey = 'A'|'B'|'C'|'D';

export interface QuestionData {
  id: string;
  prompt: string;
  correctAnswer: string;
  wrongAnswers: [string, string, string];
}

export interface Question extends QuestionData {
  answers: Record<AnswerKey,string>;
  correct: AnswerKey;
}

export interface AudienceTally { A:number; B:number; C:number; D:number; }
