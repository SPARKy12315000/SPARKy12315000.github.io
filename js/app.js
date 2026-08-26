/* ===== 启动器 App ===== */
window.App = (function () {
  function init(){
    I18n.init();
    Storage.init();
    Airdrop.init();
    Chat.init();
    Market.init();      // 行情（自动拉取）
    Shop.render();
    AI.suggestions();
    Learn.init();
    Upgrade.init();
    Wallet.render();

    // 默认显示首页；若有 ?ref= 则进空投页
    const ref = new URLSearchParams(location.search).get('ref');
    App.show(ref ? 'airdrop' : 'home');

    // 自动检测 AI 升级（管理员已登录时）
    setInterval(() => { if (Admin.isLoggedIn()) Upgrade.check(); }, 60000);
  }

  function show(sec){
    document.querySelectorAll('.section-content').forEach(el => el.classList.remove('active'));
    const el = document.getElementById(sec); if (el) el.classList.add('active');
    document.querySelectorAll('.nav-link[data-sec]').forEach(l => l.classList.toggle('active', l.dataset.sec === sec));
    // 切页时刷新对应模块
    if (sec==='market') Market.fetchTop();
    if (sec==='chat') Chat.render();
    if (sec==='airdrop') Airdrop.render();
    history.replaceState(null, '', '#' + sec);
  }

  function toast(msg, type){
    let div = document.getElementById('appToast');
    if (!div){
      div = document.createElement('div');
      div.id = 'appToast'; div.style.cssText = 'position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 22px;border-radius:10px;font-size:.95rem;max-width:90%;text-align:center;box-shadow:0 6px 20px rgba(0,0,0,.4);transition:.3s;';
      document.body.appendChild(div);
    }
    const colors = { success:'rgba(76,175,80,.95)', error:'rgba(244,67,54,.95)', info:'rgba(79,195,247,.95)' };
    div.style.background = colors[type] || colors.info; div.style.color = '#fff';
    div.textContent = msg; div.style.opacity = '1';
    clearTimeout(div._t); div._t = setTimeout(() => { div.style.opacity='0'; }, 4000);
  }

  async function copy(text){
    try {
      await navigator.clipboard.writeText(text); toast(I18n.t('copy_ok'), 'success');
    } catch(e){ toast(I18n.t('copy_fail'), 'error'); }
  }

  function downloadAPK(){
    // 优先 GitHub Releases（自动化构建产物），降级为本地 android/app-release.apk
    const urls = [
      'https://github.com/SPARKy12315000/SPARKy12315000.github.io/releases/latest/download/app-release.apk',
      'android/app-release.apk'
    ];
    window.open(urls[0], '_blank');
    toast(I18n.cur==='zh' ? '正在跳转 APK 下载（若未构建完成，请稍后到 Releases 页查看）' : 'Redirecting to APK...', 'info');
  }

  return { init, show, toast, copy, downloadAPK };
})();

// 启动
document.addEventListener('DOMContentLoaded', App.init);

/* ===== 管理员密码哈希生成（一次性工具，部署前本地运行，不打包） =====
 * 用法：在浏览器控制台执行  Wallet.generateAdminHash('<管理员密码>').then(console.log)
 * 把输出的哈希填入 js/config.js 的 SPARK.ADMIN.passwordHash，即可实现「密码代码隐藏」。
 * 代码中永不出现明文密码。
 */
