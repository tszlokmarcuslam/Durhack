// Nook world app: everything around the walkable island (world.js).
//  - the island screen: Leave, who is here, Invite, Wave, and the phone with the game modes
//  - invites and the notifications they send
//  - seeing people in other windows of this browser
// Demo transport: BroadcastChannel, which only reaches other windows of the same browser. Friends from the
// friends list are simulated. Swap post()/onNet() for a real server when accounts exist.
import { createWorld } from './world.js';
import { createGames, GAMES as MATCHES } from './worldgame.js';

const CSS = `
.nw,.nw-notes,.nw-inv-wrap{font-family:'Figtree',system-ui,sans-serif;color:#2B2A27}
.nw button,.nw-notes button,.nw-inv-wrap button{font-family:inherit;cursor:pointer;border:none;color:inherit}
.nw{position:fixed;inset:0;z-index:20;pointer-events:none;display:none}
.nw.on{display:block}
.nw-tags{position:absolute;inset:0;overflow:hidden}
.nw-tag{position:absolute;left:0;top:0;padding:3px 9px;border-radius:999px;background:rgba(251,248,241,.92);box-shadow:0 2px 8px rgba(43,42,39,.14);font:600 12px/1.3 'Figtree',sans-serif;white-space:nowrap;will-change:transform}
.nw-tag--friend{background:#5E683C;color:#F8F4EC}
.nw-top{position:absolute;top:20px;left:24px;right:24px;display:flex;justify-content:space-between;align-items:center;gap:12px}
.nw-row{display:flex;align-items:center;gap:8px;pointer-events:auto}
.nw-pill{height:44px;padding:0 16px;box-sizing:border-box;display:flex;align-items:center;gap:8px;background:#FBF8F1;border:1px solid rgba(43,42,39,.07);border-radius:999px;box-shadow:0 6px 18px rgba(43,42,39,.1);font:600 15px 'Figtree',sans-serif;white-space:nowrap;transition:transform .18s ease}
.nw button.nw-pill{border:1px solid rgba(43,42,39,.07)}
.nw button.nw-pill:hover{transform:translateY(-2px)}
.nw button.nw-pill:active{transform:scale(.97)}
.nw button.nw-go{background:#5E683C;color:#F8F4EC;border-color:transparent;box-shadow:0 8px 20px rgba(60,66,38,.25)}
.nw-faces{display:flex;padding-left:6px}
.nw-faces i{width:26px;height:26px;margin-left:-6px;border-radius:50%;border:2px solid #FBF8F1;background:#E4E6D2 center/cover}
.nw-hint{position:absolute;left:24px;bottom:24px;max-width:calc(100vw - 290px);padding:10px 14px;box-sizing:border-box;display:flex;flex-wrap:wrap;align-items:center;gap:6px 14px;background:rgba(251,248,241,.92);border:1px solid rgba(43,42,39,.07);border-radius:18px;box-shadow:0 8px 22px rgba(43,42,39,.1);font:500 13px 'Figtree',sans-serif;color:#6B665E;transition:opacity .6s ease}
.nw-hint.gone{opacity:0}
.nw-hint span{display:flex;align-items:center;gap:6px;white-space:nowrap}
.nw-hint kbd{min-width:22px;height:22px;padding:0 5px;box-sizing:border-box;display:inline-flex;align-items:center;justify-content:center;background:#ECE6D9;border-radius:6px;font:700 11px 'Figtree',sans-serif;color:#2B2A27}
.nw-joy{position:absolute;left:24px;bottom:24px;width:116px;height:116px;border-radius:50%;background:rgba(251,248,241,.6);border:1px solid rgba(43,42,39,.1);box-shadow:0 8px 22px rgba(43,42,39,.12);pointer-events:auto;touch-action:none;display:none}
.nw-joy i{position:absolute;left:50%;top:50%;width:48px;height:48px;margin:-24px 0 0 -24px;border-radius:50%;background:#5E683C;box-shadow:0 4px 12px rgba(60,66,38,.3)}
.nw.touch .nw-joy{display:block}
.nw.touch .nw-hint{left:50%;bottom:auto;top:76px;transform:translateX(-50%);max-width:calc(100vw - 32px)}
.nw-wave{position:absolute;right:120px;bottom:24px;pointer-events:auto}
.nw-phone-btn{position:absolute;right:30px;bottom:22px;width:68px;height:116px;padding:5px;box-sizing:border-box;background:#2B2A27;border-radius:19px;box-shadow:0 14px 30px rgba(43,42,39,.3);transform:rotate(-6deg);transform-origin:bottom right;transition:transform .22s ease,opacity .2s ease;pointer-events:auto}
.nw-phone-btn:hover{transform:rotate(-2deg) translateY(-6px)}
.nw-phone-btn.off{opacity:0;pointer-events:none;transform:rotate(-6deg) scale(.8)}
.nw-phone-btn b{position:relative;display:grid;grid-template-columns:1fr 1fr;gap:5px;align-content:center;height:100%;padding:18px 8px 10px;box-sizing:border-box;background:#F3EEE6;border-radius:14px}
.nw-phone-btn b:before{content:'';position:absolute;top:6px;left:50%;width:20px;height:5px;margin-left:-10px;border-radius:3px;background:#2B2A27}
.nw-phone-btn i{aspect-ratio:1;border-radius:7px}
.nw-phone-tip{position:absolute;right:24px;bottom:152px;padding:7px 12px;background:#2B2A27;color:#F8F4EC;border-radius:12px;font:600 13px 'Figtree',sans-serif;white-space:nowrap;transition:opacity .3s ease}
.nw-phone-tip.off{opacity:0}
.nw-phone{position:absolute;right:24px;bottom:22px;width:min(316px,calc(100vw - 32px));height:min(610px,calc(100vh - 100px));padding:9px;box-sizing:border-box;background:#2B2A27;border-radius:46px;box-shadow:0 24px 60px rgba(43,42,39,.38);pointer-events:auto;transform-origin:bottom right;transition:transform .3s cubic-bezier(.2,.9,.3,1.12),opacity .2s ease}
.nw-phone.off{transform:scale(.22) rotate(-6deg);opacity:0;pointer-events:none}
.nw-screen{position:relative;height:100%;display:flex;flex-direction:column;background:#F3EEE6;border-radius:38px;overflow:hidden}
.nw-notch{position:absolute;top:9px;left:50%;width:86px;height:22px;margin-left:-43px;border-radius:12px;background:#2B2A27;z-index:2}
.nw-status{flex:none;display:flex;justify-content:space-between;align-items:center;height:40px;padding:0 24px;font:700 13px 'Figtree',sans-serif}
.nw-body{flex:1;min-height:0;overflow:auto;padding:6px 14px 4px}
.nw-h{font:700 25px/1.1 'Figtree',sans-serif;letter-spacing:-.02em;padding:8px 4px 4px}
.nw-sub{font:500 13px/1.4 'Figtree',sans-serif;color:#6B665E;padding:0 4px 12px}
.nw button.nw-game{width:100%;display:flex;align-items:center;gap:12px;padding:10px;margin-bottom:8px;box-sizing:border-box;background:#FBF8F1;border:1px solid rgba(43,42,39,.07);border-radius:18px;text-align:left;transition:transform .15s ease}
.nw button.nw-game:hover{transform:translateY(-1px)}
.nw-ico{flex:none;display:flex;align-items:center;justify-content:center;width:46px;height:46px;border-radius:14px;color:#F8F4EC}
.nw-game span{flex:1;min-width:0}
.nw-game strong{display:block;font:700 15px/1.2 'Figtree',sans-serif}
.nw-game small{display:block;margin-top:2px;font:500 12px/1.3 'Figtree',sans-serif;color:#6B665E}
.nw-soon{flex:none;padding:3px 8px;border-radius:999px;background:#ECE6D9;color:#6B665E;font:700 11px 'Figtree',sans-serif}
.nw button.nw-back{display:flex;align-items:center;gap:4px;height:34px;padding:0 12px 0 8px;margin:4px 0 8px;background:#ECE6D9;border-radius:999px;font:600 14px 'Figtree',sans-serif}
.nw-big{display:flex;align-items:center;justify-content:center;width:76px;height:76px;margin:8px 4px 12px;border-radius:24px;color:#F8F4EC}
.nw-facts{display:flex;flex-direction:column;gap:6px;margin:0 0 14px}
.nw-facts div{display:flex;justify-content:space-between;gap:10px;padding:10px 12px;background:#FBF8F1;border:1px solid rgba(43,42,39,.07);border-radius:14px;font:500 13px 'Figtree',sans-serif;color:#6B665E}
.nw-facts b{color:#2B2A27;font-weight:600;text-align:right}
.nw button.nw-play{width:100%;height:52px;border-radius:18px;background:#5E683C;color:#F8F4EC;font:600 17px 'Figtree',sans-serif;opacity:.45;cursor:default}
.nw button.nw-homebar{flex:none;width:100%;height:28px;display:flex;align-items:center;justify-content:center;background:none}
.nw-homebar:after{content:'';width:110px;height:5px;border-radius:3px;background:rgba(43,42,39,.32)}
.nw-notes{position:fixed;top:14px;left:50%;transform:translateX(-50%);z-index:40;display:flex;flex-direction:column;align-items:center;gap:8px;width:min(430px,calc(100vw - 24px));pointer-events:none}
.nw-note{display:flex;align-items:center;gap:12px;width:100%;box-sizing:border-box;padding:10px 12px;background:#FBF8F1;border:1px solid rgba(43,42,39,.07);border-radius:20px;box-shadow:0 14px 36px rgba(43,42,39,.22);pointer-events:auto;animation:nwIn .32s cubic-bezier(.2,.9,.3,1.2);transition:opacity .25s ease,transform .25s ease}
@keyframes nwIn{from{transform:translateY(-18px);opacity:0}}
.nw-note.out{opacity:0;transform:translateY(-10px)}
.nw-av{flex:none;position:relative;width:40px;height:40px;border-radius:50%;background:#E4E6D2 center/cover}
.nw-av.on:after{content:'';position:absolute;right:-1px;bottom:-1px;width:10px;height:10px;border-radius:50%;background:#5E683C;border:2px solid #FBF8F1}
.nw-note p{flex:1;min-width:0;margin:0;font:500 14px/1.35 'Figtree',sans-serif}
.nw-note p b{font-weight:700}
.nw-note button{flex:none;height:36px;padding:0 14px;border-radius:12px;background:#ECE6D9;font:600 14px 'Figtree',sans-serif}
.nw-note button.yes{background:#5E683C;color:#F8F4EC}
.nw-inv-wrap{position:fixed;inset:0;z-index:30;display:none}
.nw-inv-wrap.on{display:block}
.nw-inv-wrap.dim{background:rgba(243,238,230,.6)}
.nw-inv{position:absolute;right:24px;top:76px;width:min(380px,calc(100vw - 32px));max-height:min(72vh,560px);display:flex;flex-direction:column;background:#FBF8F1;border:1px solid rgba(43,42,39,.07);border-radius:24px;box-shadow:0 16px 40px rgba(43,42,39,.18);overflow:hidden}
.nw-inv-wrap.dim .nw-inv{right:auto;left:50%;top:50%;transform:translate(-50%,-50%)}
.nw-inv header{display:flex;align-items:flex-start;gap:10px;padding:16px 12px 8px 18px}
.nw-inv header div{flex:1;min-width:0}
.nw-inv h2{margin:0;font:700 19px/1.2 'Figtree',sans-serif}
.nw-inv header p{margin:3px 0 0;font:500 13px/1.35 'Figtree',sans-serif;color:#6B665E}
.nw-inv header button{flex:none;display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:#ECE6D9;border-radius:12px}
.nw-list{flex:1;min-height:0;overflow:auto;padding:4px 10px}
.nw-fr{display:flex;align-items:center;gap:12px;min-height:54px;padding:4px 8px;border-radius:14px}
.nw-fr .nw-av{width:38px;height:38px}
.nw-fr span{flex:1;min-width:0}
.nw-fr strong{display:block;font:600 15px/1.25 'Figtree',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nw-fr small{display:block;font:500 12.5px/1.3 'Figtree',sans-serif;color:#6B665E;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nw-fr button{flex:none;height:34px;padding:0 15px;border-radius:999px;background:#5E683C;color:#F8F4EC;font:600 14px 'Figtree',sans-serif;transition:transform .15s ease}
.nw-fr button:hover{transform:translateY(-1px)}
.nw-fr em{flex:none;height:34px;padding:0 12px;display:flex;align-items:center;border-radius:999px;background:#E4E6D2;color:#5E683C;font:600 13px 'Figtree',sans-serif;font-style:normal;white-space:nowrap}
.nw-fr em.off{background:#ECE6D9;color:#6B665E}
.nw-none{padding:16px 10px;font:500 14px/1.4 'Figtree',sans-serif;color:#6B665E;text-align:center}
.nw-inv footer{padding:10px 18px 14px;font:500 12px/1.4 'Figtree',sans-serif;color:#6B665E;border-top:1px solid rgba(43,42,39,.07)}
.nw-tag{pointer-events:auto;cursor:pointer;transition:background .2s ease,color .2s ease}
.nw-tag--near{background:#2B2A27;color:#F8F4EC}
.nw-tag--near:after{content:'  ›';opacity:.8}
.nw-pop{position:absolute;left:24px;top:50%;width:min(300px,calc(100vw - 28px));padding:12px;box-sizing:border-box;background:#FBF8F1;border:1px solid rgba(43,42,39,.07);border-radius:24px;box-shadow:0 16px 40px rgba(43,42,39,.2);pointer-events:auto;transform:translateY(-50%);transition:transform .28s cubic-bezier(.2,.9,.3,1.1),opacity .2s ease}
.nw-pop.off{transform:translate(-30px,-50%);opacity:0;pointer-events:none}
.nw.game .nw-pop{display:none}
.nw-pop-head{display:flex;align-items:center;gap:12px;padding:2px 2px 8px}
.nw-pop-head .nw-av{width:52px;height:52px}
.nw-pop-head span{flex:1;min-width:0}
.nw-pop-head strong{display:block;font:700 18px/1.2 'Figtree',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nw-pop-head small{display:block;margin-top:2px;font:500 13px/1.3 'Figtree',sans-serif;color:#6B665E}
.nw button.nw-pop-x{flex:none;align-self:flex-start;display:flex;align-items:center;justify-content:center;width:34px;height:34px;background:#ECE6D9;border-radius:11px}
.nw-pop-label{padding:8px 4px 6px;font:700 11px 'Figtree',sans-serif;letter-spacing:.06em;text-transform:uppercase;color:#6B665E}
.nw-pop .nw-game{margin-bottom:2px}
.nw-pop-wait{display:flex;flex-direction:column;align-items:center;gap:4px;padding:8px 6px 2px;text-align:center}
.nw-pop-wait b{font:700 16px 'Figtree',sans-serif}
.nw-pop-wait small{font:500 13px 'Figtree',sans-serif;color:#6B665E}
.nw button.nw-pop-no{margin-top:10px;width:100%;height:44px;border-radius:14px;background:#ECE6D9;font:600 15px 'Figtree',sans-serif}
.nw-dots{display:flex;gap:6px;margin:6px 0 4px}
.nw-dots i{width:9px;height:9px;border-radius:50%;background:#5E683C;animation:nwDot 1s ease-in-out infinite}
.nw-dots i:nth-child(2){animation-delay:.15s}.nw-dots i:nth-child(3){animation-delay:.3s}
@keyframes nwDot{50%{transform:translateY(-6px);opacity:.4}}
.nw-match{display:none;position:absolute;inset:0}
.nw.game .nw-match{display:block}
.nw.chat .nw-phone-btn,.nw.chat .nw-phone-tip,.nw.chat .nw-phone,.nw.chat .nw-wave{display:none}
.nw.chat .nw-tags{right:min(404px,100%)}
.nw.game .nw-top,.nw.game .nw-hint,.nw.game .nw-joy,.nw.game .nw-wave,.nw.game .nw-phone-btn,.nw.game .nw-phone-tip,.nw.game .nw-phone{display:none}
.nw-bars{position:absolute;top:18px;left:50%;transform:translateX(-50%);width:min(640px,calc(100vw - 28px));display:flex;align-items:center;gap:10px}
.nw-side{flex:1;min-width:0;display:flex;align-items:center;gap:10px;padding:8px 12px 8px 8px;background:rgba(251,248,241,.95);border-radius:18px;box-shadow:0 8px 22px rgba(0,0,0,.28)}
.nw-side.r{flex-direction:row-reverse;padding:8px 8px 8px 12px;text-align:right}
.nw-side>div{flex:1;min-width:0}
.nw-side b{display:block;font:700 14px/1.2 'Figtree',sans-serif;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.nw-side .nw-av{width:36px;height:36px}
.nw-hp{height:10px;margin-top:5px;border-radius:5px;background:#E2DBCD;overflow:hidden}
.nw-hp u{display:block;height:100%;width:100%;border-radius:5px;background:#4C5FA8;transition:width .25s ease}
.nw-side.red .nw-hp u{background:#C2452D}
.nw-side.r .nw-hp u{margin-left:auto}
.nw-side.hit{animation:nwHit .3s ease}
@keyframes nwHit{35%{transform:scale(1.05);background:#F6D9CC}}
.nw-num{display:none;flex:none;min-width:46px;font:700 32px/1 'Figtree',sans-serif;font-style:normal;font-variant-numeric:tabular-nums;text-align:center}
.nw-bars.nums .nw-num{display:block}
.nw-bars.nums .nw-hp{display:none}
.nw-clock{flex:none;min-width:56px;height:40px;padding:0 8px;box-sizing:border-box;display:flex;align-items:center;justify-content:center;background:#2B2A27;color:#F8F4EC;border-radius:14px;font:700 17px 'Figtree',sans-serif;font-variant-numeric:tabular-nums}
.nw-banner{position:absolute;left:50%;top:36%;transform:translate(-50%,-50%);font:700 clamp(40px,9vw,92px)/1 'Figtree',sans-serif;letter-spacing:.02em;white-space:nowrap;color:#F8F4EC;text-shadow:0 6px 30px rgba(0,0,0,.5);text-align:center;opacity:0;transition:opacity .35s ease}
.nw-banner.on{opacity:1}
.nw-banner.code{color:#9CFFBB;letter-spacing:.2em;text-shadow:0 0 30px rgba(60,255,120,.75),0 0 4px rgba(60,255,120,.9)}
.nw-banner small{display:block;margin-top:12px;font:600 18px 'Figtree',sans-serif;letter-spacing:0;opacity:.92}
.nw-ctl{position:absolute;left:50%;bottom:22px;transform:translateX(-50%);display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:8px;width:max-content;max-width:calc(100vw - 190px)}
.nw-chip{padding:10px 14px;background:rgba(43,42,39,.88);color:#F8F4EC;border-radius:14px;font:600 13px 'Figtree',sans-serif;text-align:center}
.nw-chip.live{background:#5E683C}
.nw-punch{pointer-events:auto}
.nw-quit{position:absolute;right:24px;bottom:22px;pointer-events:auto}
@media (max-width:620px){.nw-pop{left:14px;top:auto;bottom:150px;transform:none}.nw-pop.off{transform:translateX(-30px)}.nw-quit{right:14px}.nw-ctl{bottom:74px;max-width:calc(100vw - 28px)}.nw-top{left:14px;right:14px}.nw-pill{padding:0 12px}.nw-here span,.nw-faces,.nw-row>svg{display:none}.nw-inv{right:16px}}
`;

const ICON = d => '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + d + '</svg>';
const I = {
  back: '<path d="M15 6l-6 6 6 6"/>', close: '<path d="M6 6l12 12M18 6L6 18"/>',
  invite: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.5-3.5 3-5.5 6.5-5.5s6 2 6.5 5.5"/><path d="M19 8v6M16 11h6"/>',
  pushup: '<circle cx="19" cy="8" r="2"/><path d="M3 18l13-7 3 1M8 15.5V19M16 11l-1 6"/>', squat: '<circle cx="12" cy="4.5" r="2"/><path d="M12 7v5l-5 2 1 6M12 12l5 2-1 6M5 9h14"/>', plank: '<circle cx="19" cy="10" r="2"/><path d="M3 17l13-4M16 13v4h4M3 20h18"/>',
  glove: '<path d="M7 11V7a4 4 0 0 1 4-4h2a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H9a2 2 0 0 1-2-2z"/><path d="M7 11H5.5a2 2 0 0 0 0 4H7M8 17v4h8v-4"/>',
  mark: '<svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true"><rect width="32" height="32" rx="10" fill="#5E683C"/><path d="M10 23v-8a6 6 0 0 1 12 0v8" stroke="#F8F4EC" stroke-width="3.2" stroke-linecap="round"/><circle cx="16" cy="21.5" r="2" fill="#F8F4EC"/></svg>'
};
// Placeholder game modes: names and rules are suggestions until the real ones are decided.
const GAMES = [
  { name: 'Copy the pose', line: 'Match the pose before time runs out', color: '#5E683C', players: '1 to 6', uses: 'Arms and body lean', about: 'A pose shows up on your phone. Copy it with your body before the timer ends. The closer the match, the more points you get.', icon: '<circle cx="12" cy="5" r="2.2"/><path d="M5 5l4.5 5h5L19 5M12 10v5M12 15l-3.5 6M12 15l3.5 6"/>' },
  { name: 'Dance off', line: 'Hit the moves on the beat', color: '#B9694C', players: '2 to 6', uses: 'Arms and head', about: 'Moves come in on the beat. Hit them with your arms to keep your streak going. The highest score wins the round.', icon: '<path d="M9 18V6l10-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="16.5" cy="16" r="2.5"/>' },
  { name: 'Simon says', line: 'One leads, everyone copies', color: '#C08A3A', players: '3 to 8', uses: 'Arms, head and lean', about: 'One player leads and everyone copies their moves. Miss a move and you sit out until the next round.', icon: '<path d="M4 10v4h3l6 4V6L7 10H4z"/><path d="M16.5 9a4 4 0 0 1 0 6M19 6.5a8 8 0 0 1 0 11"/>' },
  { name: 'Freeze', line: 'Hold still when the music stops', color: '#5C5E78', players: '2 to 8', uses: 'Whole upper body', about: 'Dance while the music plays. When it stops, hold still. Anyone who moves is out.', icon: '<circle cx="12" cy="12" r="9"/><path d="M10 9v6M14 9v6"/>' },
  { name: 'Charades', line: 'Act it out, friends guess', color: '#8A6245', players: '3 to 8', uses: 'Arms and head', about: 'You get a secret word. Act it out with your body while your friends guess it.', icon: '<path d="M5 4h14a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-8l-5 4v-4H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2z"/><path d="M10 9a2 2 0 1 1 2.6 1.9c-.4.2-.6.5-.6 1M12 14.3v.1"/>' }
];

// o: { T, nook, canvas, options, crowd, profile(), friends(), onEnter(), onLeave() }
export function createWorldApp(o) {
  const { T, nook, canvas } = o;
  if (!document.getElementById('nw-css')) { const st = document.createElement('style'); st.id = 'nw-css'; st.textContent = CSS; document.head.appendChild(st); }
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
  const html = (tag, cls, markup) => { const n = el(tag, cls); n.innerHTML = markup; return n; };   // only for our own fixed markup, never for names
  const face = (cls, url) => { const n = el('i', cls); if (url) n.style.backgroundImage = 'url(' + url + ')'; return n; };
  const timers = new Set(), later = (fn, ms) => { const id = setTimeout(() => { timers.delete(id); fn(); }, ms); timers.add(id); };

  /* ---------- the island screen ---------- */
  const hud = el('div', 'nw'), tagLayer = el('div', 'nw-tags'), top = el('div', 'nw-top');
  const left = el('div', 'nw-row'), right = el('div', 'nw-row');
  const leaveBtn = html('button', 'nw-pill', ICON(I.back) + '<span>Leave</span>'); leaveBtn.type = 'button'; leaveBtn.title = 'Leave the island';
  const here = el('div', 'nw-pill nw-here'), hereFaces = el('div', 'nw-faces'), hereN = el('b'), hereT = el('span', null, 'here');
  const inviteBtn = html('button', 'nw-pill nw-go', ICON(I.invite) + '<span>Invite</span>'); inviteBtn.type = 'button';
  left.innerHTML = I.mark; left.appendChild(leaveBtn); here.append(hereFaces, hereN, hereT); right.append(here, inviteBtn); top.append(left, right);
  const hint = html('div', 'nw-hint', '<span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> walk</span><span><kbd>Shift</kbd> run</span><span>Drag to look</span><span>Click to walk there</span><span><kbd>E</kbd> wave</span><span>Click a player to play</span>');
  const joy = el('div', 'nw-joy'), knob = el('i'); joy.appendChild(knob);
  const waveBtn = el('button', 'nw-pill nw-wave', '👋 Wave'); waveBtn.type = 'button';
  const phoneBtn = html('button', 'nw-phone-btn', '<b><i style="background:#5E683C"></i><i style="background:#B9694C"></i><i style="background:#C08A3A"></i><i style="background:#5C5E78"></i></b>'); phoneBtn.type = 'button'; phoneBtn.title = 'Your phone: games'; phoneBtn.setAttribute('aria-label', 'Open your phone to pick a game');
  const phoneTip = el('div', 'nw-phone-tip', 'Games are on your phone');
  const phone = el('div', 'nw-phone off'), screen = el('div', 'nw-screen'), status = el('div', 'nw-status'), clock = el('span'), body = el('div', 'nw-body');
  const homebar = el('button', 'nw-homebar'); homebar.type = 'button'; homebar.title = 'Put the phone away'; homebar.setAttribute('aria-label', 'Put the phone away');
  status.append(clock, el('span', null, 'nook')); screen.append(el('div', 'nw-notch'), status, body, homebar); phone.appendChild(screen);
  hud.append(tagLayer, top, hint, joy, waveBtn, phoneTip, phoneBtn, phone);
  const notes = el('div', 'nw-notes'), invWrap = el('div', 'nw-inv-wrap'), inv = el('div', 'nw-inv');
  invWrap.appendChild(inv); document.body.append(hud, invWrap, notes);
  if (window.matchMedia && matchMedia('(pointer: coarse)').matches) { hud.classList.add('touch'); hint.innerHTML = '<span>Use the stick to walk</span><span>Drag the view to look</span><span>Tap the ground to walk there</span><span>Tap a player to play</span>'; }

  const world = createWorld(T, nook.kit, canvas, tagLayer, { onMoved: () => later(() => hint.classList.add('gone'), 4000), onPerson: id => openContact(id) });
  nook.setWorldTick((t, dt) => world.tick(t, dt));

  /* ---------- notifications ---------- */
  // parts: strings, or { b: 'bold text' }. actions: [{ label, yes, fn }]
  function note(n) {
    const card = el('div', 'nw-note'), p = el('p');
    if (n.thumb !== undefined) card.appendChild(face('nw-av', n.thumb));
    n.parts.forEach(x => p.appendChild(typeof x === 'string' ? document.createTextNode(x) : el('b', null, x.b)));
    card.appendChild(p);
    const close = () => { if (card.dead) return; card.dead = true; card.classList.add('out'); setTimeout(() => card.remove(), 260); };
    (n.actions || []).forEach(a => { const b = el('button', a.yes ? 'yes' : null, a.label); b.type = 'button'; b.onclick = () => { close(); a.fn && a.fn(); }; card.appendChild(b); });
    card.setAttribute('role', n.actions ? 'alertdialog' : 'status');
    notes.appendChild(card); later(() => { if (!card.dead && n.onExpire) n.onExpire(); close(); }, n.ttl || 4200);
    return close;
  }

  /* ---------- who you are, and other windows ---------- */
  const SS = { get(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } }, set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} } };
  const rid = () => Math.random().toString(36).slice(2, 10), str = (v, n) => String(v == null ? '' : v).slice(0, n);
  let uid = SS.get('nook.uid') || rid(), uname = str(new URLSearchParams(location.search).get('name') || SS.get('nook.uname'), 20), active = false;
  SS.set('nook.uid', uid);
  const myCard = () => { const p = o.profile(); if (!uname) { uname = p.names[Math.floor(Math.random() * p.names.length)]; SS.set('nook.uname', uname); } return { name: uname, flag: p.flag, cfg: p.cfg }; };
  const cleanCfg = c => { const out = {}; Object.keys(o.options).forEach(k => { const v = c && Number.isFinite(c[k]) ? Math.floor(c[k]) : 0; out[k] = Math.max(0, Math.min(o.options[k].length - 1, v)); }); return out; };
  const bc = typeof BroadcastChannel === 'function' ? new BroadcastChannel('nook-meet') : null;
  const peers = new Map();    // people in other windows: id -> { id, name, flag, cfg, thumb, inWorld, last }
  const sent = new Map();     // who you invited: id -> 'sent' | 'later'
  const joined = new Map();   // simulated friends who came over: id -> def
  let chan = null, localId = '', tickN = 0;   // chan: the internet channel while you are signed in (see syncNet)
  const post = m => { const msg = Object.assign({ from: uid }, m); try { if (chan) { const r = chan.ch.send({ type: 'broadcast', event: 'w', payload: msg }); if (r && r.catch) r.catch(() => {}); } else if (bc) bc.postMessage(msg); } catch (e) {} };
  const hello = ask => post({ t: 'hello', p: myCard(), inWorld: active, ask: !!ask });
  function meet(id, p, inWorld) {
    let pr = peers.get(id); if (!pr) { pr = { id, key: '' }; peers.set(id, pr); }
    const cfg = cleanCfg(p.cfg), key = JSON.stringify(cfg);
    if (pr.key !== key) { if (pr.thumb) URL.revokeObjectURL(pr.thumb); pr.key = key; pr.cfg = cfg; pr.thumb = nook.thumb(cfg); world.remove(id); }
    pr.name = str(p.name, 20) || 'Guest'; pr.flag = str(p.flag, 8); pr.last = Date.now();
    if (inWorld != null) pr.inWorld = !!inWorld;
    return pr;
  }
  function drop(id) { const pr = peers.get(id); if (!pr) return; if (match && match.opp.id === id) games.gone(); if (contact && contact.id === id) closePop(); if (pr.thumb) URL.revokeObjectURL(pr.thumb); peers.delete(id); sent.delete(id); world.remove(id); refresh(); }
  function onNet(e) {
    const m = e.data; if (!m || typeof m !== 'object' || typeof m.from !== 'string' || !m.from) return;
    if (m.from === uid) { if (m.t === 'hello' && !chan) { uid = rid(); uname = ''; SS.set('nook.uid', uid); SS.set('nook.uname', ''); hello(true); } return; }   // a duplicated tab took our id: get a new one
    if (m.t === 'bye') return drop(m.from);
    const pr = m.p && typeof m.p === 'object' ? meet(m.from, m.p, m.t === 'hello' ? m.inWorld : null) : peers.get(m.from);
    if (!pr) return;
    if (m.t === 'game') { if (m.to === uid) onGameMsg(pr, m); return; }
    if (m.t === 'hello') { if (m.ask) hello(false); refresh(); }
    else if (m.t === 'state') { pr.last = Date.now(); if (active && pr.inWorld) world.remote(pr.id, m.s); }
    else if (m.t === 'invite' && m.to === uid) {
      const answer = ok => post({ t: 'reply', to: pr.id, ok, p: myCard() });
      note({ thumb: pr.thumb, parts: [{ b: pr.name }, ' ' + pr.flag + '  invited you to the island'], ttl: 30000, onExpire: () => answer(false),
        actions: [{ label: 'Join', yes: true, fn: () => { answer(true); if (!active) o.onEnter(); } }, { label: 'Not now', fn: () => answer(false) }] });
    } else if (m.t === 'reply' && m.to === uid) {
      if (!m.ok) sent.delete(pr.id);
      note({ thumb: pr.thumb, parts: [{ b: pr.name }, m.ok ? ' is joining you on the island' : ' can’t join right now'] }); refresh();
    }
  }
  if (bc) bc.onmessage = e => { if (!chan) onNet(e); };
  /* ---------- real accounts (backend.js) ----------
     Signed in with a profile: the same messages go over a Supabase realtime channel instead, so they reach your friends
     on their own computers. Your id is then your account id and your name is your profile name. Signed out: other
     windows of this browser, as before. */
  const account = () => { const be = o.backend && o.backend(), s = be && be.state; return be && be.client && s && s.user && s.profile ? { be, sb: be.client, id: String(s.user.id), name: s.profile.displayName || s.profile.username } : null; };
  function syncNet() {
    const a = account();
    if (a && (!chan || chan.uid !== a.id)) {
      if (chan) try { chan.sb.removeChannel(chan.ch); } catch (e) {}
      [...peers.keys()].forEach(drop);
      const ch = a.sb.channel('nook-world', { config: { broadcast: { self: false } } });
      ch.on('broadcast', { event: 'w' }, ({ payload }) => onNet({ data: payload })).subscribe(status => { if (status === 'SUBSCRIBED') hello(true); });
      if (!chan) localId = uid;
      chan = { ch, sb: a.sb, uid: a.id }; uid = a.id; uname = str(a.name, 20);
    } else if (!a && chan) {   // signed out again
      try { chan.sb.removeChannel(chan.ch); } catch (e) {}
      chan = null; [...peers.keys()].forEach(drop); uid = localId || rid(); uname = SS.get('nook.uname'); hello(true);
    }
  }
  const beat = setInterval(() => { syncNet(); hello(false); const now = Date.now(); [...peers.values()].forEach(pr => { if (now - pr.last > 7000) drop(pr.id); }); }, 2000);
  const pulse = setInterval(() => {
    tickN++;   // over the internet send less often, to stay inside the channel's message limit
    if (active && peers.size && !match && (!chan || tickN % 3 === 0)) { const s = world.state(); if (s) post({ t: 'state', s }); }
    if (match && match.remote && (!chan || tickN % 2 === 0)) { const a = games.poseOut(); if (a) post({ t: 'game', k: 'pose', to: match.opp.id, a }); }
  }, 100);
  const onHide = () => post({ t: 'bye' });
  window.addEventListener('pagehide', onHide);
  later(() => hello(true), 0);

  /* ---------- inviting ---------- */
  function invite(f) {
    if (sent.has(f.id) || f.here) return;
    if (f.kind === 'peer') { sent.set(f.id, 'sent'); post({ t: 'invite', to: f.id, p: myCard() }); note({ thumb: f.thumb, parts: ['Invite sent to ', { b: f.name }] }); }
    else if (f.online) {   // simulated friend: says yes after a moment
      sent.set(f.id, 'sent'); note({ thumb: f.thumb, parts: ['Invite sent to ', { b: f.name }] });
      later(() => {
        const def = { id: f.id, name: f.name, flag: f.flag || '', cfg: cleanCfg(f.cfg), thumb: f.thumb, kind: 'friend' };
        joined.set(f.id, def); note({ thumb: f.thumb, parts: [{ b: f.name }, active ? ' joined you on the island' : ' is waiting for you on the island'] });
        if (active) world.add(def, { arrive: true });
        refresh();
      }, 2600 + Math.random() * 2600);
    } else { sent.set(f.id, 'later'); note({ thumb: f.thumb, parts: [{ b: f.name }, ' is offline. They’ll see your invite when they’re back.'] }); }
    refresh();
  }
  function friendRows() {
    const rows = [], a = account();
    if (a) {   // signed in: your real friends. Only the ones who have Nook open right now can get an invite.
      a.be.state.friends.filter(f => f.status === 'accepted').forEach(f => {
        const id = String(f.userId), pr = peers.get(id), on = a.be.state.online && a.be.state.online.has(f.userId);
        rows.push(pr ? { id, kind: 'peer', name: f.displayName, sub: pr.inWorld ? 'On the island' : 'On Nook now', thumb: pr.thumb, online: true, here: !!pr.inWorld }
          : { id, kind: 'away', name: f.displayName, sub: on ? 'Online, but not on Nook' : 'Offline', thumb: o.friendThumb ? o.friendThumb(f.userId) : undefined, online: false, here: false });
      });
      return rows.sort((x, y) => (y.kind === 'peer') - (x.kind === 'peer'));
    }
    peers.forEach(pr => rows.push({ id: pr.id, kind: 'peer', name: pr.name + ' ' + pr.flag, sub: 'Online in another window', thumb: pr.thumb, online: true, here: !!pr.inWorld }));
    o.friends().forEach(f => rows.push(Object.assign({ kind: 'sim', here: joined.has(f.id) }, f)));
    return rows;
  }
  // the list is only rebuilt when something in it changed, so a button never disappears under a click
  const inviteSig = () => JSON.stringify(friendRows().map(f => [f.id, f.name, f.sub, f.here, f.online, f.thumb, sent.get(f.id)]));
  let drawnSig = '';
  function drawInvite() {
    drawnSig = inviteSig(); inv.textContent = '';
    const head = el('header'), txt = el('div'), x = html('button', null, ICON(I.close)); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = closeInvite;
    txt.append(el('h2', null, 'Invite friends'), el('p', null, 'They get a notification and can join you on the island.')); head.append(txt, x);
    const list = el('div', 'nw-list');
    friendRows().forEach(f => {
      const row = el('div', 'nw-fr'), who = el('span'); who.append(el('strong', null, f.name), el('small', null, f.here ? 'On the island' : sent.get(f.id) === 'later' ? 'Will see it when they’re back' : f.sub));
      row.append(face('nw-av' + (f.online ? ' on' : ''), f.thumb), who);
      if (f.here) row.appendChild(el('em', null, 'Here'));
      else if (f.kind === 'away') row.appendChild(el('em', 'off', 'Not here'));
      else if (sent.has(f.id)) row.appendChild(el('em', null, 'Invited ✓'));
      else { const b = el('button', null, 'Invite'); b.type = 'button'; b.setAttribute('aria-label', 'Invite ' + f.name); b.onclick = () => invite(f); row.appendChild(b); }
      list.appendChild(row);
    });
    const real = !!account(); if (real && !list.children.length) list.appendChild(el('div', 'nw-none', 'No friends yet. Add people from Friends on the home screen.'));
    inv.append(head, list, el('footer', null, real ? 'Friends get your invite when they have Nook open.' : 'Demo: these friends are simulated until you sign in. Open this page in a second window to send a real invite.'));
  }
  function openInvite() { invWrap.className = 'nw-inv-wrap on' + (active ? '' : ' dim'); drawInvite(); }
  function closeInvite() { invWrap.className = 'nw-inv-wrap'; }
  invWrap.addEventListener('pointerdown', e => { if (e.target === invWrap) closeInvite(); });

  /* ---------- the phone ---------- */
  function drawGames() {
    body.textContent = ''; body.append(el('div', 'nw-h', 'Games'), el('div', 'nw-sub', 'Play together with your body. Your camera tracks your moves.'));
    GAMES.forEach(g => {
      const b = el('button', 'nw-game'), ico = html('i', 'nw-ico', ICON(g.icon)), tx = el('span'); b.type = 'button'; ico.style.background = g.color;
      tx.append(el('strong', null, g.name), el('small', null, g.line)); b.append(ico, tx, el('i', 'nw-soon', 'Soon')); b.onclick = () => drawGame(g); body.appendChild(b);
    });
    body.scrollTop = 0;
  }
  function drawGame(g) {
    body.textContent = '';
    const back = html('button', 'nw-back', ICON(I.back) + '<span>Games</span>'), big = html('div', 'nw-big', ICON(g.icon).replace('width="22" height="22"', 'width="38" height="38"')), facts = el('div', 'nw-facts');
    back.type = 'button'; back.onclick = drawGames; big.style.background = g.color;
    [['Players', g.players], ['Tracks', g.uses], ['Needs', 'Camera on']].forEach(r => { const d = el('div'); d.append(el('span', null, r[0]), el('b', null, r[1])); facts.appendChild(d); });
    const play = el('button', 'nw-play', 'Coming soon'); play.type = 'button'; play.disabled = true;
    body.append(back, big, el('div', 'nw-h', g.name), el('div', 'nw-sub', g.about), facts, play); body.scrollTop = 0;
  }
  function setPhone(open) {
    phone.classList.toggle('off', !open); phoneBtn.classList.toggle('off', open); phoneTip.classList.add('off');
    if (open) { clock.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); drawGames(); }
  }
  phoneBtn.onclick = () => setPhone(true); homebar.onclick = () => setPhone(false);


  /* ---------- playing with someone: their contact card, asking them, and the match screen ---------- */
  const games = createGames(T, nook.kit, world, {
    onPhase: (ph, result) => matchPhase(ph, result),
    onHit: h => { const side = h.onMe ? sideMe : sideThem; side.classList.remove('hit'); void side.offsetWidth; side.classList.add('hit'); drawBars(); },
    send: msg => { if (match && match.remote) post(Object.assign({ t: 'game', to: match.opp.id }, msg)); }
  });
  let contact = null, pending = null, match = null, barsTimer = 0; const asks = new Map();
  const matchEl = el('div', 'nw-match'), bars = el('div', 'nw-bars'), sideMe = el('div', 'nw-side'), sideThem = el('div', 'nw-side r'), clockEl = el('div', 'nw-clock'), banner = el('div', 'nw-banner'), ctl = el('div', 'nw-ctl'), chip = el('div', 'nw-chip');
  const punchL = el('button', 'nw-pill nw-punch', 'Left punch'), punchR = el('button', 'nw-pill nw-punch', 'Right punch'), quitBtn = el('button', 'nw-pill nw-quit', 'Leave match'), repBtn = el('button', 'nw-pill nw-go nw-punch', 'Rep');
  punchL.type = punchR.type = quitBtn.type = repBtn.type = 'button';
  bars.append(sideMe, clockEl, sideThem); ctl.append(chip, punchL, punchR, repBtn); matchEl.append(bars, banner, ctl, quitBtn); hud.appendChild(matchEl);
  // everyone you can meet on the island: simulated people, friends who came over, people in other windows
  function who(id) {
    const c = o.crowd.find(x => x.id === id); if (c) return { id, kind: 'npc', name: c.name, flag: c.flag || '', thumb: c.thumb, place: c.place || 'On the island' };
    const j = joined.get(id); if (j) return { id, kind: 'friend', name: j.name, flag: j.flag || '', thumb: j.thumb, place: 'Your friend' };
    const pr = peers.get(id); return pr ? { id, kind: 'peer', name: pr.name, flag: pr.flag || '', thumb: pr.thumb, place: chan ? 'On the island with you' : 'Playing in another window' } : null;
  }
  const label = c => c.name + (c.flag ? ' ' + c.flag : '');
  const gameRow = (g, pick) => {
    const b = el('button', 'nw-game'), ico = html('i', 'nw-ico', ICON(g.icon)), tx = el('span'); b.type = 'button'; ico.style.background = g.color;
    tx.append(el('strong', null, g.name), el('small', null, g.line)); b.append(ico, tx); if (g.soon) b.appendChild(el('i', 'nw-soon', 'Soon')); b.onclick = pick; return b;
  };
  // The menu on the left when you click someone standing near you: who they are, and the games you can start with them.
  const pop = el('div', 'nw-pop off'); hud.appendChild(pop);
  const PICKS = [
    { id: 'boxing', mode: '1v1', group: 'Challenge to a 1v1', name: 'Boxing', line: 'Your own arms throw the punches', color: '#C2452D', icon: I.glove },
    { id: 'pushups', mode: '1v1', name: 'Push-ups', line: 'Most push-ups in 40 seconds', color: '#5E683C', icon: I.pushup },
    { id: 'squats', mode: '1v1', name: 'Squats', line: 'Most squats in 40 seconds', color: '#C08A3A', icon: I.squat },
    { id: 'plank', mode: '1v1', name: 'Plank', line: 'Hold good form the longest', color: '#4C5FA8', icon: I.plank },
    { id: 'dance', mode: 'together', group: 'Play together', name: 'Dance floor', line: 'Dance together, your body leads', color: '#5C5E78', icon: GAMES[1].icon }
  ];
  function openContact(id) {
    const c = who(id); if (!c || match || games.active()) return;
    if (contact && contact.id !== id) closePop();
    contact = c; world.hold(id, 90); drawPop(); pop.classList.remove('off');
  }
  function closePop() { cancelAsk(); if (contact) world.hold(contact.id, 0); contact = null; pop.classList.add('off'); }
  function drawPop() {
    const c = contact; if (!c) return; pop.textContent = '';
    const head = el('div', 'nw-pop-head'), tx = el('span'), x = html('button', 'nw-pop-x', ICON(I.close)); x.type = 'button'; x.setAttribute('aria-label', 'Close'); x.onclick = closePop;
    tx.append(el('strong', null, label(c)), el('small', null, c.place)); head.append(face('nw-av', c.thumb), tx, x); pop.appendChild(head);
    if (pending) {   // you asked: wait for their answer
      const wait = el('div', 'nw-pop-wait'), no = el('button', 'nw-pop-no', 'Cancel'); no.type = 'button'; no.onclick = () => { cancelAsk(); drawPop(); };
      wait.append(html('div', 'nw-dots', '<i></i><i></i><i></i>'), el('b', null, 'Asking ' + c.name + '…'), el('small', null, MATCHES[pending.game].name + ' starts when they accept.'), no); pop.appendChild(wait); return;
    }
    PICKS.forEach(g => { if (g.group) pop.appendChild(el('div', 'nw-pop-label', g.group)); pop.appendChild(gameRow(g, () => ask(g.id, g.mode))); });
  }
  // walk away and the menu closes
  const nearCheck = setInterval(() => { if (!contact || pending || !active) return; const a = world.me(), b = world.person(contact.id); if (!a || !b || Math.hypot(a.x - b.x, a.z - b.z) > 3.4) closePop(); }, 600);
  function ask(game, mode) {
    const c = contact; if (!c || pending || match) return;
    pending = { id: c.id, kind: c.kind, game, n: rid() }; world.hold(c.id, 90); drawPop();
    if (c.kind === 'peer') post({ t: 'game', k: 'ask', to: c.id, game, mode, n: pending.n, p: myCard() });
    else { const n = pending.n; later(() => { if (pending && pending.n === n) accepted(null); }, 1300 + Math.random() * 1400); }   // simulated people always say yes
  }
  function cancelAsk() { if (!pending) return; if (pending.kind === 'peer') post({ t: 'game', k: 'cancel', to: pending.id, n: pending.n }); pending = null; }
  function accepted(spec) { const p = pending; pending = null; if (p && !startMatch({ game: p.game, oppId: p.id, role: 0, remote: p.kind === 'peer', spec }) && p.kind === 'peer') post({ t: 'game', k: 'end', to: p.id }); }
  // Both said yes: the island turns into the arena (worldgame.js) and the screen switches to the match.
  function startMatch(q) {
    const opp = who(q.oppId), sp = opp && active ? games.start(q) : null; if (!sp) return null;
    match = { opp, game: q.game, remote: !!q.remote }; pending = null; closePop(); setPhone(false); closeInvite(); hud.classList.add('game');
    const mk = (side, name, thumb, red) => { side.textContent = ''; side.classList.toggle('red', red); const d = el('div'), hp = el('div', 'nw-hp'); hp.appendChild(el('u')); d.append(el('b', null, name), hp); side.append(face('nw-av', thumb), d, el('em', 'nw-num', '0')); };
    mk(sideMe, 'You', o.profile().thumb, !!q.role); mk(sideThem, label(opp), opp.thumb, !q.role);   // blue for who asked, red for who accepted
    if (o.onMatch) o.onMatch(true);   // turns the camera on for body tracking
    clearInterval(barsTimer); barsTimer = setInterval(drawBars, 200); matchPhase('in');
    return sp;
  }
  function say(text, sub, code) { banner.textContent = ''; banner.className = 'nw-banner' + (text ? ' on' : '') + (code ? ' code' : ''); if (text) { banner.append(text); if (sub) banner.appendChild(el('small', null, sub)); } }
  function matchPhase(ph, result) {
    if (!match) return; const nm = match.opp.name, box = match.game === 'boxing';
    const G = MATCHES[match.game];
    if (ph === 'in') say(G.name.toUpperCase(), 'with ' + nm + (G.setup ? ' · ' + G.setup : ''), true);
    else if (ph === 'play') { say(G.kind ? 'GO!' : box ? 'FIGHT!' : 'DANCE!'); later(() => { if (match && games.info() && games.info().phase === 'play') say(''); }, 1300); }
    else if (ph === 'over') { if (result === 'win') say('YOU WIN'); else if (result === 'lose') say(nm.toUpperCase() + ' WINS'); else if (result === 'draw') say('DRAW'); else if (result === 'gone') say('MATCH OVER', nm + ' left'); else say(''); }
    else if (ph === 'out') say('');
    else if (ph === 'end') endMatch(result);
    drawBars();
  }
  function endMatch(result) {
    const mm = match; if (!mm) return; match = null; clearInterval(barsTimer); hud.classList.remove('game'); say('');
    if (o.onMatch) o.onMatch(false);
    const M = MATCHES[mm.game], G = M.name, sc = M.kind && mm.last ? ', ' + mm.last[0] + ' to ' + mm.last[1] : '';
    const t = result === 'win' ? ['You beat ', { b: mm.opp.name }, ' at ' + G + sc] : result === 'lose' ? [{ b: mm.opp.name }, ' beat you at ' + G + sc] : result === 'draw' ? ['A draw with ', { b: mm.opp.name }, sc] : null;
    if (t) note({ thumb: mm.opp.thumb, parts: t });
  }
  function drawBars() {
    const i = games.info(); if (!i || !match) return;
    const G = MATCHES[match.game], box = match.game === 'boxing', gym = !!G.kind, hold = G.kind === 'hold', tr = o.tracking ? o.tracking() : {}, playing = i.phase === 'play';
    bars.style.display = box || gym ? '' : 'none'; bars.classList.toggle('nums', gym);
    sideMe.querySelector('u').style.width = i.hp[0] + '%'; sideThem.querySelector('u').style.width = i.hp[1] + '%';
    if (gym) { const show = v => hold ? Math.floor(v) + 's' : String(Math.round(v)); match.last = i.score.map(show); sideMe.querySelector('em').textContent = match.last[0]; sideThem.querySelector('em').textContent = match.last[1]; }
    clockEl.textContent = Math.floor(i.clock / 60) + ':' + String(Math.ceil(i.clock) % 60).padStart(2, '0');
    const camera = tr.on && tr.state !== 'on' ? 'Starting your camera…' : tr.on ? (gym ? 'Step back so the camera sees your whole body' : 'Step back so the camera sees your arms') : '';
    const noCam = box ? 'No camera: J and K punch, Shift for body shots' : hold ? 'No camera: hold Space to hold your plank' : gym ? 'No camera: hold Space to go down, let go to count a rep' : 'No camera: your avatar dances by itself';
    const text = playing && i.cue ? i.cue : i.tracking ? 'Body tracking on' : camera || noCam;   // i.cue: what the counter needs from you, e.g. "Keep a hip, knee and ankle in view."
    if (chip.textContent !== text) chip.textContent = text; chip.classList.toggle('live', !!i.tracking && !(playing && i.cue));
    const keys = box && playing && !i.tracking; punchL.style.display = punchR.style.display = keys ? '' : 'none';
    repBtn.style.display = gym && playing && !i.tracking ? '' : 'none'; repBtn.textContent = hold ? 'Hold' : 'Rep';
    ctl.style.display = i.phase === 'out' ? 'none' : '';
  }
  punchL.onpointerdown = () => games.punch(1, 'head'); punchR.onpointerdown = () => games.punch(-1, 'head');
  quitBtn.onclick = () => { if (match && match.remote) post({ t: 'game', k: 'end', to: match.opp.id }); games.quit(); };
  const press = down => games.press(down);
  repBtn.onpointerdown = e => { try { repBtn.setPointerCapture(e.pointerId); } catch (er) {} press(true); }; repBtn.onpointerup = repBtn.onpointercancel = () => press(false);
  const onGameKeyUp = e => { if (match && e.code === 'Space') press(false); };
  window.addEventListener('keyup', onGameKeyUp);
  const onGameKey = e => { if (!match || e.metaKey || e.ctrlKey) return; if (e.code === 'Space') { e.preventDefault(); if (!e.repeat) press(true); return; } if (e.repeat) return; if (e.code === 'KeyJ') games.punch(1, e.shiftKey ? 'body' : 'head'); else if (e.code === 'KeyK') games.punch(-1, e.shiftKey ? 'body' : 'head'); };
  window.addEventListener('keydown', onGameKey);
  // messages about a match from someone in another window
  function onGameMsg(pr, m) {
    if (m.k === 'ask') {
      const answer = (ok, spec) => post({ t: 'game', k: ok ? 'yes' : 'no', to: pr.id, n: m.n, spec });
      if (!active || match || pending || !MATCHES[m.game] || !world.has(pr.id)) return answer(false);
      const G = MATCHES[m.game].name, close = note({ thumb: pr.thumb, ttl: 20000, onExpire: () => answer(false), parts: [{ b: pr.name }, m.mode === 'together' ? ' invited you to play ' + G : ' challenged you to a 1v1: ' + G],
        actions: [{ label: 'Accept', yes: true, fn: () => { const sp = startMatch({ game: m.game, oppId: pr.id, role: 1, remote: true }); answer(!!sp, sp); } }, { label: 'Not now', fn: () => answer(false) }] });
      asks.set(String(m.n), close);
    } else if (m.k === 'cancel') { const c = asks.get(String(m.n)); if (c) { asks.delete(String(m.n)); c(); } }
    else if (m.k === 'yes') { if (pending && pending.n === m.n && pending.id === pr.id) accepted(m.spec); }
    else if (m.k === 'no') { if (pending && pending.n === m.n) { pending = null; note({ thumb: pr.thumb, parts: [{ b: pr.name }, ' can’t play right now'] }); drawPop(); } }
    else if (match && match.remote && match.opp.id === pr.id) { if (m.k === 'pose') games.poseIn(m.a); else if (m.k === 'hit') games.hitIn(m); else if (m.k === 'end') games.gone(); }
  }

  /* ---------- wiring ---------- */
  let hereSig = '';
  function refresh() {
    if (active) {   // people in other windows walk on or off the island
      peers.forEach(pr => { if (pr.inWorld && !world.has(pr.id)) world.add({ id: pr.id, name: pr.name, flag: pr.flag, cfg: pr.cfg, kind: 'remote' }); else if (!pr.inWorld && world.has(pr.id)) world.remove(pr.id); });
      const faces = api.lobby().faces.slice(0, 3), sig = world.count() + faces.join();
      if (sig !== hereSig) { hereSig = sig; hereN.textContent = String(world.count()); hereFaces.textContent = ''; faces.forEach(u => hereFaces.appendChild(face(null, u))); }
    }
    if (invWrap.classList.contains('on') && inviteSig() !== drawnSig) drawInvite();
  }
  leaveBtn.onclick = () => o.onLeave(); inviteBtn.onclick = openInvite; waveBtn.onclick = () => world.wave();
  let jid = null;
  const stick = e => { const r = joy.getBoundingClientRect(); let x = (e.clientX - r.left - r.width / 2) / (r.width / 2), y = (e.clientY - r.top - r.height / 2) / (r.height / 2); const l = Math.hypot(x, y); if (l > 1) { x /= l; y /= l; } knob.style.transform = 'translate(' + x * 32 + 'px,' + y * 32 + 'px)'; world.setJoy(x, -y); };
  joy.addEventListener('pointerdown', e => { jid = e.pointerId; joy.setPointerCapture(jid); stick(e); });
  joy.addEventListener('pointermove', e => { if (e.pointerId === jid) stick(e); });
  const unstick = e => { if (e.pointerId !== jid) return; jid = null; knob.style.transform = ''; world.setJoy(0, 0); };
  joy.addEventListener('pointerup', unstick); joy.addEventListener('pointercancel', unstick);
  const onEsc = e => { if (e.key !== 'Escape') return; if (invWrap.classList.contains('on')) closeInvite(); else if (contact) closePop(); else if (active) setPhone(false); };
  window.addEventListener('keydown', onEsc);

  const api = {
    active: () => active,
    // where you are on the island, for the companion robot that follows you (null in a match or off the island)
    me: () => { const p = active && !match ? world.me() : null; return p ? { x: p.x, y: p.y, z: p.z, ry: p.ry, s: world.S, cam: world.view.yaw, to: (x, y, z) => world.project(x, y, z) } : null; },   // cam: which way the camera looks from. to: island point -> screen pixels
    inMatch: () => !!match,
    // the Companion chat is open on the island: make room for its panel on the right
    setChat(open) { hud.classList.toggle('chat', !!open); },
    // both are safe to call again and again: the page calls them whenever the screen changes
    join() {
      if (active) return; active = true; closeInvite();
      world.enter({ id: 'me', name: 'You', cfg: o.profile().cfg }, o.crowd.map(c => Object.assign({ kind: 'npc' }, c)));
      joined.forEach(def => world.add(def, { arrive: true }));
      games.prewarm(); hud.classList.add('on'); hint.classList.remove('gone'); setPhone(false); phoneTip.classList.remove('off'); later(() => phoneTip.classList.add('off'), 7000);
      hello(false); refresh();
    },
    leave() { if (!active) return; if (match && match.remote) post({ t: 'game', k: 'end', to: match.opp.id }); games.abort(); endMatch(null); closePop(); active = false; world.leave(); hud.classList.remove('on'); closeInvite(); setPhone(false); hello(false); },
    openInvite,
    // for the World page on the home screen
    lobby() {
      const there = [...peers.values()].filter(pr => pr.inWorld);
      return { count: o.crowd.length + joined.size + there.length, faces: [...joined.values()].map(d => d.thumb).concat(there.map(pr => pr.thumb), o.crowd.map(c => c.thumb)).filter(Boolean), friends: [...joined.values()].map(d => d.name) };
    },
    dispose() {
      api.leave(); clearInterval(beat); clearInterval(pulse); timers.forEach(clearTimeout); post({ t: 'bye' }); if (bc) bc.close(); if (chan) try { chan.sb.removeChannel(chan.ch); } catch (e) {}
      window.removeEventListener('pagehide', onHide); window.removeEventListener('keydown', onEsc); window.removeEventListener('keydown', onGameKey); window.removeEventListener('keyup', onGameKeyUp); clearInterval(barsTimer); clearInterval(nearCheck);
      nook.setWorldTick(null); world.dispose(); hud.remove(); invWrap.remove(); notes.remove();
    }
  };
  // Handy in the browser console: nookWorld.play('boxing') or nookWorld.play('dance') starts a match with a simulated player
  // (join the island first). Not used by the app itself.
  window.nookWorld = { world, games, useBackend: fn => { o.backend = fn; syncNet(); }, play: (game, id) => startMatch({ game: game || 'boxing', oppId: id || o.crowd[0].id, role: 0 }) };
  return api;
}
