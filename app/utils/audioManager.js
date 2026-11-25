/**
 * 《漫剧大导演》音效与震动反馈管理器 (F-MP-07)
 * 采用零体积合成器 + 微信小程序 vibrateShort 震动反馈，保证包体 < 1.8MB (NFR-01)
 */

const MUTE_KEY = 'Duanju-Audio-Muted';

class AudioManager {
  constructor() {
    this.muted = Boolean(uni.getStorageSync(MUTE_KEY));
    this.ctx = null;
  }

  isMuted() {
    return this.muted;
  }

  toggleMute() {
    this.muted = !this.muted;
    uni.setStorageSync(MUTE_KEY, this.muted);
    if (!this.muted) {
      this.playPop();
    }
    return this.muted;
  }

  _getCtx() {
    if (this.muted) return null;
    try {
      const AudioCtx = (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
                       (typeof uni !== 'undefined' && uni.createWebAudioContext && uni.createWebAudioContext);
      if (!this.ctx && AudioCtx) {
        this.ctx = typeof uni !== 'undefined' && uni.createWebAudioContext ? uni.createWebAudioContext() : new AudioCtx();
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      return this.ctx;
    } catch (e) {
      return null;
    }
  }

  vibrate() {
    try {
      if (typeof uni !== 'undefined' && uni.vibrateShort) {
        uni.vibrateShort({ type: 'light' });
      }
    } catch (e) {}
  }

  // 波普按钮点击音效
  playPop() {
    this.vibrate();
    const ctx = this._getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(520, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(780, ctx.currentTime + 0.07);
      gain.gain.setValueAtTime(0.16, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.08);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.08);
    } catch (e) {}
  }

  // 场记板打板音效 ("咔哒")
  playClap() {
    this.vibrate();
    const ctx = this._getCtx();
    if (!ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(300, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(110, ctx.currentTime + 0.09);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.09);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.09);
    } catch (e) {}
  }

  // 解锁新图鉴 / 杀青高分欢呼音效
  playFanfare() {
    this.vibrate();
    const ctx = this._getCtx();
    if (!ctx) return;
    try {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        const t = ctx.currentTime + i * 0.08;
        osc.frequency.setValueAtTime(freq, t);
        gain.gain.setValueAtTime(0.15, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.16);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(t);
        osc.stop(t + 0.16);
      });
    } catch (e) {}
  }
}

export default new AudioManager();
