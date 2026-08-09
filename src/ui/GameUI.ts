import { soundboard } from '../audio/Soundboard';
import { CHARACTERS, type CharacterId } from '../game/content/characters';
import type { CorporateEventDefinition } from '../game/content/corporateEvents';
import { PERKS } from '../game/content/perks';
import { gameBus, type HudSnapshot, type RunResult } from '../game/events';
import { ACHIEVEMENTS, profileStore, type PlayerProfile } from '../game/progression/ProfileStore';

const formatScore = (value: number) => Math.round(value).toLocaleString('en-US');

export class GameUI {
  private readonly root: HTMLElement;
  private readonly screenIds = ['menu-screen', 'character-screen', 'briefing-screen', 'result-screen'];
  private toastTimer = 0;
  private eventTimer = 0;
  private readonly touchDirections = new Set<string>();

  constructor(root: HTMLElement) {
    this.root = root;
    this.root.innerHTML = this.template();
    this.bindControls();
    this.bindGameEvents();
    this.showOnly('menu-screen');
    this.updateMuteButton(soundboard.isMuted);
    this.updateProfile(profileStore.load());
  }

  private template(): string {
    return `
      <main class="game-shell" aria-label="Corporate Chaos game">
        <div id="game-canvas" class="game-canvas" aria-label="Game playfield"></div>
        <div class="scanlines" aria-hidden="true"></div>

        <section id="menu-screen" class="screen menu-screen is-visible" aria-labelledby="game-title">
          <div class="menu-shade"></div>
          <div class="menu-topbar">
            <span class="eyebrow">CHAOS CORP // EMPLOYEE PORTAL</span>
            <button id="mute-button" class="icon-button" type="button" aria-label="Toggle sound">SOUND ON</button>
          </div>
          <div class="title-lockup">
            <p class="status-chip"><span></span> NOW HIRING SURVIVORS</p>
            <h1 id="game-title"><span>CORPORATE</span> CHAOS</h1>
            <p class="subtitle">SURVIVE THE SHIFT</p>
            <p class="lede">One workday. Zero boundaries. Make it to 5 PM.</p>
            <div class="menu-actions">
              <button id="start-button" class="button button-primary" type="button">CLOCK IN</button>
              <button id="how-button" class="button button-ghost" type="button">SHIFT BRIEF</button>
            </div>
            <p class="desktop-note">V2 DEVELOPMENT BUILD · DESKTOP + LANDSCAPE TOUCH</p>
            <div class="profile-strip" aria-label="Employee record">
              <span>RUNS <b id="profile-runs">0</b></span>
              <span>WINS <b id="profile-wins">0</b></span>
              <span>HIGH SCORE <b id="profile-high-score">0</b></span>
              <span>BADGES <b id="profile-badges">0</b></span>
            </div>
          </div>
          <aside id="how-panel" class="how-panel" aria-hidden="true">
            <button id="how-close" class="panel-close" type="button" aria-label="Close instructions">×</button>
            <p class="eyebrow">SURVIVAL HANDBOOK</p>
            <h2>Make busy look heroic.</h2>
            <ol>
              <li><strong>Move</strong><span>WASD or arrow keys</span></li>
              <li><strong>Dodge</strong><span>Emails, meetings and management</span></li>
              <li><strong>Dash</strong><span>Space bar when the indicator is ready</span></li>
              <li><strong>Upgrade</strong><span>Build a different survival strategy every run</span></li>
              <li><strong>Escalate</strong><span>React to random corporate events</span></li>
              <li><strong>Clock out</strong><span>Defeat the Regional Director at 5 PM</span></li>
            </ol>
            <p>Paperclips fire automatically at the nearest corporate problem. Your only real task is survival.</p>
          </aside>
        </section>

        <section id="character-screen" class="screen character-screen" aria-labelledby="character-title">
          <div class="panel character-panel">
            <p class="eyebrow">EMPLOYEE ONBOARDING // STEP 01</p>
            <h2 id="character-title">Choose your recruit</h2>
            <p class="panel-copy">Each recruit changes speed, survivability, attacks and signature ability. Choose a real playstyle.</p>
            <div class="character-grid">
              ${this.characterCard('red-recruit', 'character-red', 'avatar-red')}
              ${this.characterCard('blue-recruit', 'character-blue', 'avatar-blue')}
            </div>
          </div>
        </section>

        <section id="briefing-screen" class="screen briefing-screen" aria-labelledby="briefing-title">
          <div class="briefing-card">
            <div class="receptionist-portrait" aria-hidden="true"><span></span></div>
            <div>
              <p class="eyebrow">RECEPTION // 08:59 AM</p>
              <h2 id="briefing-title">Welcome to Chaos Corp.</h2>
              <p id="briefing-copy">HR misplaced your job description, so just keep moving. Survive until 5 PM and we may remember your name.</p>
              <div class="briefing-tags"><span>Avoid urgent requests</span><span>Collect Chaos Coins</span><span id="briefing-ability">Use your signature ability</span></div>
              <button id="briefing-button" class="button button-primary" type="button">ENTER THE OFFICE</button>
            </div>
          </div>
        </section>

        <section id="hud" class="hud" aria-live="polite">
          <div class="hud-cluster hud-left">
            <p class="hud-label">SHIFT CLOCK</p>
            <strong id="hud-clock">9:00 AM</strong>
            <span id="hud-wave">INBOX OVERFLOW</span>
          </div>
          <div class="hud-center">
            <div class="energy-row"><span>ENERGY</span><div class="meter energy-meter"><i id="energy-fill"></i></div><b id="energy-value">100</b></div>
            <div id="chaos-wrap" class="chaos-row"><span>CHAOS</span><div class="meter chaos-meter"><i id="chaos-fill"></i></div><b id="chaos-value">0%</b></div>
          </div>
          <div class="hud-cluster hud-right">
            <p class="hud-label">PERFORMANCE</p>
            <strong id="hud-score">0</strong>
            <span><i class="coin-dot"></i><b id="hud-coins">0</b> COINS</span>
          </div>
          <div id="multiplier-chip" class="multiplier-chip">CHAOS MODE · <b>2×</b></div>
          <div id="dash-chip" class="dash-chip is-ready">SPACE · DASH READY</div>
          <div id="ability-chip" class="ability-chip"><span>SIGNATURE</span><b>DEADLINE MOMENTUM</b></div>
          <div id="boss-hud" class="boss-hud" aria-label="Regional Director health">
            <div><span>THE REGIONAL DIRECTOR</span><b id="boss-phase">PHASE 1</b></div>
            <div class="boss-meter"><i id="boss-fill"></i></div>
          </div>
          <button id="pause-button" class="pause-button" type="button" aria-label="Pause game">II</button>
        </section>

        <aside id="event-banner" class="event-banner" aria-live="assertive">
          <span id="event-subtitle">CORPORATE EVENT</span>
          <strong id="event-title">REPLY-ALL STORM</strong>
          <p id="event-description"></p>
        </aside>

        <nav id="touch-controls" class="touch-controls" aria-label="Touch controls">
          <div class="touch-pad">
            <button data-move="up" type="button" aria-label="Move up">▲</button>
            <button data-move="left" type="button" aria-label="Move left">◀</button>
            <button data-move="right" type="button" aria-label="Move right">▶</button>
            <button data-move="down" type="button" aria-label="Move down">▼</button>
          </div>
          <button id="touch-dash" class="touch-dash" type="button">DASH</button>
        </nav>

        <section id="perk-modal" class="modal" aria-labelledby="perk-title">
          <div class="modal-card perk-card">
            <p class="eyebrow">UNSCHEDULED PERFORMANCE REVIEW</p>
            <h2 id="perk-title">Choose one questionable advantage</h2>
            <div id="perk-options" class="perk-options"></div>
          </div>
        </section>

        <section id="pause-modal" class="modal" aria-labelledby="pause-title">
          <div class="modal-card pause-card">
            <p class="eyebrow">CALENDAR BLOCKED</p>
            <h2 id="pause-title">Shift paused</h2>
            <p>Management will continue pretending this meeting is productive.</p>
            <button id="resume-button" class="button button-primary" type="button">RETURN TO WORK</button>
            <button id="pause-menu-button" class="button button-ghost" type="button">CLOCK OUT</button>
          </div>
        </section>

        <section id="result-screen" class="screen result-screen" aria-labelledby="result-title">
          <div class="result-card">
            <p id="result-kicker" class="eyebrow">SHIFT COMPLETE</p>
            <h2 id="result-title">You survived corporate culture.</h2>
            <div class="rank-stamp"><span>PERFORMANCE RANK</span><strong id="result-rank">OFFICE LEGEND</strong></div>
            <div class="result-grid">
              <div><span>FINAL SCORE</span><strong id="result-score">0</strong></div>
              <div><span>CHAOS CLEARED</span><strong id="result-cleared">0</strong></div>
              <div><span>COINS EARNED</span><strong id="result-coins">0</strong></div>
              <div><span>WALLET</span><strong id="result-wallet">0</strong></div>
              <div><span>HIGH SCORE</span><strong id="result-high-score">0</strong></div>
              <div><span>FINAL REVIEW</span><strong id="result-boss">PENDING</strong></div>
            </div>
            <div id="achievement-unlocks" class="achievement-unlocks" aria-live="polite"></div>
            <div class="result-actions">
              <button id="replay-button" class="button button-primary" type="button">WORK ANOTHER SHIFT</button>
              <button id="result-menu-button" class="button button-ghost" type="button">MAIN MENU</button>
            </div>
          </div>
        </section>

        <div id="toast" class="toast" role="status"></div>
      </main>
    `;
  }

  private characterCard(id: CharacterId, cardClass: string, avatarClass: string): string {
    const character = CHARACTERS[id];
    return `<button class="character-card ${cardClass}" data-character="${id}" type="button" style="--character:${character.accent}">
      <span class="avatar ${avatarClass}" aria-hidden="true"><i class="avatar-hair"></i><i class="avatar-face"></i><i class="avatar-body"></i><i class="avatar-tie"></i></span>
      <span class="character-number">${character.employeeNumber}</span>
      <strong>${character.name}</strong>
      <small>${character.role} · ${character.personality}</small>
      <span class="character-description">${character.description}</span>
      <span class="ability-card"><b>${character.ability.name}</b>${character.ability.description}</span>
      <span class="character-stats"><i>ENERGY ${character.stats.maxEnergy}</i><i>MOVE ${Math.round(character.stats.moveSpeed * 100)}</i><i>FIRE ${Math.round(character.stats.fireRate * 100)}</i></span>
      <span class="select-label">SELECT RECRUIT</span>
    </button>`;
  }

  private bindControls(): void {
    this.byId('start-button').addEventListener('click', () => {
      soundboard.unlock();
      gameBus.emit('ui:start', undefined);
      this.showOnly('character-screen');
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-character]').forEach((button) => {
      button.addEventListener('click', () => {
        const character = button.dataset.character as 'red-recruit' | 'blue-recruit';
        gameBus.emit('ui:character', character);
        this.updateBriefing(character);
        this.showOnly('briefing-screen');
      });
    });

    this.byId('briefing-button').addEventListener('click', () => {
      this.hideScreens();
      this.byId('hud').classList.add('is-visible');
      gameBus.emit('ui:briefing-complete', undefined);
    });

    this.byId('how-button').addEventListener('click', () => this.toggleHow(true));
    this.byId('how-close').addEventListener('click', () => this.toggleHow(false));
    this.byId('pause-button').addEventListener('click', () => gameBus.emit('ui:pause-toggle', undefined));
    this.byId('resume-button').addEventListener('click', () => gameBus.emit('ui:resume', undefined));
    this.byId('pause-menu-button').addEventListener('click', () => gameBus.emit('ui:menu', undefined));
    this.byId('replay-button').addEventListener('click', () => gameBus.emit('ui:restart', undefined));
    this.byId('result-menu-button').addEventListener('click', () => gameBus.emit('ui:menu', undefined));
    this.byId('mute-button').addEventListener('click', () => {
      soundboard.setMuted(!soundboard.isMuted);
      this.updateMuteButton(soundboard.isMuted);
      gameBus.emit('ui:mute', soundboard.isMuted);
    });

    this.root.querySelectorAll<HTMLButtonElement>('[data-move]').forEach((button) => {
      const direction = button.dataset.move!;
      const press = (event: PointerEvent) => {
        event.preventDefault();
        this.touchDirections.add(direction);
        this.emitTouchVector();
      };
      const release = (event: PointerEvent) => {
        event.preventDefault();
        this.touchDirections.delete(direction);
        this.emitTouchVector();
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('pointerleave', release);
    });
    this.byId('touch-dash').addEventListener('pointerdown', (event) => {
      event.preventDefault();
      gameBus.emit('ui:dash', undefined);
    });
  }

  private bindGameEvents(): void {
    gameBus.on('game:character-select', () => this.showOnly('character-screen'));
    gameBus.on('game:briefing', () => this.showOnly('briefing-screen'));
    gameBus.on('game:hud', (snapshot) => this.updateHud(snapshot));
    gameBus.on('game:perk-offer', (ids) => this.showPerks(ids));
    gameBus.on('game:corporate-event', (event) => this.showCorporateEvent(event));
    gameBus.on('game:profile', (profile) => this.updateProfile(profile));
    gameBus.on('game:pause', (paused) => this.byId('pause-modal').classList.toggle('is-visible', paused));
    gameBus.on('game:result', (result) => this.showResult(result));
    gameBus.on('game:toast', (message) => this.toast(message));
    gameBus.on('game:ready', () => this.root.classList.add('is-ready'));
    gameBus.on('game:menu', () => this.showOnly('menu-screen'));
    gameBus.on('game:run-started', () => {
      this.hideScreens();
      this.byId('hud').classList.add('is-visible');
      this.byId('event-banner').classList.remove('is-visible');
      this.byId('boss-hud').classList.remove('is-visible');
    });
  }

  private updateHud(snapshot: HudSnapshot): void {
    this.byId('hud-clock').textContent = snapshot.clock;
    this.byId('hud-wave').textContent = snapshot.waveLabel.toUpperCase();
    this.byId('hud-score').textContent = formatScore(snapshot.score);
    this.byId('hud-coins').textContent = formatScore(snapshot.runCoins);
    this.byId('energy-value').textContent = String(Math.round(snapshot.energy));
    this.byId('energy-fill').style.width = `${Math.max(0, Math.min(100, (snapshot.energy / snapshot.maxEnergy) * 100))}%`;
    this.byId('chaos-fill').style.width = `${snapshot.chaos}%`;
    this.byId('chaos-value').textContent = snapshot.chaosActive ? `${snapshot.chaosSeconds.toFixed(1)}s` : `${Math.round(snapshot.chaos)}%`;
    this.byId('chaos-wrap').classList.toggle('is-active', snapshot.chaosActive);
    this.byId('multiplier-chip').classList.toggle('is-visible', snapshot.chaosActive);
    this.byId('multiplier-chip').querySelector('b')!.textContent = `${snapshot.multiplier.toFixed(snapshot.multiplier % 1 ? 1 : 0)}×`;
    this.byId('dash-chip').classList.toggle('is-ready', snapshot.dashReady);
    this.byId('dash-chip').textContent = snapshot.dashReady ? 'SPACE · DASH READY' : 'DASH · RECHARGING';
    this.byId('ability-chip').classList.toggle('is-ready', snapshot.abilityReady);
    this.byId('ability-chip').querySelector('b')!.textContent = snapshot.abilityName.toUpperCase();
    const bossHud = this.byId('boss-hud');
    bossHud.classList.toggle('is-visible', snapshot.bossActive);
    this.byId('boss-fill').style.width = `${snapshot.bossMaxHealth > 0 ? (snapshot.bossHealth / snapshot.bossMaxHealth) * 100 : 0}%`;
    this.byId('boss-phase').textContent = `PHASE ${snapshot.bossPhase || 1}`;
  }

  private showPerks(ids: string[]): void {
    const options = this.byId('perk-options');
    options.innerHTML = ids
      .map((id, index) => {
        const perk = PERKS[id];
        return `<button class="perk-option" data-perk="${perk.id}" style="--perk:${perk.accent}" type="button">
          <span class="perk-index">0${index + 1}</span>
          <span class="perk-icon">${perk.name.slice(0, 2).toUpperCase()}</span>
          <span class="perk-kicker">${perk.kicker}</span>
          <strong>${perk.name}</strong>
          <small>${perk.description}</small>
        </button>`;
      })
      .join('');
    options.querySelectorAll<HTMLButtonElement>('[data-perk]').forEach((button) => {
      button.addEventListener('click', () => {
        this.byId('perk-modal').classList.remove('is-visible');
        gameBus.emit('ui:perk-selected', button.dataset.perk!);
      });
    });
    this.byId('perk-modal').classList.add('is-visible');
  }

  private showCorporateEvent(event: CorporateEventDefinition): void {
    window.clearTimeout(this.eventTimer);
    const banner = this.byId('event-banner');
    banner.style.setProperty('--event-accent', event.accent);
    this.byId('event-subtitle').textContent = event.subtitle.toUpperCase();
    this.byId('event-title').textContent = event.title;
    this.byId('event-description').textContent = event.description;
    banner.classList.add('is-visible');
    this.eventTimer = window.setTimeout(() => banner.classList.remove('is-visible'), Math.min(6200, event.duration * 1000));
  }

  private updateProfile(profile: PlayerProfile): void {
    this.byId('profile-runs').textContent = formatScore(profile.runs);
    this.byId('profile-wins').textContent = formatScore(profile.wins);
    this.byId('profile-high-score').textContent = formatScore(profile.highScore);
    this.byId('profile-badges').textContent = formatScore(profile.achievements.length);
  }

  private updateBriefing(id: CharacterId): void {
    const character = CHARACTERS[id];
    this.byId('briefing-copy').textContent = `${character.personality} has been approved as a survival strategy. ${character.ability.description}`;
    this.byId('briefing-ability').textContent = character.ability.name;
  }

  private showResult(result: RunResult): void {
    this.byId('hud').classList.remove('is-visible');
    this.byId('pause-modal').classList.remove('is-visible');
    this.byId('perk-modal').classList.remove('is-visible');
    this.byId('result-kicker').textContent = result.won ? 'SHIFT COMPLETE // 5:00 PM' : 'PERFORMANCE INTERRUPTED';
    this.byId('result-title').textContent = result.won ? 'You survived corporate culture.' : 'The inbox won this round.';
    this.byId('result-rank').textContent = result.rank;
    this.byId('result-score').textContent = formatScore(result.score);
    this.byId('result-cleared').textContent = formatScore(result.hazardsCleared);
    this.byId('result-coins').textContent = `+${formatScore(result.runCoins)}`;
    this.byId('result-wallet').textContent = formatScore(result.walletCoins);
    this.byId('result-high-score').textContent = formatScore(result.highScore);
    this.byId('result-boss').textContent = result.bossDefeated ? 'DIRECTOR DEFEATED' : 'PENDING';
    const unlocks = this.byId('achievement-unlocks');
    unlocks.innerHTML = result.newAchievements.length
      ? `<p>NEW EMPLOYEE BADGES</p>${result.newAchievements.map((id) => `<span><b>${ACHIEVEMENTS[id].name}</b>${ACHIEVEMENTS[id].description}</span>`).join('')}`
      : '';
    this.showOnly('result-screen');
  }

  private showOnly(id: string): void {
    this.screenIds.forEach((screenId) => this.byId(screenId).classList.toggle('is-visible', screenId === id));
    if (id === 'menu-screen') {
      this.byId('hud').classList.remove('is-visible');
      this.byId('pause-modal').classList.remove('is-visible');
      this.byId('perk-modal').classList.remove('is-visible');
      this.byId('event-banner').classList.remove('is-visible');
      this.byId('boss-hud').classList.remove('is-visible');
      this.touchDirections.clear();
      this.emitTouchVector();
    }
  }

  private hideScreens(): void {
    this.screenIds.forEach((id) => this.byId(id).classList.remove('is-visible'));
  }

  private toggleHow(open: boolean): void {
    const panel = this.byId('how-panel');
    panel.classList.toggle('is-visible', open);
    panel.setAttribute('aria-hidden', String(!open));
  }

  private toast(message: string): void {
    window.clearTimeout(this.toastTimer);
    const toast = this.byId('toast');
    toast.textContent = message;
    toast.classList.add('is-visible');
    this.toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 1900);
  }

  private emitTouchVector(): void {
    gameBus.emit('ui:move', {
      x: Number(this.touchDirections.has('right')) - Number(this.touchDirections.has('left')),
      y: Number(this.touchDirections.has('down')) - Number(this.touchDirections.has('up')),
    });
  }

  private updateMuteButton(muted: boolean): void {
    this.byId('mute-button').textContent = muted ? 'SOUND OFF' : 'SOUND ON';
  }

  private byId(id: string): HTMLElement {
    const element = this.root.querySelector<HTMLElement>(`#${id}`);
    if (!element) throw new Error(`Missing UI element: ${id}`);
    return element;
  }
}
