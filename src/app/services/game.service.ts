import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, firstValueFrom } from 'rxjs';
import type { Question, AnswerKey, QuestionData } from '../models';

@Injectable({ providedIn: 'root' })
export class GameService {
  questions$ = new BehaviorSubject<Question[]>([]);
  index$ = new BehaviorSubject<number>(0);
  locked$ = new BehaviorSubject<boolean>(false);
  fiftyUsed$ = new BehaviorSubject<boolean>(false);
  audienceUsed$ = new BehaviorSubject<boolean>(false);
  phoneUsed$ = new BehaviorSubject<boolean>(false);
  status$ = new BehaviorSubject<'playing' | 'won' | 'lost'>('playing');

  hiddenAnswers$ = new BehaviorSubject<AnswerKey[]>([]);
  activeFriend$ = new BehaviorSubject<string | null>(null);
  friendMessages$ = new BehaviorSubject<string[]>([]);

  private rawQuestions: QuestionData[] = [];
  private readonly answerKeys: AnswerKey[] = ['A','B','C','D'];

  constructor(private http: HttpClient) {}

  async loadQuestions(path = 'assets/questions.json') {
    const data = await firstValueFrom(this.http.get<QuestionData[]>(path));
    this.rawQuestions = data;
    this.questions$.next(this.buildQuestions());
    this.index$.next(0);
    this.resetPerQuestionState();
    this.status$.next('playing');
    this.fiftyUsed$.next(false);
    this.audienceUsed$.next(false);
    this.phoneUsed$.next(false);
  }

  get current(): Question | null {
    const qs = this.questions$.value; const i = this.index$.value;
    return (qs && i >= 0 && i < qs.length) ? qs[i] : null;
  }

  answer(key: AnswerKey): { correct: boolean; status: 'playing' | 'won' | 'lost' } | null {
    const q = this.current;
    if (!q || this.locked$.value || this.status$.value !== 'playing') return null;
    this.locked$.next(true);
    const correct = key === q.correct;

    if (!correct) {
      this.status$.next('lost');
      return { correct, status: 'lost' };
    }

    const isFinalQuestion = this.index$.value === this.questions$.value.length - 1;
    if (isFinalQuestion) {
      this.status$.next('won');
      return { correct, status: 'won' };
    }

    return { correct, status: 'playing' };
  }

  next() {
    if (this.status$.value !== 'playing') return;
    const i = this.index$.value + 1; const qs = this.questions$.value;
    if (i < qs.length) {
      this.index$.next(i);
      this.resetPerQuestionState();
    }
  }

  resetPerQuestionState(){
    this.locked$.next(false);
    this.hiddenAnswers$.next([]);
    this.activeFriend$.next(null);
    this.friendMessages$.next([]);
  }

  use5050(){
    if (this.fiftyUsed$.value) return;
    const q = this.current!;
    const wrong = this.answerKeys.filter(k => k !== q.correct);
    for (let i = wrong.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [wrong[i], wrong[j]] = [wrong[j], wrong[i]];
    }
    this.hiddenAnswers$.next(wrong.slice(0,2));
    this.fiftyUsed$.next(true);
  }

  restart() {
    if (!this.rawQuestions.length) return;
    this.questions$.next(this.buildQuestions());
    this.index$.next(0);
    this.resetPerQuestionState();
    this.status$.next('playing');
    this.fiftyUsed$.next(false);
    this.audienceUsed$.next(false);
    this.phoneUsed$.next(false);
  }

  continueAfterLoss() {
    if (this.status$.value !== 'lost') return;
    this.resetPerQuestionState();
    this.status$.next('playing');
    this.fiftyUsed$.next(false);
    this.audienceUsed$.next(false);
    this.phoneUsed$.next(false);
  }

  private buildQuestions(): Question[] {
    return this.rawQuestions.map(q => this.withRandomizedAnswers(q));
  }

  private withRandomizedAnswers(data: QuestionData): Question {
    const pool = [
      { text: data.correctAnswer, correct: true },
      ...data.wrongAnswers.map(text => ({ text, correct: false }))
    ];
    this.shuffle(pool);
    const answers: Record<AnswerKey,string> = { A:'', B:'', C:'', D:'' };
    let correct: AnswerKey = 'A';
    this.answerKeys.forEach((key, idx) => {
      const option = pool[idx];
      answers[key] = option.text;
      if (option.correct) correct = key;
    });
    return { ...data, answers, correct };
  }

  private shuffle<T>(arr: T[]): void {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  }
}
