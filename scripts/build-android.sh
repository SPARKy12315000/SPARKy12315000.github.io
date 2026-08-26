#!/bin/bash
# SPARK Android APK 构建脚本（Capacitor，免费开源）
# 使用：./scripts/build-android.sh
set -e
APP_NAME="SPARK 星火通证"
PACKAGE="com.spark.token"
WEB_DIR="."

echo "==> [1/6] 检查依赖"
command -v node >/dev/null && echo "node: $(node -v)" || (echo "请先安装 Node.js" && exit 1)

echo "==> [2/6] 初始化 Capacitor（如未初始化）"
if [ ! -f "android/app/build.gradle" ]; then
  npm init -y >/dev/null 2>&1 || true
  npm install --save-dev @capacitor/cli @capacitor/core @capacitor/android >/dev/null 2>&1 || true
  npx cap init "$APP_NAME" "$PACKAGE" --web-dir="$WEB_DIR" || true
  npx cap add android || true
fi

echo "==> [3/6] 同步前端资源到安卓"
npx cap sync android || true

echo "==> [4/6] 生成签名 Keystore（如不存在）"
KEYSTORE="android/spark-release-key.keystore"
if [ ! -f "$KEYSTORE" ]; then
  keytool -genkeypair -v -keystore "$KEYSTORE" -storepass spark12345 -keypass spark12345 \
    -alias sparkrelease -keyalg RSA -keysize 2048 -validity 10000 \
    -dname "CN=SPARK, OU=Token, O=SPARK, L=Crypto, S=Chain, C=CN" 2>/dev/null || true
fi

echo "==> [5/6] 写入自动签名配置"
cat > android/gradle.properties <<EOF
android.useAndroidX=true
sparkKeystorePassword=spark12345
sparkKeyPassword=spark12345
EOF
# 在 app/build.gradle 注入签名（幂等）
GRADLE="android/app/build.gradle"
if ! grep -q "signingConfigs" "$GRADLE"; then
  sed -i '/android {/a\
    signingConfigs {\
        release {\
            storeFile file("spark-release-key.keystore")\
            storePassword System.getenv("SPARK_KEYSTORE") ?: "spark12345"\
            keyAlias "sparkrelease"\
            keyPassword System.getenv("SPARK_KEY") ?: "spark12345"\
        }\
    }\
    buildTypes.release.signingConfig = signingConfigs.release' "$GRADLE" 2>/dev/null || true
fi

echo "==> [6/6] 构建 Release APK"
cd android && ./gradlew assembleRelease -PsparkKeystorePassword=spark12345 -PsparkKeyPassword=spark12345 && cd ..
mkdir -p apk-out
cp android/app/build/outputs/apk/release/app-release.apk apk-out/ 2>/dev/null || \
cp android/app/build/outputs/apk/release/app-release-unsigned.apk apk-out/app-release.apk 2>/dev/null || true

echo "✅ APK 已输出到 apk-out/app-release.apk"
ls -la apk-out/
