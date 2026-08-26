/**
 * 短视频模块 v2.2.0 —— 看视频赚 SPARK（钱包登录后奖励）
 * 自动收录思路：元数据存 IPFS（公有领域/CC0，规避版权），播放计奖励
 */
import { CONFIG } from './config.js';

export class VideoRewards {
  constructor(wallet) { this.wallet = wallet; this.rewardPerSecond = 0.1; }

  /** 完整观看后才发奖，时长不足拒绝（防刷） */
  async claimReward({ videoId, watchedSeconds, requiredSeconds = 30 }) {
    if (!this.wallet?.connected) throw new Error('请先连接钱包');
    if (watchedSeconds < requiredSeconds) {
      throw new Error(`观看时长不足：需 ${requiredSeconds}s，当前 ${watchedSeconds}s`);
    }
    const amount = +(watchedSeconds * this.rewardPerSecond).toFixed(4);
    return {
      ok: true, videoId, amount, symbol: CONFIG.contract.symbol,
      message: `奖励 ${amount} ${CONFIG.contract.symbol}`,
    };
  }
}

export default VideoRewards;
