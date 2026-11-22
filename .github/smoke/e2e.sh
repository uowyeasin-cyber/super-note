#!/usr/bin/env bash
# End-to-end check on the emulator, run after run.sh: type a note, save it, check that a
# reminder is armed and rings, search the library, and fire each test reminder level.
# Writes screenshots and E2E lines to $OUT/status.txt. Never exits early.
set -u
PKG=com.averroesai.easylife
OUT=smoke-out
HERE=$(cd "$(dirname "$0")" && pwd)

shot() { adb exec-out screencap -p > "$OUT/$1.png" 2>/dev/null || true; }
log() { echo "E2E $*" | tee -a "$OUT/status.txt"; }
dump() { adb shell uiautomator dump /sdcard/ui.xml > /dev/null 2>&1; adb pull /sdcard/ui.xml "$OUT/ui.xml" > /dev/null 2>&1; }
# tap "<regex on text or content-desc>": taps the first match. Returns 1 when not on screen.
tap() {
  dump
  local xy
  xy=$(python3 "$HERE/find.py" "$OUT/ui.xml" "$1") || return 1
  adb shell input tap $xy
}
# Scroll down until the regex is visible, then tap it.
tap_scroll() {
  for i in 1 2 3 4 5 6; do
    tap "$1" && return 0
    adb shell input swipe 160 520 160 180 300; sleep 1
  done
  return 1
}

adb shell am force-stop "$PKG"; sleep 1
adb shell monkey -p "$PKG" -c android.intent.category.LAUNCHER 1 > /dev/null 2>&1; sleep 8

# 1. Type a note with a reminder in 2 minutes and save it.
adb shell am start -a android.intent.action.VIEW -d "easylife://capture" "$PKG" > /dev/null 2>&1; sleep 5
tap "Tap to stop|থামাতে চাপ দিন" && sleep 1
if tap "Or type here|অথবা এখানে লিখুন"; then log "type-field: found"; else log "type-field: MISSING"; fi
sleep 1
adb shell input text "Call%sthe%sbank%sabout%sthe%sloan%sin%s2%sminutes"
sleep 2; shot e2e-1-draft
adb shell input keyevent 111 || true; sleep 1
if tap "^Save$|^সেভ করুন$"; then log "save-button: tapped"; else log "save-button: MISSING"; fi
sleep 3; shot e2e-2-after-save
SAVED_AT=$(date +%s)

# 2. Is the reminder armed with Android?
if adb shell dumpsys alarm | grep -q "$PKG"; then log "alarm-armed: yes"; else log "alarm-armed: NO"; fi
dump; if grep -qi "loan" "$OUT/ui.xml"; then log "today-shows-task: yes"; else log "today-shows-task: NO"; fi

# 3. Library: the note is there and search finds it.
adb shell am start -a android.intent.action.VIEW -d "easylife://library" "$PKG" > /dev/null 2>&1; sleep 4
dump; if grep -qi "loan" "$OUT/ui.xml"; then log "library-has-note: yes"; else log "library-has-note: NO"; fi
if tap "Search notes|নোট খুঁজুন|খুঁজুন"; then sleep 1; adb shell input text "loan"; sleep 2; dump
  if grep -qi "bank" "$OUT/ui.xml"; then log "search-finds-note: yes"; else log "search-finds-note: NO"; fi
else log "search-field: MISSING"; fi
shot e2e-3-search
adb shell input keyevent 111 || true

# 4. Wait for the reminder to ring (due about 2 minutes after saving).
adb shell input keyevent KEYCODE_HOME
WAIT=$(( 150 - ($(date +%s) - SAVED_AT) )); [ "$WAIT" -gt 0 ] && sleep "$WAIT"
if adb shell dumpsys notification --noredact | grep -A3 "pkg=$PKG" | grep -q .; then log "reminder-rang: yes"; else log "reminder-rang: NO"; fi
adb shell cmd statusbar expand-notifications; sleep 2; shot e2e-4-notification
adb shell cmd statusbar collapse; sleep 1

# 5. Test rings from Settings: Alarm, then Call screen (full screen).
adb shell am start -a android.intent.action.VIEW -d "easylife://settings" "$PKG" > /dev/null 2>&1; sleep 4
if tap_scroll "▶ (Alarm|অ্যালার্ম)"; then log "test-alarm: tapped"; sleep 9; shot e2e-5-alarm; else log "test-alarm: MISSING"; fi
adb shell am start -a android.intent.action.VIEW -d "easylife://settings" "$PKG" > /dev/null 2>&1; sleep 3
if tap_scroll "▶ (Call screen|কল স্ক্রিন)"; then log "test-call: tapped"; adb shell input keyevent KEYCODE_SLEEP; sleep 9; adb shell input keyevent KEYCODE_WAKEUP; sleep 2; shot e2e-6-callscreen
  dump; if grep -q "$PKG" "$OUT/ui.xml" && grep -qiE "EASY LIFE|Done|Snooze" "$OUT/ui.xml"; then log "call-screen-shown: yes"; else log "call-screen-shown: NO"; fi
else log "test-call: MISSING"; fi

# 6. New v0.2 screens open without crashing; "Tell the AI" turns a sentence into an action.
for r in money more assistant class circle message profile; do
  adb shell am start -a android.intent.action.VIEW -d "easylife://$r" "$PKG" > /dev/null 2>&1; sleep 3; shot "e2e-7-$r"
  if adb shell pidof "$PKG" > /dev/null 2>&1; then log "screen-$r: open"; else log "screen-$r: CRASH"; fi
done
adb shell am start -a android.intent.action.VIEW -d "easylife://assistant" "$PKG" > /dev/null 2>&1; sleep 3
if tap "What should I do|কী করব"; then sleep 1; adb shell input text "open%sfacebook"; adb shell input keyevent 111; sleep 1
  tap "^Do it$|^করে দাও$"; sleep 3; dump; shot e2e-8-assistant
  if grep -qiE "Open facebook|facebook খুলব" "$OUT/ui.xml"; then log "assistant-plans-action: yes"; else log "assistant-plans-action: NO"; fi
else log "assistant-field: MISSING"; fi

if adb shell pidof "$PKG" > /dev/null 2>&1; then log "alive-at-end: yes"; else log "alive-at-end: NO"; fi
adb logcat -d > "$OUT/logcat-e2e.txt" 2>&1
echo "===== E2E ====="; grep "^E2E" "$OUT/status.txt"
exit 0
