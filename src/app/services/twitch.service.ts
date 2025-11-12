import { Injectable, NgZone } from '@angular/core';
import type { AnswerKey, AudienceTally } from '../models';
import * as tmi from 'tmi.js';

@Injectable({ providedIn: 'root' })
export class TwitchService {
  client?: any;
  channel = ''; // TODO: set this

  recentChatters: string[] = [];
  lastHundredMessages: { user: string; text: string; time: number }[] = [];

  tally: AudienceTally = { A:0, B:0, C:0, D:0 };
  collecting = false;

  constructor(private zone: NgZone) {}

  connectAnonymous() {
    if (this.client) return;
    this.client = new tmi.Client({
      connection: { reconnect: true, secure: true },
      channels: [this.channel],
    });
    this.client.connect();

    this.client.on('message', (_: any, tags: any, message: string, self: boolean) => {
      if (self) return;
      const user = tags['display-name'] || tags.username || 'user';

      this.zone.run(() => {
        this.recentChatters.unshift(user);
        this.recentChatters = [...new Set(this.recentChatters)].slice(0,100);

        this.lastHundredMessages.unshift({ user, text: message, time: Date.now() });
        this.lastHundredMessages = this.lastHundredMessages.slice(0,100);

        if (this.collecting) {
          const upper = message.trim().toUpperCase();
          const map: Record<string, AnswerKey> = { 'A':'A','B':'B','C':'C','D':'D' };
          if (map[upper]) this.tally[map[upper]]++;
        }
      });
    });
  }

  startAudienceCollection() { this.tally = {A:0,B:0,C:0,D:0}; this.collecting = true; }
  stopAudienceCollection() { this.collecting = false; }

  pickPhoneCandidates(): string[] {
    const pool = [...this.recentChatters];
    const chosen: string[] = [];
    while (chosen.length < 8 && pool.length) {
      const idx = Math.floor(Math.random()*pool.length);
      chosen.push(pool.splice(idx,1)[0]);
    }
    return chosen;
  }

  messagesBy(user: string): string[] {
    return this.lastHundredMessages.filter(m => m.user === user).map(m => m.text).slice(0,25);
  }
}
