#!/bin/bash
# SPARK DApp - Android APK 构建脚本
# 用于本地构建 APK（当 GitHub Actions 缺少 Android SDK 时备用）

set -e

APP_NAME="SPARK"
PACKAGE="org.spark.token"
VERSION="2.0.0"

echo "🔥 SPARK DApp Android 构建"
echo "=========================="

# 检查环境
if ! command -v cordova &> /dev/null; then
    echo "📦 安装 Cordova..."
    npm install -g cordova @cordova/cli
fi

# 创建项目
if [ ! -d "spark-android" ]; then
    echo "📁 创建 Cordova 项目..."
    cordova create spark-android $PACKAGE $APP_NAME
fi

cd spark-android

# 添加平台
if [ ! -d "platforms/android" ]; then
    echo "🤖 添加 Android 平台..."
    cordova platform add android
fi

# 复制 Web 资源
echo "📋 复制 Web 资源..."
rm -rf www/*
cp -r ../index.html ../apk.html ../manifest.json ../sw.js ../version.json ../js ../vendor ../contracts ./www/ 2>/dev/null || true
cp ../index.html ./www/
cp ../manifest.json ./www/ 2>/dev/null || true

# 配置 config.xml
cat > config.xml <<EOF
<?xml version='1.0' encoding='utf-8'?>
<widget id="$PACKAGE" version="$VERSION" xmlns="http://www.w3.org/ns/widgets">
    <name>$APP_NAME</name>
    <description>星火通证 SPARK - 去中心化应用</description>
    <author email="spark@sparktoken.eth">SPARK Team</author>
    <content src="index.html"/>
    <access origin="*" />
    <allow-intent href="http://*/*" />
    <allow-intent href="https://*/*" />
    <preference name="android-minSdkVersion" value="21" />
    <preference name="android-targetSdkVersion" value="33" />
    <preference name="WebViewbounces" value="false" />
    <preference name="UIWebViewBounces" value="false" />
    <preference name="DisallowOverscroll" value="true" />
    <preference name="android-hardwareAccelerated" value="true" />
    <feature name="CDVWKWebViewEngine">
        <param name="ios-package" value="CDVWKWebViewEngine"/>
    </feature>
    <preference name="CordovaWebViewEngine" value="CDVWKWebViewEngine"/>
</widget>
EOF

# 构建
echo "🔨 构建 APK..."
cordova build android --release

# 查找 APK
APK=$(find platforms/android/app/build/outputs -name "*.apk" 2>/dev/null | head -1)
if [ -z "$APK" ]; then
    APK=$(find platforms/android -name "*.apk" | head -1)
fi

if [ -n "$APK" ]; then
    cp "$APK" "../SPARK-${VERSION}.apk"
    echo ""
    echo "========================================"
    echo "✅ APK 构建成功！"
    echo ""
    echo "📦 文件: ../SPARK-${VERSION}.apk"
    echo ""
    echo "📋 下一步："
    echo "1. 上传到 GitHub Releases"
    echo "   https://github.com/SPARKy12315000/SPARKy12315000.github.io/releases/new"
    echo "2. 或部署到自有 CDN"
    echo "========================================"
else
    echo "❌ APK 未生成，请检查构建日志"
    exit 1
fi
