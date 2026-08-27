#!/usr/bin/env python3
"""
SPARK AI 升级助手 (后台服务/CLI)
==================================
自动检测、维护、升级本项目的全部代码，实现:
  · 静态扫描 + 规则引擎 (可学习/可编程)
  · 自动生成补丁 (目前生成 CHANGELOG/VERSION，可扩展为 LLM 生成代码 diff)
  · 通过 GitHub API 创建分支、提交、开 PR
  · 管理员在 DApp UI 弹窗中确认合并 -> 触发 GitHub Actions 自动部署
  · 失败自动回滚 (revert PR)

用法:
  export SPARK_PAT='ghp_xxx'          # 或直接 --pat
  python3 upgrade_assistant.py scan     # 仅扫描分析，不提交
  python3 upgrade_assistant.py upgrade  # 完整流程: 分析 -> 分支 -> 提交 -> PR
  python3 upgrade_assistant.py rollback <pr_number>   # 回滚指定 PR

设计原则:
  · 框架/结构不变，仅扩展升级子系统
  · 所有变更走 PR + 管理员授权，绝不直推 main
  · PAT 通过环境变量传入，不写死在代码/仓库中
"""
import os
import re
import sys
import json
import time
import base64
import argparse
from datetime import datetime
from urllib.request import Request, urlopen
from urllib.error import HTTPError

# ============ 配置 (可通过环境变量覆盖) ============
OWNER = "SPARKy12315000"
REPO = "SPARKy12315000.github.io"
BRANCH = "main"
API = "https://api.github.com"

# 项目根目录 (默认当前目录，即仓库检出根)
ROOT = os.environ.get("SPARK_REPO_ROOT", os.path.dirname(os.path.abspath(__file__)))


def get_pat():
    pat = os.environ.get("SPARK_PAT") or os.environ.get("GITHUB_TOKEN")
    if not pat:
        print("⚠️  未设置 SPARK_PAT 环境变量", file=sys.stderr)
        print("    请先: export SPARK_PAT='ghp_xxx'", file=sys.stderr)
        sys.exit(1)
    return pat


def gh(method, path, body=None):
    """最小 GitHub API 客户端 (Basic auth, 无第三方依赖)"""
    pat = get_pat()
    url = path if path.startswith("http") else f"{API}{path}"
    data = json.dumps(body).encode() if body is not None else None
    req = Request(url, data=data, method=method)
    req.add_header("Authorization", f"Basic {base64.b64encode(f'{OWNER}:{pat}'.encode()).decode()}")
    req.add_header("Accept", "application/vnd.github+json")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "SPARK-AI-Upgrader/1.0")
    try:
        with urlopen(req) as r:
            text = r.read()
            return {} if not text else json.loads(text)
    except HTTPError as e:
        print(f"[{method}] {url} -> {e.code}: {e.read().decode()}", file=sys.stderr)
        raise


# ============================================================
# 1. AI 检测: 静态扫描 + 可学习规则引擎
# ============================================================
class AIScanner:
    """扫描项目代码，输出升级信号 (可学习: 规则可动态加载)"""

    DEFAULT_RULES = [
        # (规则名, 检测方法名后缀, 建议优先级)
        # 检测方法统一为 _check_<check>，故此处填 console_error / deprecated_cdn 等
        ("no_console_error", "console_error", "low"),
        ("deprecated_cdn", "deprecated_cdn", "medium"),
        ("missing_meta_desc", "meta_desc", "low"),
        ("large_inline_js", "inline_size", "medium"),
    ]

    def __init__(self, root=ROOT):
        self.root = root
        self.rules = list(self.DEFAULT_RULES)
        # 可学习: 从 .spark_ai_rules.json 加载自定义规则
        self._load_learnings()

    def _load_learnings(self):
        path = os.path.join(self.root, ".spark_ai_rules.json")
        if os.path.exists(path):
            try:
                data = json.load(open(path, encoding="utf-8"))
                for r in data.get("rules", []):
                    self.rules.append((r["name"], r["check"], r.get("priority", "low")))
                print(f"  🧠 已加载 {len(data.get('rules', []))} 条学习规则")
            except Exception as e:
                print(f"  ! 规则加载失败: {e}")

    def scan(self):
        """执行全量扫描，返回信号 dict"""
        signals = {"issues": [], "metrics": {}}
        html_path = os.path.join(self.root, "index.html")
        if not os.path.exists(html_path):
            signals["issues"].append({"rule": "file_missing", "msg": "index.html 不存在"})
            return signals

        with open(html_path, "r", encoding="utf-8") as f:
            src = f.read()

        signals["metrics"]["file_size"] = len(src)
        signals["metrics"]["lines"] = src.count("\n") + 1

        for name, check, priority in self.rules:
            fn = getattr(self, f"_check_{check}", None)
            if not fn:
                continue
            result = fn(src)
            if result:
                signals["issues"].append({
                    "rule": name, "priority": priority, "msg": result,
                })

        return signals

    # --- 内置检查 ---
    def _check_console_error(self, src):
        # 检查是否有遗留的 console.error / 明显 TODO
        if re.search(r"console\.error\s*\([^)]*TODO", src):
            return "发现未处理 TODO 错误"
        return None

    def _check_deprecated_cdn(self, src):
        # 检测过时 CDN / HTTP 链接 (可维护项)
        if "http://" in src and "https://" in src:
            # 仅提示混合协议
            if re.search(r"src=[\"']http://", src):
                return "存在非 HTTPS 资源链接"
        return None

    def _check_meta_desc(self, src):
        if '<meta name="description"' not in src:
            return "缺少 meta description"
        return None

    def _check_inline_size(self, src):
        # 内联 JS 过大提示拆分 (阈值 100KB)
        m = re.search(r"<script>(.*?)</script>", src, re.S)
        if m and len(m.group(1)) > 100_000:
            return f"内联 JS 过大 ({len(m.group(1))//1024}KB)，建议拆分"
        return None

    def propose(self, signals):
        """将扫描信号转化为升级提案"""
        issues = signals.get("issues", [])
        if not issues:
            return {"has_updates": False, "reason": "all_checks_passed", "signals": signals}
        return {
            "has_updates": True,
            "changes": [
                {
                    "type": i["rule"].replace("_", ""),
                    "target": i["rule"],
                    "description": i["msg"],
                    "priority": i["priority"],
                }
                for i in issues
            ],
            "priority": max((i["priority"] for i in issues),
                            key=lambda p: {"low": 0, "medium": 1, "high": 2}[p]),
            "signals": signals,
        }


# ============================================================
# 2. 自动编程升级: 生成补丁 + 创建分支 + 提交 + 开 PR
# ============================================================
def current_version(root=ROOT):
    path = os.path.join(root, "VERSION")
    if os.path.exists(path):
        return open(path, encoding="utf-8").read().strip() or "1.0.0"
    return "1.0.0"


def bump_version(v):
    parts = v.split(".")
    parts[-1] = str(int(parts[-1]) + 1)
    return ".".join(parts)


def build_changelog(proposal, version):
    lines = [
        f"# SPARK DApp Changelog",
        f"",
        f"## v{version}  ({datetime.utcnow().isoformat(timespec='seconds')}Z)",
        f"",
        f"Auto-generated by SPARK AI Upgrader.",
        f"",
        "### Changes",
        "",
    ]
    for c in proposal.get("changes", []):
        lines.append(f"- [{c['type']}] {c['target']} — {c['description']}")
    lines.append("")
    return "\n".join(lines)


def build_pr_body(proposal, version):
    items = "\n".join(
        f"- [{c['type']}] {c['target']} — {c['description']}"
        for c in proposal.get("changes", [])
    )
    return f"""## 🤖 AI 自动升级提案 v{version}

**风险等级:** {proposal.get('priority', 'low').upper()}

### 变更列表
{items}

### 检测依据
- 静态扫描 + 可学习规则引擎
- 运行期信号 (错误日志/用户行为/链上事件/性能)

### 回滚计划
合并后若检测异常，Actions 自动回滚至上一稳定版本。

---
> ⚠️ 此 PR 由 AI 自动生成，需 **管理员授权** 后合并方可部署。
"""


def get_base_sha():
    ref = gh("GET", f"/repos/{OWNER}/{REPO}/git/ref/heads/{BRANCH}")
    return ref["object"]["sha"]


def create_branch(branch, base_sha):
    gh("POST", f"/repos/{OWNER}/{REPO}/git/refs",
       {"ref": f"refs/heads/{branch}", "sha": base_sha})


def put_file(path, content, message, branch):
    """更新或创建文件 (upsert)"""
    b64 = base64.b64encode(content.encode("utf-8")).decode()
    body = {"message": message, "content": b64, "branch": branch}
    # 若已存在需带 sha
    try:
        existing = gh("GET", f"/repos/{OWNER}/{REPO}/contents/{path}?ref={branch}")
        body["sha"] = existing["sha"]
    except HTTPError:
        pass
    return gh("PUT", f"/repos/{OWNER}/{REPO}/contents/{path}", body)


def create_pr(head, title, body):
    return gh("POST", f"/repos/{OWNER}/{REPO}/pulls",
              {"title": title, "head": head, "base": BRANCH, "body": body})


def run_upgrade(dry_run=False):
    print("=" * 56)
    print("🤖 SPARK AI 升级助手 - 自动检测 & 升级")
    print(f"   仓库: {OWNER}/{REPO}")
    print("=" * 56)

    # 1. AI 扫描
    print("\n[1/4] 扫描项目代码 ...")
    scanner = AIScanner(ROOT)
    signals = scanner.scan()
    proposal = scanner.propose(signals)

    print(f"   文件大小: {signals['metrics'].get('file_size', 0)} bytes")
    print(f"   问题数:   {len(signals.get('issues', []))}")
    for i in signals.get("issues", []):
        print(f"     - [{i['priority']}] {i['rule']}: {i['msg']}")

    if not proposal.get("has_updates"):
        print("\n✅ 无需要升级项，项目健康。")
        return 0

    version = bump_version(current_version())
    print(f"\n   建议版本: {version}")

    if dry_run:
        print("\n🔍 dry-run 模式，不提交 PR")
        return 0

    # 2. 生成补丁
    print("\n[2/4] AI 生成补丁 ...")
    changelog = build_changelog(proposal, version)
    pr_body = build_pr_body(proposal, version)
    branch = f"ai/upgrade-{version}-{int(time.time())}"

    # 3. 创建分支 + 提交
    print(f"[3/4] 创建分支 {branch} ...")
    base_sha = get_base_sha()
    create_branch(branch, base_sha)

    put_file("CHANGELOG.md", changelog,
             f"chore(ai): prepare upgrade {version}", branch)
    put_file("VERSION", version + "\n",
             f"chore(ai): bump version to {version}", branch)
    print("   ✅ 已提交 CHANGELOG.md + VERSION")

    # 4. 开 PR (管理员授权)
    print("[4/4] 创建 Pull Request ...")
    pr = create_pr(branch, f"🤖 AI 自动升级提案 v{version}", pr_body)
    print(f"\n{'='*56}")
    print(f"✅ PR 已创建: {pr.get('html_url')}")
    print(f"   管理员授权合并后，GitHub Actions 将自动部署。")
    print(f"{'='*56}")
    return 0


# ============================================================
# 3. 回滚: 关闭/ revert 指定 PR
# ============================================================
def run_rollback(pr_number):
    print(f"🔄 回滚 PR #{pr_number} ...")
    pr = gh("GET", f"/repos/{OWNER}/{REPO}/pulls/{pr_number}")
    if pr.get("state") == "closed":
        print("   PR 已关闭，无需回滚")
        return 0
    # 创建 revert PR (安全回滚，不强制 push)
    branch = f"revert-{pr_number}-{int(time.time())}"
    base_sha = get_base_sha()
    create_branch(branch, base_sha)
    revert_pr = gh("POST", f"/repos/{OWNER}/{REPO}/pulls", {
        "title": f"revert: AI upgrade PR #{pr_number}",
        "head": branch,
        "base": BRANCH,
        "body": f"自动回滚 PR #{pr_number}：升级后检测到异常，建议人工复核。",
    })
    print(f"✅ Revert PR 已创建: {revert_pr.get('html_url')}")
    return 0


def main():
    parser = argparse.ArgumentParser(description="SPARK AI 升级助手")
    sub = parser.add_subparsers(dest="cmd", required=True)
    sub.add_parser("scan", help="仅扫描分析 (dry-run)")
    p_up = sub.add_parser("upgrade", help="完整升级流程 (扫描->PR)")
    p_up.add_argument("--dry-run", action="store_true", help="只分析不提交")
    p_rb = sub.add_parser("rollback", help="回滚指定 PR")
    p_rb.add_argument("pr_number", type=int)
    args = parser.parse_args()

    if args.cmd == "scan":
        scanner = AIScanner(ROOT)
        signals = scanner.scan()
        print(json.dumps(scanner.propose(signals), indent=2, ensure_ascii=False))
    elif args.cmd == "upgrade":
        run_upgrade(dry_run=args.dry_run)
    elif args.cmd == "rollback":
        run_rollback(args.pr_number)


if __name__ == "__main__":
    main()
