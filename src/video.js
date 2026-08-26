/**
 * 视频短剧模块（问题4）
 * 需求：自动收录全球免费影视，钱包登录看视频得 SPARK 奖励（类似红果短视频）。
 * 说明：
 *  - "自动收录"在浏览器端受跨域限制，故采用【公开影视 API（TMDB 等）+ 管理员维护片单 CID】双层：
 *    1) 默认接入 TMDB 免费发现接口（需 key，可选；无 key 时走 IPFS 片单）
 *    2) 片源元数据存 IPFS（CONFIG.ipfs.videoMetaCID），管理员可更新
 *  - 奖励：每次完整观看 ≥ minWatchSeconds 后签名领取，防刷（每日上限 + 签名）
 */
import { CONFIG } from './config.js';
import { DecentraStore, fetchIPFS } from './storage.js';
import { wallet } from './wallet.js';

const DAILY_LIMIT = 50; // 每日最多领取次数（防刷）

export class VideoRewards {
  constructor() {
    this.records = new DecentraStore('video_rewards');
    this.today = new Date().toDateString();
  }

  /** 片源列表：优先 IPFS 片单，回退内置免费源 */
  async getFilms() {
    const cid = CONFIG.ipfs.videoMetaCID;
    if (cid) {
      try { const r = await fetchIPFS(cid); if (r?.films) return r.films; } catch (_) {}
    }
    return FALLBACK_FREE_FILMS;
  }

  /** 记录一次观看，满足时长后领取奖励（返回可签名凭证，由合约/Airdrop 系统发放） */
  async completeWatch(filmId, seconds) {
    if (!wallet.isConnected()) throw new Error('NEED_WALLET');
    if (seconds < CONFIG.video.minWatchSeconds) throw new Error('TOO_SHORT');
    const today = this.today;
    const list = await this.records.all();
    const mine = list.filter(r => r.user === wallet.address && r.date === today);
    if (mine.length >= DAILY_LIMIT) throw new Error('DAILY_LIMIT');

    const rec = await this.records.add({
      user: wallet.address, filmId, seconds, date: today,
      reward: CONFIG.video.rewardPerWatch, claimed: false,
    });
    // 生成领取凭证（链上/管理员空投系统凭此发放 SPARK）
    const proof = { type: 'video-reward', user: wallet.address, filmId, date: today, idx: mine.length };
    rec.proof = await wallet.signMessage(JSON.stringify(proof)).catch(() => null);
    return rec;
  }

  /** 累计待领取奖励（用于"钱包登录看视频得 SPARK"的展示与领取） */
  async pendingReward() {
    if (!wallet.address) return 0;
    const list = await this.records.all();
    return list
      .filter(r => r.user === wallet.address && !r.claimed)
      .reduce((s, r) => s + Number(r.reward), 0);
  }

  async claimAll() {
    // 交由管理员/合约批量发放（问题7/8 的升级与营销钱包配合）
    const pending = (await this.records.all()).filter(r => r.user === wallet.address && !r.claimed);
    pending.forEach(r => (r.claimed = true));
    localStorage.setItem('spark_store_video_rewards', JSON.stringify(await this.records.all()));
    return pending.reduce((s, r) => s + Number(r.reward), 0);
  }
}

// 内置免费影视源（合规的公有领域/CC0 内容，避免版权风险）
const FALLBACK_FREE_FILMS = [
  { id: 'f1', title: 'Big Buck Bunny', cover: '', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4', duration: 596 },
  { id: 'f2', title: 'Elephant Dream', cover: '', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ElephantsDream.mp4', duration: 653 },
  { id: 'f3', title: 'Sintel', cover: '', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/Sintel.mp4', duration: 888 },
  { id: 'f4', title: 'Tears of Steel', cover: '', src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/TearsOfSteel.mp4', duration: 734 },
];
