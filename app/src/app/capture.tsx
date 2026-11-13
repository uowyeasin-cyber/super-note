import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useApp } from '../lib/store';
import { aiDraft, offlineDraft, saveDraft, type Draft } from '../lib/capture';
import { aiRead } from '../lib/ai';
import { askNotificationPermission } from '../lib/alarms';
import { whenLabel } from '../lib/i18n';
import { AREAS } from '../lib/classify';
import type { Level } from '../lib/parse';
import { AREA_COLORS } from '../lib/theme';
import { Icon } from '../components/Icon';
import { Btn, Chip, IconBtn, Press, T, toast } from '../components/ui';

const NEXT_LEVEL: Record<Level, Level> = { normal: 'urgent', urgent: 'critical', critical: 'normal' };

export default function Capture() {
  const { c, t, s, set, bump } = useApp();
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [partial, setPartial] = useState('');
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const baseText = useRef('');
  const aiSeq = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;

  // Pulse ring while listening.
  useEffect(() => {
    if (!listening) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  useSpeechRecognitionEvent('start', () => { setListening(true); setErr(''); });
  useSpeechRecognitionEvent('end', () => { setListening(false); setPartial(''); });
  useSpeechRecognitionEvent('result', (e) => {
    const said = e.results?.[0]?.transcript ?? '';
    if (e.isFinal) {
      const joined = (baseText.current ? baseText.current.trim() + ' ' : '') + said.trim();
      baseText.current = joined;
      setText(joined);
      setPartial('');
    } else {
      setPartial(said);
    }
  });
  useSpeechRecognitionEvent('error', (e) => {
    setListening(false);
    if (e.error === 'no-speech' || e.error === 'speech-timeout') setErr(t.noSpeech);
    else if (e.error === 'network') setErr(t.networkSpeech);
    else if (e.error === 'not-allowed') setErr(t.micDenied);
    else if (e.error !== 'aborted') setErr(t.speechUnavailable);
  });

  // Start listening right away the first time the sheet opens.
  useEffect(() => {
    askNotificationPermission().catch(() => {});
    start();
    return () => { try { ExpoSpeechRecognitionModule.abort(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Offline reading is instant; AI (if a key is set) refines it a moment later.
  useEffect(() => {
    const full = text.trim();
    if (!full) { setDraft(null); return; }
    setDraft(offlineDraft(full, s.defaultLevel));
    if (!s.aiKey || listening) return;
    const seq = ++aiSeq.current;
    setAiBusy(true);
    const timer = setTimeout(async () => {
      const r = await aiRead(full, s.aiKey, s.aiModel);
      if (seq !== aiSeq.current) return;
      setAiBusy(false);
      if (r) setDraft(aiDraft(r, s.defaultLevel));
    }, 700);
    return () => { clearTimeout(timer); setAiBusy(false); };
  }, [text, listening, s.aiKey, s.aiModel, s.defaultLevel]);

  async function start() {
    setErr('');
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { setErr(t.micDenied); return; }
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { setErr(t.speechUnavailable); return; }
      baseText.current = text;
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
      ExpoSpeechRecognitionModule.start({
        lang: s.speech,
        interimResults: true,
        continuous: true,
        addsPunctuation: true,
        androidIntentOptions: { EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 2500, EXTRA_LANGUAGE_MODEL: 'free_form' },
      });
    } catch {
      setErr(t.speechUnavailable);
    }
  }

  function stop() {
    try { ExpoSpeechRecognitionModule.stop(); } catch {}
  }

  function save() {
    if (!text.trim() || !draft || saving) return;
    setSaving(true);
    stop();
    try {
      const r = saveDraft(text, s.speech === 'bn-BD' ? 'bn' : 'en', draft, s.escalate);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast(r.armed ? t.remindersSet(r.armed) : t.saved);
      bump();
      router.back();
    } finally {
      setSaving(false);
    }
  }

  const ring = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] });
  const ringOpacity = pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] });

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <IconBtn name="x" label={t.cancel} onPress={() => router.back()} />
        <T kind="h3">{t.newNote}</T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip label="EN" active={s.speech === 'en-US'} onPress={() => { stop(); set({ speech: 'en-US' }); }} />
          <Chip label="বাং" active={s.speech === 'bn-BD'} onPress={() => { stop(); set({ speech: 'bn-BD' }); }} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 18 }}>
          <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: c.accent, opacity: ringOpacity, transform: [{ scale: ring }] }} />
            <Press accessibilityLabel={listening ? t.tapToStop : t.tapToSpeak} onPress={listening ? stop : start} style={{
              width: 96, height: 96, borderRadius: 48, backgroundColor: listening ? c.danger : c.accent, alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name={listening ? 'stop' : 'mic'} size={listening ? 30 : 38} color={c.onAccent} stroke={2.1} />
            </Press>
          </View>
          <T kind="small" style={{ marginTop: 4 }}>{listening ? t.listening : t.tapToSpeak}</T>
          {err ? <T kind="small" color={c.danger} style={{ marginTop: 8, textAlign: 'center' }}>{err}</T> : null}
        </View>

        <View style={{ backgroundColor: c.surface, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 14, minHeight: 120 }}>
          <TextInput
            value={text + (partial ? (text ? ' ' : '') + partial : '')}
            onChangeText={(v) => { setText(v); baseText.current = v; setPartial(''); }}
            placeholder={t.typeInstead}
            placeholderTextColor={c.ink3}
            multiline
            style={{ color: c.ink, fontSize: 17, lineHeight: 25, minHeight: 92, textAlignVertical: 'top' }}
          />
        </View>

        {draft ? (
          <View style={{ marginTop: 22 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <T kind="label">{t.understood}</T>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Icon name="sparkle" size={14} color={draft.byAi ? c.accent : c.ink3} />
                <T kind="small" color={draft.byAi ? c.accent : c.ink3}>{aiBusy ? t.sortingWithAi : draft.byAi ? t.aiOn : t.aiOff}</T>
              </View>
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
              {AREAS.map((a) => (
                <Chip key={a} label={t[a]} active={draft.area === a} color={AREA_COLORS[a]} icon="folder" onPress={() => setDraft({ ...draft, area: a })} />
              ))}
            </ScrollView>

            <View style={{ marginTop: 14, backgroundColor: c.surface, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line }}>
              {draft.tasks.length === 0 ? (
                <T kind="small" style={{ padding: 16 }}>{t.noTasksFound}</T>
              ) : draft.tasks.map((x, i) => (
                <View key={x.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14, borderBottomWidth: i === draft.tasks.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line, opacity: x.on ? 1 : 0.5 }}>
                  <Press accessibilityLabel="include" onPress={() => setDraft({ ...draft, tasks: draft.tasks.map((y) => (y.key === x.key ? { ...y, on: !y.on } : y)) })} style={{
                    width: 26, height: 26, borderRadius: 9, borderWidth: 1.6, borderColor: x.on ? c.accent : c.ink3, backgroundColor: x.on ? c.accent : 'transparent', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {x.on ? <Icon name="check" size={16} color={c.onAccent} stroke={2.4} /> : null}
                  </Press>
                  <View style={{ flex: 1 }}>
                    <T kind="h3" numberOfLines={2}>{x.title}</T>
                    <T kind="small" color={c.ink2} style={{ marginTop: 3 }}>
                      {x.at !== null ? whenLabel(x.at, s.lang) : ''}{x.repeat !== 'none' ? ' · ' + (x.repeat === 'daily' ? t.repeatDaily : t.repeatWeekly) : ''}{x.duplicate ? ' · ' + t.duplicate : ''}
                    </T>
                  </View>
                  <Press accessibilityLabel={t.tapLevel} onPress={() => setDraft({ ...draft, tasks: draft.tasks.map((y) => (y.key === x.key ? { ...y, level: NEXT_LEVEL[y.level] } : y)) })} style={{
                    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, height: 32, borderRadius: 999, backgroundColor: c.sunken,
                  }}>
                    <Icon name={x.level === 'critical' ? 'phone' : x.level === 'urgent' ? 'alarm' : 'bell'} size={14} color={x.level === 'critical' ? c.danger : x.level === 'urgent' ? c.warn : c.ink2} />
                    <T kind="small" color={c.ink2} style={{ fontWeight: '600' }}>{t[x.level]}</T>
                  </Press>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>

      <View style={{ paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(insets.bottom, 14), borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.line, backgroundColor: c.bg }}>
        <Btn label={saving ? t.saving : t.save} icon="check" disabled={!text.trim() || saving} onPress={save} />
      </View>
    </KeyboardAvoidingView>
  );
}
