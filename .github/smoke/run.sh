#!/usr/bin/env bash
# Runs inside the emulator job, from app/. Never exits early: we always want the log.
set -u
PKG=com.averroesai.easylife
OUT=smoke-out
mkdir -p "$OUT"
APK=android/app/build/outputs/apk/release/app-release.apk

adb logcat -c || true
G=-g; [ "${VARIANT:-plain}" = "nogrant" ] && G=""
adb install -r $G "$APK" > "$OUT/install.txt" 2>&1
cat "$OUT/install.txt"
if [ "${VARIANT:-plain}" = "bn-dark" ]; then
  adb shell cmd uimode night yes || true
  adb shell cmd locale set-app-locales "$PKG" --locales bn-BD || true
fi

shot() { adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null || true; }
alive() { if adb shell pidof "$PKG" > /dev/null 2>&1; then echo "ALIVE"; else echo "DEAD"; fi; }

adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 12; shot 01-launch; echo "after launch: $(alive)" | tee -a "$OUT/status.txt"
sleep 10; shot 02-today; echo "after 22s: $(alive)" | tee -a "$OUT/status.txt"

for route in library capture settings upgrade; do
  adb shell am start -a android.intent.action.VIEW -d "easylife://$route" "$PKG" > /dev/null 2>&1
  sleep 6; shot "03-$route"; echo "$route: $(alive)" | tee -a "$OUT/status.txt"
  adb shell input keyevent KEYCODE_BACK; sleep 2
done

# Cold start a second time (data already on disk), like a user reopening.
adb shell am force-stop "$PKG"; sleep 2
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1
sleep 12; shot 04-relaunch; echo "relaunch: $(alive)" | tee -a "$OUT/status.txt"

adb logcat -d > "$OUT/logcat-full.txt" 2>&1
grep -E "AndroidRuntime|FATAL|ReactNativeJS|ReactNative|Expo|SuperAlarm|SoLoader|libc .*Fatal|DEBUG  :" "$OUT/logcat-full.txt" | tail -n 400 > "$OUT/logcat-app.txt"
echo "===== STATUS ====="; cat "$OUT/status.txt"
echo "===== APP LOG ====="; cat "$OUT/logcat-app.txt"
exit 0
