import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClientModule } from '@angular/common/http';
import { GameService } from './services/game.service';
import { TwitchService } from './services/twitch.service';
import type { AnswerKey, Question } from './models';
import { LifelineAudienceComponent } from './components/lifeline-audience.component';
import { PhoneFriendComponent } from './components/phone-friend.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, HttpClientModule, LifelineAudienceComponent, PhoneFriendComponent],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {

  showAudience = signal(false);
  showPhone = signal(false);
  lastResult = signal<'correct'|'incorrect'|null>(null);
  status = signal<'playing'|'won'|'lost'>('playing');
  showChat = signal(true);
  gameStarted = signal(false);
  startLoading = signal(false);
  finalConfirmOpen = signal(false);
  pendingAnswer = signal<AnswerKey | null>(null);

  moneyLadder = [
    '£1,000,000', '£500,000', '£250,000', '£125,000', '£64,000',
    '£32,000', '£16,000', '£8,000', '£4,000', '£2,000', '£1,000', '£500', '£300', '£200', '£100'
  ];

  currentQuestion = signal<Question | null>(null);

  hidden = this.gs.hiddenAnswers$;
  keys: AnswerKey[] = ['A','B','C','D'];
  private audioCache = new Map<string, HTMLAudioElement>();
  private readonly soundFiles = {
    intro: 'assets/intro.mp3',
    final: 'assets/final.mp3',
    correct: 'assets/correct.mp3',
    wrong: 'assets/wrong.mp3'
  } as const;
  private currentQuestionClip: HTMLAudioElement | null = null;
  private pendingQuestionIndex: number | null = null;
  private activeFxCount = 0;

  constructor(private gs: GameService, private twitch: TwitchService){
    this.twitch.connectAnonymous();

    this.gs.questions$.subscribe(() => this.currentQuestion.set(this.gs.current));
    this.gs.index$.subscribe(() => {
      this.currentQuestion.set(this.gs.current);
      this.lastResult.set(null);
      if (this.gameStarted()) {
        this.playQuestionAudio(this.gs.index$.value);
      }
    });
    this.gs.status$.subscribe(status => {
      this.status.set(status);
      if (status !== 'playing') {
        this.showAudience.set(false);
        this.showPhone.set(false);
        this.pendingQuestionIndex = null;
        this.stopQuestionAudio();
      }
    });
  }

  async startGame() {
    if (this.startLoading()) return;
    this.startLoading.set(true);
    try {
      await this.gs.loadQuestions();
      this.gameStarted.set(true);
      this.lastResult.set(null);
      this.showAudience.set(false);
      this.showPhone.set(false);
      this.playSound('intro');
      this.playQuestionAudio(this.gs.index$.value);
    } catch (err) {
      console.error('Failed to start game', err);
    } finally {
      this.startLoading.set(false);
    }
  }

  prepareAnswer(key: AnswerKey){
    if (this.status() !== 'playing' || this.getLocked()) return;
    this.pendingAnswer.set(key);
    this.finalConfirmOpen.set(true);
    this.playSound('final');
  }

  confirmFinalAnswer(){
    const key = this.pendingAnswer();
    if (!key) return;
    this.finalConfirmOpen.set(false);
    this.processAnswer(key);
    this.pendingAnswer.set(null);
  }

  cancelFinalAnswer(){
    this.finalConfirmOpen.set(false);
    this.pendingAnswer.set(null);
  }

  private processAnswer(key: AnswerKey){
    const r = this.gs.answer(key); if (!r) return;
    this.lastResult.set(r.correct ? 'correct' : 'incorrect');
    this.playSound(r.correct ? 'correct' : 'wrong');
    if (r.status === 'playing' && r.correct) {
      setTimeout(() => { this.gs.next(); }, 1500);
    }
  }

  use5050(){ this.gs.use5050(); }
  askAudience(){ if (!this.gs.audienceUsed$.value){ this.showAudience.set(true); this.gs.audienceUsed$.next(true);} }
  closeAudience(){ this.showAudience.set(false); }

  phoneFriend(){ if (!this.gs.phoneUsed$.value){ this.showPhone.set(true); this.gs.phoneUsed$.next(true);} }
  closePhone(){ this.showPhone.set(false); }

  label(key: AnswerKey){ return key + ':'; }
  
  getLastHundred() {
    return this.twitch.lastHundredMessages
  }
  
  getChannel() {
    return this.twitch.channel
  }

  is50Used() {
    return this.gs.fiftyUsed$.value;
  }

  isAudienceUsed() {
    return this.gs.audienceUsed$.value;
  }

  isPhoneUsed() {
    return this.gs.phoneUsed$.value;
  }

  getLocked() {
    return this.gs.locked$.value;
  }

  getCurrent() {
    return this.gs.index$.value;
  }

  restartGame() {
    this.gs.restart();
    this.lastResult.set(null);
    this.showAudience.set(false);
    this.showPhone.set(false);
    this.cancelFinalAnswer();
  }

  toggleChat() {
    this.showChat.update(v => !v);
  }

  continueAsLoser() {
    this.gs.continueAfterLoss();
    this.lastResult.set(null);
    this.cancelFinalAnswer();
    if (this.gameStarted()) {
      this.playQuestionAudio(this.getCurrent());
    }
  }

  private playQuestionAudio(index: number) {
    if (!this.gameStarted() || !this.currentQuestion()) return;
    this.pendingQuestionIndex = index;
    this.tryStartQuestionAudio();
  }

  private tryStartQuestionAudio() {
    if (this.activeFxCount > 0 || this.pendingQuestionIndex === null) return;
    const index = this.pendingQuestionIndex;
    this.pendingQuestionIndex = null;
    this.startQuestionClip(index);
  }

  private startQuestionClip(index: number) {
    const questionNumber = index + 1;
    const formatted = questionNumber.toString().padStart(2, '0');
    const src = `assets/question-${formatted}.mp3`;
    this.stopQuestionAudio();
    const clip = this.spawnAudio(src);
    this.currentQuestionClip = clip;
    clip?.play().catch(() => {});
  }

  private stopQuestionAudio() {
    if (this.currentQuestionClip) {
      this.currentQuestionClip.pause();
      this.currentQuestionClip.currentTime = 0;
      this.currentQuestionClip = null;
    }
  }

  private playSound(key: keyof typeof this.soundFiles) {
    const clip = this.spawnAudio(this.soundFiles[key]);
    if (!clip) {
      this.tryStartQuestionAudio();
      return;
    }
    this.activeFxCount++;
    let settled = false;
    const finalize = () => {
      if (settled) return;
      settled = true;
      this.onFxComplete();
    };
    clip.addEventListener('ended', finalize, { once: true });
    clip.addEventListener('error', finalize, { once: true });
    clip.play().catch(() => finalize());
  }

  private spawnAudio(src: string): HTMLAudioElement | null {
    const template = this.getAudioTemplate(src);
    return template ? (template.cloneNode(true) as HTMLAudioElement) : null;
  }

  private getAudioTemplate(src: string): HTMLAudioElement | null {
    if (typeof Audio === 'undefined') {
      return null;
    }
    let template = this.audioCache.get(src);
    if (!template) {
      template = new Audio(src);
      template.preload = 'auto';
      this.audioCache.set(src, template);
    }
    return template;
  }

  private onFxComplete() {
    if (this.activeFxCount > 0) {
      this.activeFxCount--;
    }
    if (this.activeFxCount === 0) {
      this.tryStartQuestionAudio();
    }
  }
}
