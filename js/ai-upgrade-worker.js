/**
 * SPARK AI 自升级引擎 - 浏览器原生版（无模块、无 export，直接 <script> 加载）
 * 挂载到 window.SPARK
 */
(function (global) {
  'use strict';

  var REPO_OWNER = 'SPARKy12315000';
  var REPO_NAME = 'SPARKy12315000.github.io';
  var BRANCH = 'main';
  var API = 'https://api.github.com';

  function getPAT() {
    try { return localStorage.getItem('spark_github_pat') || ''; } catch (e) { return ''; }
  }

  // ============ 日志 ============
  function log(msg, type) {
    type = type || 'info';
    console.log('[SPARK][AI] ' + msg);
    try {
      var CustomEv = (typeof CustomEvent !== 'undefined') ? CustomEvent : null;
      if (CustomEv) document.dispatchEvent(new CustomEv('spark:log', { detail: { msg: msg, type: type, time: Date.now() } }));
    } catch (e) {}
  }

  // ============ 弹窗 ============
  function notify(title, html, onConfirm) {
    var overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:999999;display:flex;align-items:center;justify-content:center;font-family:sans-serif;';
    overlay.innerHTML =
      '<div style="background:#111;border:1px solid #d4a017;border-radius:12px;max-width:560px;width:90%;padding:24px;color:#fff;">' +
        '<h3 style="color:#d4a017;margin:0 0 12px;">🤖 ' + title + '</h3>' +
        '<div style="font-size:14px;line-height:1.7;max-height:50vh;overflow:auto;">' + html + '</div>' +
        '<div style="margin-top:18px;text-align:right;">' +
          '<button id="sp-cancel" style="background:#444;color:#fff;border:none;padding:8px 16px;border-radius:6px;margin-right:8px;cursor:pointer;">取消</button>' +
          '<button id="sp-ok" style="background:#d4a017;color:#000;border:none;padding:8px 18px;border-radius:6px;cursor:pointer;">✅ 管理员确认升级</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);
    overlay.querySelector('#sp-cancel').onclick = function () { overlay.remove(); };
    var okBtn = overlay.querySelector('#sp-ok');
    okBtn.onclick = function () {
      overlay.remove();
      if (typeof onConfirm === 'function') onConfirm();
    };
    // （确认按钮已就绪，等待用户点击；生产环境由管理员手动确认）
  }

  // ============ AI 提案生成（规则引擎模拟 LLM）============
  function analyze(code, issue) {
    var problems = [];
    var suggestions = [];
    if (!code || code.length < 10) { problems.push('代码体为空或过小'); }
    if ((code || '').indexOf('TODO') >= 0) { problems.push('存在 TODO 占位'); suggestions.push('替换 TODO 为完整实现'); }
    if ((code || '').indexOf('console.log') >= 0) { problems.push('含调试 console.log'); suggestions.push('移除或降级为日志系统'); }
    if ((code || '').indexOf('eval(') >= 0) { problems.push('存在 eval 安全风险'); suggestions.push('移除 eval 改用安全解析'); }
    if (issue && issue.length > 0) { problems.push('手动输入问题：' + issue); suggestions.push('针对问题定位代码区域并重构'); }
    if (problems.length === 0) { problems.push('例行健康检查'); suggestions.push('优化注释与可读性'); }
    return {
      version: 'v' + (Math.random() * 9 + 1).toFixed(1),
      problems: problems,
      suggestions: suggestions,
      risk: problems.length > 2 ? 'high' : (problems.length > 0 ? 'medium' : 'low'),
      changes: suggestions.map(function (s, i) { return '- ' + (i + 1) + '. ' + s; }).join('\n'),
      rollback: 'git revert 自动备份 commit'
    };
  }

  // ============ 生成补丁 ============
  function generatePatch(proposal, targetFile) {
    targetFile = targetFile || 'js/ai-upgrade-worker.js';
    var stamp = new Date().toISOString();
    var comment =
      '/*\n * 🤖 AI Auto-Upgrade ' + proposal.version + '  (' + stamp + ')\n' +
      ' * Problems: ' + proposal.problems.join('; ') + '\n' +
      ' * ' + proposal.changes.replace(/\n/g, '\n * ') + '\n */\n';
    return { file: targetFile, comment: comment, message: '🤖 AI Auto-Upgrade ' + proposal.version };
  }

  // ============ GitHub API ============
  function githubRequest(path, method, body) {
    var pat = getPAT();
    var headers = { 'Accept': 'application/vnd.github+json', 'Content-Type': 'application/json' };
    if (pat) headers['Authorization'] = 'Bearer ' + pat;
    return fetch(API + path, { method: method || 'GET', headers: headers, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json(); });
  }

  function getRemoteHash() {
    return githubRequest('/repos/' + REPO_OWNER + '/' + REPO_NAME + '/commits?per_page=1')
      .then(function (j) { return (j && j[0] && j[0].sha) || ''; });
  }

  function commitToGitHub(patch, contentBase64) {
    var path = '/' + patch.file;
    return githubRequest('/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents' + path + '?ref=' + BRANCH)
      .then(function (fileInfo) {
        var sha = fileInfo && fileInfo.sha;
        if (!sha) throw new Error('无法获取文件 sha，可能文件不存在或无权限');
        return githubRequest('/repos/' + REPO_OWNER + '/' + REPO_NAME + '/contents' + path, 'PUT', {
          message: patch.message,
          content: contentBase64,
          sha: sha,
          branch: BRANCH
        });
      });
  }

  // ============ 检测主流程 ============
  function runCheck(issueText) {
    log('开始代码扫描...' + (issueText ? ' (手动输入: ' + issueText + ')' : ''));
    var localCode = '';
    try { localCode = (window.SPARK_RAW_CODE || '') + ''; } catch (e) {}
    var proposal = analyze(localCode, issueText || '');

    getRemoteHash().then(function (hash) {
      log('远端最新 commit: ' + (hash || '无').substring(0, 8));
      var html =
        '<b>🔍 问题诊断：</b><br>' + proposal.problems.map(function (p) { return '• ' + p; }).join('<br>') +
        '<br><br><b>💡 AI 建议：</b><br>' + proposal.suggestions.map(function (s) { return '• ' + s; }).join('<br>') +
        '<br><br><b>⚠️ 风险等级：</b> ' + proposal.risk +
        '<br><br><b>📦 变更：</b><pre style="white-space:pre-wrap;">' + proposal.changes + '</pre>' +
        '<br><b>🔙 回滚：</b> ' + proposal.rollback +
        '<br><br><b>🔑 PAT 已配置：</b> ' + (getPAT() ? '是' : '否（自动提交将被跳过）');

      notify('升级提案 ' + proposal.version, html, function () {
        log('管理员已确认升级 ' + proposal.version);
        var patch = generatePatch(proposal, 'js/ai-upgrade-worker.js');
        var full = patch.comment + '\n' + (localCode || '/* SPARK AI upgraded */\n');
        var b64 = btoa(unescape(encodeURIComponent(full)));
        commitToGitHub(patch, b64).then(function (res) {
          log('✅ 已自动提交到仓库: ' + ((res && res.commit && res.commit.html_url) || ''), 'success');
        }).catch(function (err) {
          log('⚠️ 自动提交失败（可能未配置有效 PAT）: ' + (err && err.message), 'error');
        });
      });
    }).catch(function (err) {
      log('远端检测失败: ' + (err && err.message), 'error');
    });
  }

  // ============ 全局 API ============
  var SPARK = {
    scanNow: function () { runCheck(''); return '扫描已启动'; },
    manualCheck: function (text) {
      var t = (text || '').trim();
      if (!t) {
        var user = prompt('请输入要检测的代码问题 / Bug 描述 / 代码片段：');
        if (!user) return '已取消';
        t = user;
      }
      runCheck(t);
      return '手动检测已启动';
    },
    setPAT: function (token) {
      var t = (token || '').trim();
      if (!t) {
        t = prompt('请输入 GitHub Personal Access Token（需 repo 权限）：');
        if (!t) return '已取消';
      }
      localStorage.setItem('spark_github_pat', t);
      log('PAT 已保存（本地）', 'success');
      return 'PAT 已配置';
    },
    patStatus: function () { return getPAT() ? '已配置' : '未配置'; },
    runUpgrade: function () { runCheck(''); }
  };

  global.SPARK = SPARK;

  // 桥接到可能存在的旧调用名（兼容）
  global.SPARK_AI = SPARK;
  try {
    global.SPARK_UpgradeEngine = { scanNow: SPARK.scanNow, runManualCheck: SPARK.manualCheck, setPAT: SPARK.setPAT };
  } catch (e) {}

  // 自动启动
  function init() {
    log('🤖 SPARK AI 自升级引擎已就绪（浏览器原生版）', 'success');
    if (typeof setInterval === 'function') {
      setInterval(function () { runCheck(''); }, 5 * 60 * 1000);
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
