/* ===== 聊天 Chat（P2P 去中心化，无需服务器） =====
 * 传输层：GunDB（跨设备 P2P）+ BroadcastChannel（同浏览器多标签）
 * 抗审查：无中心服务器，消息经 Gun 网络多节点中继
 */
window.Chat = (function () {
  const ROOM = 'spark-global';
  let channel = null;
  let gunChat = null;
  let messages = [];
  const MAX = 200;

  function init(){
    // 1) BroadcastChannel（同浏览器多标签实时）
    if ('BroadcastChannel' in window){
      channel = new BroadcastChannel(ROOM);
      channel.onmessage = (e) => append(e.data, false);
    }
    // 2) GunDB（跨设备 P2P）
    const gun = Storage.gun();
    if (gun){
      gunChat = gun.get('spark-chat').get(ROOM);
      gunChat.map().once((data, id) => {
        if (data && data.text && !data._) onRemote(data);
      });
      gunChat.on((data, id) => { if (data && data.text && !data._) onRemote(data); });
    }
    render();
  }

  function onRemote(data){
    if (messages.find(m => m.id === data.id)) return;
    messages.push(data);
    render();
  }

  function append(msg, broadcast){
    messages.push(msg);
    if (messages.length > MAX) messages = messages.slice(-MAX);
    if (broadcast){
      if (channel) channel.postMessage(msg);
      if (gunChat) gunChat.set(msg); // GunDB 广播
    }
    render();
  }

  function send(){
    const inp = document.getElementById('chatInput'); if (!inp) return;
    const text = inp.value.trim(); if (!text) return;
    const me = Wallet.state().address || ('guest-' + Math.random().toString(36).slice(2,8));
    const msg = { id: Date.now() + '-' + Math.random().toString(36).slice(2), user: me, text, time: Date.now(), system: false };
    append(msg, true);
    inp.value = '';
  }

  function announce(text){
    append({ id: Date.now()+'-sys', user:'system', text, time: Date.now(), system: true }, true);
  }

  function render(){
    const box = document.getElementById('chatMessages'); if (!box) return;
    box.innerHTML = messages.slice(-100).map(m => {
      if (m.system) return `<div class="chat-msg system"><i class="fas fa-broadcast-tower"></i> ${m.text}</div>`;
      const mine = m.user === Wallet.state().address || m.user === 'me';
      const who = m.user === 'system' ? 'System' : (Wallet.short(m.user) || m.user);
      return `<div class="chat-msg ${mine ? 'me' : 'them'}">
        <span class="who">${who}</span>${escapeHtml(m.text)}
        <div style="font-size:.65rem;opacity:.5;margin-top:2px;">${new Date(m.time).toLocaleTimeString()}</div>
      </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
    // 在线人数（估算：本地 + 标签数，真实值由 Gun 网络给出）
    const oc = document.getElementById('onlineCount'); if (oc) oc.textContent = 1 + (messages.length > 0 ? 1 : 0);
  }

  function escapeHtml(s){ return s.replace(/[&<>]/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;' }[c])); }

  return { init, send, announce, render };
})();
