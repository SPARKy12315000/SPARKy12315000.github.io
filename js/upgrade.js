/* ===== AI 自动升级 Upgrade（弹窗提示 + 管理员手动确认） =====
 * 流程：AI 学习积累 -> 生成升级候选 -> 弹窗展示 diff -> 管理员确认后才"应用"
 * 安全性：密码以 SHA-256 哈希存储校验，代码内不出镜明文；未确认绝不改动。
 */
window.Upgrade = (function () {
  let candidate = null;
  let timer = null;

  function init(){
    if (!SPARK.UPGRADE.autoLearn) return;
    timer = setInterval(() => { if (Admin.isLoggedIn()) check(); }, SPARK.UPGRADE.checkIntervalMs);
  }

  // 检测升级候选（管理员登录后才弹窗）
  function check(){
    const c = Learn.generateCandidate();
    if (!c || c.bufferSize === 0) return;
    if (candidate && candidate.id === c.id) return; // 已处理过
    candidate = c;
    show(c);
  }

  function show(c){
    document.getElementById('upgradeDiff').textContent =
      `${c.title}\n\n` + c.changes.map(ch => `📄 ${ch.file}\n- ${ch.before}\n+ ${ch.after}`).join('\n\n');
    document.getElementById('upgradeModal').classList.add('show');
  }

  function confirm(){
    if (!Admin.isLoggedIn()){ App.toast(I18n.t('not_login'), 'error'); return; }
    // 管理员确认：此处仅演示"应用"逻辑（真实场景写入版本日志 + 触发 CI/CD 重新部署）
    const log = {
      id: candidate.id, approvedAt: Date.now(), by: Wallet.state().address || 'admin',
      candidate, status:'applied'
    };
    Storage.put('upgrade-log', log);
    App.toast('✅ ' + (I18n.cur==='zh'?'升级已确认，将在下次部署生效':'Upgrade approved, takes effect on next deploy'), 'success');
    candidate = null;
    close();
    // 触发实际代码更新：动态注入新规则到 AI（运行时热更新演示）
    hotApply(log.candidate);
  }

  function reject(){
    if (candidate){ Storage.put('upgrade-rejected', { id:candidate.id, at:Date.now() }); }
    App.toast(I18n.cur==='zh'?'已拒绝该次升级':'Upgrade rejected', 'success');
    candidate = null;
    close();
  }

  function close(){ document.getElementById('upgradeModal').classList.remove('show'); }

  // 运行时热更新：把学习到的高频问答动态加入 AI 知识库（演示）
  function hotApply(c){
    // 向 AI.KB 追加一条基于高频词的兜底规则（真实场景会更严谨）
    if (window.AI && c.changes){
      // 仅标记，下次 AI.reply 时 KB 自动包含（此处简化为触发重新渲染）
      console.info('[Upgrade] applied:', c.title);
    }
  }

  return { init, check, confirm, reject, close };
})();
