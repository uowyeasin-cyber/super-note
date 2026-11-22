import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useApp } from '../lib/store';
import { aiDraft, offlineDraft, saveDraft, type Draft } from '../lib/capture';
import { files } from '../lib/db';
import { aiRead, type AiResult } from '../lib/ai';
import { FREE_NOTES_PER_DAY, notesToday, proAiRead } from '../lib/plan';
import { needPro } from '../components/PlanBadge';
import { askNotificationPermission } from '../lib/alarms';
import { whenLabel } from '../lib/i18n';
import { AREAS, type Area } from '../lib/classify';
import type { Kind } from '../lib/db';
import { aiAvailable, type AiCtx } from '../lib/brain';
import { pickPhoto, readPhoto } from '../lib/photo';
import { fetchPage, findUrl, linkToNote, URL_RE } from '../lib/link';
import { offlineAction } from '../lib/assistant';
import type { Level } from '../lib/parse';
import { AREA_COLORS } from '../lib/theme';
import { Icon } from '../components/Icon';
import { Btn, Chip, IconBtn, Press, T, toast } from '../components/ui';

const NEXT_LEVEL: Record<Level, Level> = { normal: 'urgent', urgent: 'critical', critical: 'normal' };

export default function Capture() {
  const app = useApp();
  const { c, t, s, set, bump, pro, plan } = app;
  const insets = useSafeAreaInsets();
  // Opened from a file ("Add to this file") or from Class mode: everything goes into that file.
  const params = useLocalSearchParams<{ area?: string; topic?: string; mode?: string; text?: string }>();
  const classMode = params.mode === 'class';
  const [hint, setHint] = useState<{ areaHint?: Area; topicHint?: string }>(() => ({
    areaHint: AREAS.includes(params.area as Area) ? (params.area as Area) : classMode ? 'academic' : undefined,
    topicHint: params.topic ? String(params.topic) : undefined,
  }));
  const [attach, setAttach] = useState<{ kind: Kind; media?: string; url?: string } | null>(null);
  const [busy, setBusy] = useState('');
  const keepListening = useRef(classMode);
  const ctx: AiCtx = { key: s.aiKey, model: s.aiModel, pro, plan };
  const [text, setText] = useState(params.text ? String(params.text) : '');
  const [partial, setPartial] = useState('');
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState('');
  const [draft, setDraft] = useState<Draft | null>(null);
  const [aiBusy, setAiBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const baseText = useRef(params.text ? String(params.text) : '');
  const aiSeq = useRef(0);
  const pulse = useRef(new Animated.Value(0)).current;

  // Pulse ring while listening (skipped when the phone asks for less motion).
  const [calm, setCalm] = useState(false);
  useEffect(() => { AccessibilityInfo.isReduceMotionEnabled().then(setCalm).catch(() => {}); }, []);
  useEffect(() => {
    if (!listening || calm) { pulse.stopAnimation(); pulse.setValue(0); return; }
    const loop = Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [listening, pulse, calm]);

  useSpeechRecognitionEvent('start', () => { setListening(true); setErr(''); });
  useSpeechRecognitionEvent('end', () => {
    setListening(false); setPartial('');
    // Class mode keeps listening through pauses until the person taps stop.
    if (keepListening.current) setTimeout(() => { if (keepListening.current) start(); }, 400);
  });
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
    if (!params.text) start();
    return () => { try { ExpoSpeechRecognitionModule.abort(); } catch {} };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Offline reading is instant; AI (if a key is set) refines it a moment later.
  useEffect(() => {
    const full = text.trim();
    if (!full) { setDraft(null); return; }
    const url = attach?.url || findUrl(full);
    const base = offlineDraft(full, s.defaultLevel, {
      ...hint, kind: attach?.kind ?? (classMode ? 'class' : url ? 'link' : undefined), media: attach?.media, url: url || undefined,
    });
    setDraft(base);
    // Own Gemini key works on any plan; Pro uses the built-in AI with no key.
    if ((!s.aiKey && !pro) || listening) return;
    const seq = ++aiSeq.current;
    setAiBusy(true);
    const timer = setTimeout(async () => {
      const names = files().map((f) => f.topic);
      const r = s.aiKey ? await aiRead(full, s.aiKey, s.aiModel, 9000, names) : ((await proAiRead(full, plan, names)) as AiResult | null);
      if (seq !== aiSeq.current) return;
      setAiBusy(false);
      // A file chosen by the person (opened from a file or class) always wins over the AI's guess.
      if (r) setDraft(aiDraft(r, s.defaultLevel, base, !!hint.topicHint));
    }, 700);
    return () => { clearTimeout(timer); setAiBusy(false); };
  }, [text, listening, s.aiKey, s.aiModel, s.defaultLevel, pro, plan, attach, hint, classMode]);

  // A pasted link on its own is opened and turned into a note straight away.
  useEffect(() => {
    const only = text.trim();
    if (!attach && only && URL_RE.test(only) && only === findUrl(only)) addLink(only);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text]);

  const lang = s.lang === 'bn' ? 'bn' : 'en';
  const fileNames = () => files().map((f) => f.topic);
  const addText = (more: string) => {
    const joined = [text.trim(), more.trim()].filter(Boolean).join('\n\n');
    baseText.current = joined;
    setText(joined);
  };

  async function addPhoto(from: 'camera' | 'gallery') {
    if (busy) return;
    const wasListening = keepListening.current;
    keepListening.current = false; stop();
    try {
      const p = await pickPhoto(from);
      if (!p) return;
      setAttach({ kind: 'photo', media: p.uri });
      if (!aiAvailable(ctx)) { if (!text.trim()) addText(t.photoNote); toast(t.photoNoAi); return; }
      setBusy(t.readingPhoto);
      const r = await readPhoto(p, ctx, lang, fileNames(), hint.topicHint ?? '');
      if (r?.text) addText(r.text);
      else if (!text.trim()) addText(t.photoNote);
      if (r && !hint.topicHint && r.topic) setHint({ areaHint: r.area, topicHint: r.topic });
    } finally {
      setBusy('');
      if (wasListening) { keepListening.current = true; start(); }
    }
  }

  async function addLink(given?: string) {
    if (busy) return;
    let url = given || findUrl(text);
    if (!url) { try { url = findUrl(await Clipboard.getStringAsync()); } catch {} }
    if (!url) { toast(t.noLink); return; }
    stop();
    setAttach({ kind: 'link', url });
    setBusy(t.readingLink);
    try {
      const page = await fetchPage(url);
      if (!page) { if (!text.includes(url)) addText(url); toast(t.linkFailed); return; }
      const n = await linkToNote(page, ctx, lang, fileNames());
      const rest = text.replace(url, '').trim();
      const body = [n.title, url, n.text].filter(Boolean).join('\n');
      baseText.current = [rest, body].filter(Boolean).join('\n\n');
      setText(baseText.current);
      if (!hint.topicHint && n.topic) setHint({ areaHint: n.area, topicHint: n.topic });
    } finally {
      setBusy('');
    }
  }

  async function start() {
    setErr('');
    try {
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) { setErr(t.micDenied); return; }
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) { setErr(t.speechUnavailable); return; }
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

  function stopByHand() {
    keepListening.current = false;
    stop();
  }

  function save() {
    if (!text.trim() || !draft || saving) return;
    if (!pro && notesToday() >= FREE_NOTES_PER_DAY && needPro(app, toast, t.freeLimit(FREE_NOTES_PER_DAY))) return;
    setSaving(true);
    keepListening.current = false;
    stop();
    try {
      const fixed = { ...draft, topic: draft.topic.trim() || (s.lang === 'bn' ? 'সাধারণ' : 'General') };
      const r = saveDraft(text, s.speech === 'bn-BD' ? 'bn' : 'en', pro ? fixed : { ...fixed, tasks: fixed.tasks.map((x) => (x.level === 'critical' ? { ...x, level: 'urgent' as const } : x)) }, s.escalate && pro);
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
        <T kind="h3" numberOfLines={1} style={{ flex: 1, textAlign: 'center', marginHorizontal: 8 }}>{classMode && hint.topicHint ? t.inClass(hint.topicHint) : t.newNote}</T>
        <View style={{ flexDirection: 'row', gap: 6 }}>
          <Chip label="EN" active={s.speech === 'en-US'} onPress={() => { stop(); set({ speech: 'en-US' }); }} />
          <Chip label="বাং" active={s.speech === 'bn-BD'} onPress={() => { stop(); set({ speech: 'bn-BD' }); }} />
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 30 }}>
        <View style={{ alignItems: 'center', marginTop: 8, marginBottom: 18 }}>
          <View style={{ width: 132, height: 132, alignItems: 'center', justifyContent: 'center' }}>
            <Animated.View style={{ position: 'absolute', width: 96, height: 96, borderRadius: 48, backgroundColor: c.accent, opacity: ringOpacity, transform: [{ scale: ring }] }} />
            <Press accessibilityLabel={listening ? t.tapToStop : t.tapToSpeak} onPress={listening ? stopByHand : () => { keepListening.current = classMode; start(); }} style={{
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
          {attach?.media ? (
            <View style={{ marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image source={{ uri: attach.media }} style={{ width: 64, height: 64, borderRadius: 12, backgroundColor: c.sunken }} />
              <Press accessibilityLabel={t.delete} onPress={() => setAttach(null)} style={{ padding: 6 }}><Icon name="x" size={18} color={c.ink3} /></Press>
            </View>
          ) : null}
        </View>

        <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
          <Chip label={t.photo} icon="camera" onPress={() => addPhoto('camera')} />
          <Chip label={t.gallery} icon="image" onPress={() => addPhoto('gallery')} />
          <Chip label={t.link} icon="link" onPress={() => addLink()} />
        </View>
        {busy ? <T kind="small" color={c.accent} style={{ marginTop: 8 }}>{busy}</T> : null}
        {!listening && !classMode && text.trim() && offlineAction(text) ? (
          <Press onPress={() => { stopByHand(); router.replace({ pathname: '/assistant', params: { text } }); }} style={{
            marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: 16, backgroundColor: c.accentSoft,
          }}>
            <Icon name="sparkle" size={18} color={c.accent} />
            <T kind="body" style={{ flex: 1 }}>{t.commandFound}</T>
            <T kind="h3" color={c.accent}>{t.doIt} ›</T>
          </Press>
        ) : null}

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

            <View style={{ marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingHorizontal: 12, height: 46 }}>
              <Icon name="folder" size={16} color={AREA_COLORS[draft.area]} />
              <T kind="small" color={c.ink2}>{t.savesTo}  {t[draft.area]} ›</T>
              <TextInput
                accessibilityLabel={t.fileName}
                value={draft.topic}
                onChangeText={(v) => setDraft({ ...draft, topic: v })}
                style={{ flex: 1, color: c.ink, fontSize: 15, fontWeight: '600', paddingVertical: 0 }}
              />
              {draft.important ? <T kind="small" color={c.danger} style={{ fontWeight: '700' }}>● {t.important}</T> : null}
            </View>
            {draft.money ? (
              <View style={{ marginTop: 8, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 4 }}>
                <Icon name="wallet" size={16} color={draft.money.dir === 'in' ? c.ok : c.danger} />
                <T kind="body" style={{ fontWeight: '700' }} color={draft.money.dir === 'in' ? c.ok : c.danger}>
                  {draft.money.dir === 'in' ? '+' : '−'}৳{draft.money.amount.toLocaleString('en-US')}
                </T>
                <T kind="small" color={c.ink2}>{draft.money.dir === 'in' ? t.received : t.spent}{draft.money.party ? ' · ' + draft.money.party : ''}</T>
              </View>
            ) : null}

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
                  <Press accessibilityLabel={t.tapLevel} onPress={() => {
                    if (NEXT_LEVEL[x.level] === 'critical' && !pro) { needPro(app, toast, t.proFeature); return; }
                    setDraft({ ...draft, tasks: draft.tasks.map((y) => (y.key === x.key ? { ...y, level: NEXT_LEVEL[y.level] } : y)) });
                  }} style={{
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
