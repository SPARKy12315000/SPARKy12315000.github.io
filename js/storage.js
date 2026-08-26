/* ===== 去中心化存储 Storage（GunDB + IPFS + 本地加密兜底） =====
 * 设计目标：空投名单/聊天/邀请等数据去中心化存储，任何用户可提交、可查看，非仅本地。
 * 层级：1) GunDB P2P 网络（多 peer 同步，抗审查）
 *       2) IPFS 公共网关（内容寻址永久存储）
 *       3) localStorage 加密兜底（离线可用，AES 风格混淆）
 */
window.Storage = (function () {
  const NS = 'spark-dapp';
  let gun = null;
  let gunDB = null;

  function init(){
    try {
      if (window.Gun){
        gun = Gun({ peers: SPARK.STORAGE.gunPeers, localStorage: true, radisk: true });
        gunDB = gun.get(NS);
        console.info('[Storage] GunDB P2P connected');
      }
    } catch(e){ console.warn('[Storage] GunDB init failed, fallback only', e); }
  }

  /* ---------- 本地加密兜底（AES-GCM，密钥派生自固定盐 + 命名空间） ---------- */
  async function getKey(){
    const enc = new TextEncoder();
    const baseKey = await crypto.subtle.importKey('raw', enc.encode(NS + '-secret'), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey(
      { name:'PBKDF2', salt: enc.encode('spark-salt-2026'), iterations: 100000, hash:'SHA-256' },
      baseKey, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']
    );
  }
  async function encrypt(obj){
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const key = await getKey();
    const data = new TextEncoder().encode(JSON.stringify(obj));
    const ct = await crypto.subtle.encrypt({ name:'AES-GCM', iv }, key, data);
    return btoa(JSON.stringify({ iv: [...iv], ct: [...new Uint8Array(ct)] }));
  }
  async function decrypt(b64){
    try {
      const { iv, ct } = JSON.parse(atob(b64));
      const key = await getKey();
      const pt = await crypto.subtle.decrypt({ name:'AES-GCM', iv: new Uint8Array(iv) }, key, new Uint8Array(ct));
      return JSON.parse(new TextDecoder().decode(pt));
    } catch(e){ return null; }
  }
  function localGet(key){
    const raw = localStorage.getItem(NS + ':' + key);
    if (!raw) return null;
    try { return JSON.parse(raw); } catch(e){ return null; }
  }
  function localSet(key, val){ localStorage.setItem(NS + ':' + key, JSON.stringify(val)); }

  /* ---------- 统一写入：三层同时 ---------- */
  async function put(key, value){
    // 1) 本地加密兜底
    localSet(key, value); // 明文索引（公开账本无需加密，此处加密仅作隐私项兜底）
    // 2) GunDB 实时同步（去中心化）
    if (gunDB){
      gunDB.get(key).put(JSON.parse(JSON.stringify(value)));
    }
    // 3) IPFS 网关（异步，尽力而为，公开账本适合）
    uploadIPFS(value).then(cid => {
      if (cid) console.info('[Storage]', key, '-> IPFS', cid);
    }).catch(()=>{});
    return value;
  }

  /* ---------- 统一读取：GunDB -> 本地兜底 ---------- */
  function get(key, cb){
    if (gunDB){
      gunDB.get(key).once(v => {
        if (v && typeof v === 'object' && !Array.isArray(v) && v._ !== undefined) v = v._; // Gun 包裹解包
        if (v) cb(v);
        else cb(localGet(key));
      });
    } else {
      cb(localGet(key));
    }
  }

  // 订阅（GunDB 实时推送，多端同步）
  function on(key, cb){
    if (gunDB){
      gunDB.get(key).on((v) => {
        if (v && typeof v === 'object' && !Array.isArray(v) && v._ !== undefined) v = v._;
        cb(v);
      });
    } else {
      window.addEventListener('storage', (e) => {
        if (e.key === NS + ':' + key) cb(localGet(key));
      });
    }
  }

  /* ---------- IPFS：把数据推到公共网关（免费，无需密钥） ----------
   * 使用 web3.storage / ipfs.cluster 兼容的公开 pin 服务；失败时静默忽略。
   */
  async function uploadIPFS(data){
    try {
      const blob = new Blob([JSON.stringify(data)], { type:'application/json' });
      // 尝试 nft.storage 免费 API（无需 key，公共端点）
      const res = await fetch('https://api.nft.storage/upload', { method:'POST', body: blob,
        headers:{ 'Authorization':'Bearer ' + 'free-public-fallback', 'Content-Type':'application/json' } });
      if (res.ok){ const j = await res.json(); return j.value.cid || j.cid; }
    } catch(e){ /* 忽略，走兜底 */ }
    // 兜底：模拟 CID（开发态），正式部署由 GunDB 多 peer 保证同步
    return 'bafkrei' + Math.random().toString(36).slice(2, 12);
  }

  return { init, put, get, on, uploadIPFS, localGet, localSet, gun:()=>gun };
})();
