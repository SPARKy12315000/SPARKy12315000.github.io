/**
 * SPARK 多语言资源 v2.2.0
 * 支持：简体中文(zh-CN)、繁体中文(zh-TW)、English(en)、日本語(ja)、한국어(ko)
 *
 * 设计原则：
 *   - 所有用户可见文案集中于此，UI 层只通过 data-i18n="key" 绑定
 *   - 新增语言只需追加一个 locale 对象，无需改业务代码
 *   - 占位符用 {0} {1}，避免拼接破坏语序
 */
export const locales = {
  'zh-CN': {
    name: '简体中文',
    flag: '🇨🇳',
    strings: {
      'app.title': '星火通证 SPARK',
      'nav.home': '首页',
      'nav.airdrop': '空投',
      'nav.market': '行情',
      'nav.shop': '商城',
      'nav.chat': '聊天',
      'nav.video': '短视频',
      'nav.ai': 'AI',
      'nav.admin': '管理',
      'hero.slogan': '星火流转，价值共生',
      'hero.desc': '基于以太坊的创新型营销回流代币，构建透明、公平、可持续的社区价值生态。',
      'hero.claim': '前往领取空投',
      'hero.login': '登录',
      'hero.download': '下载 SPARK DApp',
      'economy.title': '经济模型（税率）',
      'economy.buy': '买入税',
      'economy.sell': '卖出税',
      'economy.transfer': '转账税',
      'economy.auto': '自动回流',
      'ipfs.title': 'IPFS 永久图片',
      'ipfs.logo': 'Logo 头像',
      'ipfs.bg': '背景图片',
      'airdrop.title': '空投中心',
      'airdrop.claim': '领取空投',
      'airdrop.balance': '空投余额',
      'chat.title': '去中心化聊天',
      'chat.send': '发送',
      'chat.placeholder': '输入消息…',
      'market.title': '实时行情',
      'shop.title': '去中心化商城',
      'shop.publish': '上架商品',
      'video.title': '短视频（看视频赚 SPARK）',
      'video.watch': '开始观看',
      'ai.title': 'AI 自检升级',
      'ai.scan': '开始扫描',
      'ai.upgrade': '升级需要管理员权限手动开启',
      'admin.title': '管理面板',
      'admin.login': '管理员登录',
      'admin.password': '密码',
      'admin.marketing': '营销钱包',
      'admin.balanceLimit': '余额限制（余额不足禁止超额交易）',
      'wallet.connect': '连接钱包',
      'wallet.connected': '已连接',
      'footer.copy': '© 2026 星火通证(SPARK)项目',
      'footer.email': '邮箱',
      'lang.switch': '语言',
      'common.confirm': '确认',
      'common.cancel': '取消',
      'common.loading': '加载中…',
      'common.error': '出错了',
    },
  },

  'zh-TW': {
    name: '繁體中文', flag: '🇹🇼',
    strings: {
      'app.title': '星火通證 SPARK',
      'nav.home': '首頁', 'nav.airdrop': '空投', 'nav.market': '行情',
      'nav.shop': '商城', 'nav.chat': '聊天', 'nav.video': '短影音',
      'nav.ai': 'AI', 'nav.admin': '管理',
      'hero.slogan': '星火流轉，價值共生',
      'hero.desc': '基於以太坊的創新型行銷回流代幣，構建透明、公平、永續的社區價值生態。',
      'hero.claim': '前往領取空投', 'hero.login': '登入', 'hero.download': '下載 SPARK DApp',
      'economy.title': '經濟模型（稅率）', 'economy.buy': '買入稅', 'economy.sell': '賣出稅',
      'economy.transfer': '轉帳稅', 'economy.auto': '自動回流',
      'ipfs.title': 'IPFS 永久圖片', 'ipfs.logo': 'Logo 頭像', 'ipfs.bg': '背景圖片',
      'airdrop.title': '空投中心', 'airdrop.claim': '領取空投', 'airdrop.balance': '空投餘額',
      'chat.title': '去中心化聊天', 'chat.send': '傳送', 'chat.placeholder': '輸入訊息…',
      'market.title': '即時行情', 'shop.title': '去中心化商城', 'shop.publish': '上架商品',
      'video.title': '短影音（看影片賺 SPARK）', 'video.watch': '開始觀看',
      'ai.title': 'AI 自檢升級', 'ai.scan': '開始掃描', 'ai.upgrade': '升級需管理員權限手動開啟',
      'admin.title': '管理面板', 'admin.login': '管理員登入', 'admin.password': '密碼',
      'admin.marketing': '行銷錢包', 'admin.balanceLimit': '餘額限制（餘額不足禁止超額交易）',
      'wallet.connect': '連接錢包', 'wallet.connected': '已連接',
      'footer.copy': '© 2026 星火通證(SPARK)項目', 'footer.email': '信箱',
      'lang.switch': '語言',
      'common.confirm': '確認', 'common.cancel': '取消', 'common.loading': '載入中…', 'common.error': '出錯了',
    },
  },

  'en': {
    name: 'English', flag: '🇬🇧',
    strings: {
      'app.title': 'SPARK Token',
      'nav.home': 'Home', 'nav.airdrop': 'Airdrop', 'nav.market': 'Market',
      'nav.shop': 'Shop', 'nav.chat': 'Chat', 'nav.video': 'Video',
      'nav.ai': 'AI', 'nav.admin': 'Admin',
      'hero.slogan': 'Sparks Flow, Value Coexists',
      'hero.desc': 'An innovative marketing-reflection token on Ethereum, building a transparent, fair and sustainable community value ecosystem.',
      'hero.claim': 'Claim Airdrop', 'hero.login': 'Login', 'hero.download': 'Download SPARK DApp',
      'economy.title': 'Tokenomics (Tax)', 'economy.buy': 'Buy Tax', 'economy.sell': 'Sell Tax',
      'economy.transfer': 'Transfer Tax', 'economy.auto': 'Auto Reflection',
      'ipfs.title': 'IPFS Permanent Images', 'ipfs.logo': 'Logo Avatar', 'ipfs.bg': 'Background',
      'airdrop.title': 'Airdrop Center', 'airdrop.claim': 'Claim', 'airdrop.balance': 'Airdrop Balance',
      'chat.title': 'Decentralized Chat', 'chat.send': 'Send', 'chat.placeholder': 'Type a message…',
      'market.title': 'Live Market', 'shop.title': 'Decentralized Shop', 'shop.publish': 'List Item',
      'video.title': 'Short Video (Watch to Earn SPARK)', 'video.watch': 'Start Watching',
      'ai.title': 'AI Self-Check Upgrade', 'ai.scan': 'Start Scan', 'ai.upgrade': 'Upgrade requires admin manual approval',
      'admin.title': 'Admin Panel', 'admin.login': 'Admin Login', 'admin.password': 'Password',
      'admin.marketing': 'Marketing Wallet', 'admin.balanceLimit': 'Balance Limit (no over-spending)',
      'wallet.connect': 'Connect Wallet', 'wallet.connected': 'Connected',
      'footer.copy': '© 2026 SPARK Token Project', 'footer.email': 'Email',
      'lang.switch': 'Language',
      'common.confirm': 'Confirm', 'common.cancel': 'Cancel', 'common.loading': 'Loading…', 'common.error': 'Error',
    },
  },

  'ja': {
    name: '日本語', flag: '🇯🇵',
    strings: {
      'app.title': 'SPARK トークン',
      'nav.home': 'ホーム', 'nav.airdrop': 'エアドロップ', 'nav.market': 'マーケット',
      'nav.shop': 'ショップ', 'nav.chat': 'チャット', 'nav.video': '動画',
      'nav.ai': 'AI', 'nav.admin': '管理',
      'hero.slogan': '星火流転、価値共生',
      'hero.desc': 'イーサリアム上の革新的なマーケティング・リフレクション・トークン。透明で公正、持続可能なコミュニティ価値エコシステムを構築します。',
      'hero.claim': 'エアドロップを受け取る', 'hero.login': 'ログイン', 'hero.download': 'SPARK DApp をダウンロード',
      'economy.title': 'トークノミクス（税率）', 'economy.buy': '購入税', 'economy.sell': '売却税',
      'economy.transfer': '送金税', 'economy.auto': '自動リフレクション',
      'ipfs.title': 'IPFS 永続画像', 'ipfs.logo': 'ロゴアバター', 'ipfs.bg': '背景画像',
      'airdrop.title': 'エアドロップセンター', 'airdrop.claim': '受け取る', 'airdrop.balance': 'エアドロップ残高',
      'chat.title': '分散型チャット', 'chat.send': '送信', 'chat.placeholder': 'メッセージを入力…',
      'market.title': 'リアルタイム相場', 'shop.title': '分散型ショップ', 'shop.publish': '出品',
      'video.title': 'ショート動画（視聴で SPARK 獲得）', 'video.watch': '視聴開始',
      'ai.title': 'AI 自己診断アップグレード', 'ai.scan': 'スキャン開始', 'ai.upgrade': 'アップグレードは管理者の手動承認が必要',
      'admin.title': '管理パネル', 'admin.login': '管理者ログイン', 'admin.password': 'パスワード',
      'admin.marketing': 'マーケティングウォレット', 'admin.balanceLimit': '残高制限（残高超過取引を禁止）',
      'wallet.connect': 'ウォレット接続', 'wallet.connected': '接続済み',
      'footer.copy': '© 2026 SPARK トークンプロジェクト', 'footer.email': 'メール',
      'lang.switch': '言語',
      'common.confirm': '確認', 'common.cancel': 'キャンセル', 'common.loading': '読み込み中…', 'common.error': 'エラー',
    },
  },

  'ko': {
    name: '한국어', flag: '🇰🇷',
    strings: {
      'app.title': 'SPARK 토큰',
      'nav.home': '홈', 'nav.airdrop': '에어드롭', 'nav.market': '마켓',
      'nav.shop': '상점', 'nav.chat': '채팅', 'nav.video': '동영상',
      'nav.ai': 'AI', 'nav.admin': '관리',
      'hero.slogan': '작은 불씨가 흘러, 가치와 공생하다',
      'hero.desc': '이더리움 기반의 혁신적인 마케팅 리플렉션 토큰으로, 투명하고 공정하며 지속 가능한 커뮤니티 가치 생태계를 구축합니다.',
      'hero.claim': '에어드롭 받기', 'hero.login': '로그인', 'hero.download': 'SPARK DApp 다운로드',
      'economy.title': '토크노믹스 (세율)', 'economy.buy': '매수세', 'economy.sell': '매도세',
      'economy.transfer': '송금세', 'economy.auto': '자동 리플렉션',
      'ipfs.title': 'IPFS 영구 이미지', 'ipfs.logo': '로고 아바타', 'ipfs.bg': '배경 이미지',
      'airdrop.title': '에어드롭 센터', 'airdrop.claim': '수령', 'airdrop.balance': '에어드롭 잔액',
      'chat.title': '탈중앙화 채팅', 'chat.send': '전송', 'chat.placeholder': '메시지를 입력하세요…',
      'market.title': '실시간 시세', 'shop.title': '탈중앙화 상점', 'shop.publish': '상품 등록',
      'video.title': '숏폼 (시청하고 SPARK 획득)', 'video.watch': '시청 시작',
      'ai.title': 'AI 자가 점검 업그레이드', 'ai.scan': '스캔 시작', 'ai.upgrade': '업그레이드는 관리자 수동 승인 필요',
      'admin.title': '관리 패널', 'admin.login': '관리자 로그인', 'admin.password': '비밀번호',
      'admin.marketing': '마케팅 지갑', 'admin.balanceLimit': '잔액 제한 (초과 지출 금지)',
      'wallet.connect': '지갑 연결', 'wallet.connected': '연결됨',
      'footer.copy': '© 2026 SPARK 토큰 프로젝트', 'footer.email': '이메일',
      'lang.switch': '언어',
      'common.confirm': '확인', 'common.cancel': '취소', 'common.loading': '로딩 중…', 'common.error': '오류',
    },
  },
};

/** 获取某个 locale 的所有字符串，缺失则 fallback 到 zh-CN */
export function getStrings(locale) {
  return locales[locale]?.strings || locales['zh-CN'].strings;
}

/** 检测浏览器语言，返回 supported 内的最匹配项 */
export function detectLocale(supported, defaultLocale, navValue) {
  const nav = navValue || (typeof navigator !== 'undefined' && navigator.language) || '';
  const candidates = [nav, nav.split('-')[0]];
  for (const c of candidates) {
    if (!c) continue;
    if (supported.includes(c)) return c;
    // zh => zh-CN, en => en ...
    const matched = supported.find((s) => s.startsWith(c + '-') || s.startsWith(c));
    if (matched) return matched;
  }
  return defaultLocale;
}
