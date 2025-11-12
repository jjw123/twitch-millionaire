import { Component, EventEmitter, OnDestroy, OnInit, Output, signal } from '@angular/core';
import { TwitchService } from '../services/twitch.service';

@Component({
  selector: 'app-phone-friend',
  standalone: true,
  templateUrl: './phone-friend.component.html',
  styleUrls: ['./phone-friend.component.css']
})
export class PhoneFriendComponent implements OnInit, OnDestroy {
  candidates = signal<string[]>([]);
  selected = signal<string | null>(null);
  feed = signal<string[]>([]);
  private poll?: ReturnType<typeof setInterval>;

  @Output() closed = new EventEmitter<void>();

  constructor(private twitch: TwitchService) {}

  ngOnInit(){
    this.candidates.set(this.twitch.pickPhoneCandidates());
  }

  choose(name: string){
    console.log(name);
    this.selected.set(name);
    this.refreshFeed();
    this.clearPoll();
    this.poll = setInterval(() => {
      this.refreshFeed();
    }, 2000);
  }

  refreshFeed(){
    console.log(this.selected())
    const name = this.selected();
    if (!name) return;
    this.feed.set(this.twitch.messagesBy(name));
    console.log(this.feed());
  }

  close(){
    this.clearPoll();
    this.closed.emit();
  }

  ngOnDestroy(): void {
    this.clearPoll();
  }

  private clearPoll(){
    if (this.poll){
      clearInterval(this.poll);
      this.poll = undefined;
    }
  }
}
