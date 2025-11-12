import { Component, EventEmitter, Input, OnDestroy, OnInit, Output, signal, computed } from '@angular/core';
import type { AudienceTally, AnswerKey } from '../models';
import { TwitchService } from '../services/twitch.service';

@Component({
  selector: 'app-lifeline-audience',
  standalone: true,
  templateUrl: './lifeline-audience.component.html',
  styleUrls: ['./lifeline-audience.component.css']
})
export class LifelineAudienceComponent implements OnInit, OnDestroy {
  @Input() durationMs = 60000;
  @Output() closed = new EventEmitter<void>();
  tally = signal<AudienceTally>({A:0,B:0,C:0,D:0});
  countdown = signal<number>(this.durationMs);
  private timer?: any;

  total = computed(() => this.tally().A + this.tally().B + this.tally().C + this.tally().D);
  options: AnswerKey[] = ['A','B','C','D'];

  constructor(public twitch: TwitchService) {}

  ngOnInit(){
    this.twitch.startAudienceCollection();
    this.timer = setInterval(() => {
      this.tally.set({ ...this.twitch.tally });
      const next = this.countdown() - 1000;
      this.countdown.set(next);
      if (next <= 0) this.ngOnDestroy();
    }, 1000);
  }

  ngOnDestroy(){
    if (this.timer) clearInterval(this.timer);
    this.twitch.stopAudienceCollection();
  }

  close(){
    this.closed.emit();
  }

  percent(key: AnswerKey){
    const tot = this.total();
    if (!tot) return 0;
    return Math.round((this.tally()[key] / tot) * 100);
  }
}
