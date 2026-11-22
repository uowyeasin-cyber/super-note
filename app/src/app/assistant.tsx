import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useApp } from '../lib/store';
import { aiAvailable } from '../lib/brain';
import { planAction } from '../lib/study';
import { actionUrl, offlineAction, type Action } from '../lib/assistant';
import { Icon } from '../components/Icon';
import { Btn, IconBtn, Press, T, toast } from '../components/ui';
import { Field } from '../components/Field';

/** Tell the AI: one sentence becomes an action in another app, an answer, or a note. */
export default function Assistant() {
  const { c, t, s, pro, plan } = useApp();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ text?: string }>();
  const [text, setText] = useState(params.text ? String(params.text) : '');
  const [act, setAct] = useState<Action | null>(null);
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const ctx = { key: s.aiKey, model: s.aiModel, pro, plan };
  const lang = s.lang === 'bn' ? 'bn' as const : 'en' as const;

  useSpeechRecognitionEvent('start', () => setListening(true));
  useSpeechRecognitionEvent('end', () => setListening(false));
  useSpeechRecognitionEvent('error', () => setListening(false));
  useSpeechRecognitionEvent('result', (e) => { const said = e.results?.[0]?.transcript ?? ''; if (said) setText(said); });

  async function listen() {
    if (listening) { try { ExpoSpeechRecognitionModule.stop(); } catch {} return; }
    try {
      if (!(await ExpoSpeechRecognitionModule.requestPermissionsAsync()).granted) { toast(t.micDenied); return; }
      ExpoSpeechRecognitionModule.start({ lang: s.speech, interimResults: true, addsPunctuation: true });
    } catch { toast(t.speechUnavailable); }
  }

  async function think() {
    const say = text.trim();
    if (!say) return;
    setBusy(true);
    try {
      const fromAi = aiAvailable(ctx) ? await planAction(say, ctx, lang) : null;
      const a = fromAi ?? offlineAction(say) ?? { kind: 'note' as const };
      setAct(a);
    } finally { setBusy(false); }
  }

  function run() {
    if (!act) return;
    if (act.kind === 'note') { router.replace({ pathname: '/capture', params: { text } }); return; }
    if (act.kind === 'answer') { router.replace({ pathname: '/capture', params: { text: `${text}\n\n${act.answer ?? ''}` } }); return; }
    const url = actionUrl(act);
    if (url) Linking.openURL(url).catch(() => toast(t.linkFailed));
  }

  const label = (a: Action) => {
    switch (a.kind) {
      case 'whatsapp': return t.doWhatsapp(a.to ?? '');
      case 'sms': return t.doSms(a.to ?? '');
      case 'call': return t.doCall(a.to || a.phone || '');
      case 'email': return t.doEmail;
      case 'search': return t.doSearch(a.query ?? '');
      case 'youtube': return t.doYoutube(a.query ?? '');
      case 'maps': return t.doMaps(a.query ?? '');
      case 'open': return t.doOpen(a.app ?? '');
      case 'answer': return t.addToNote;
      default: return t.doNote;
    }
  };
  const needsText = act && ['whatsapp', 'sms', 'email'].includes(act.kind);
  const needsPhone = act && ['whatsapp', 'sms', 'call'].includes(act.kind);

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBtn name="left" label={t.back} onPress={() => router.back()} />
        <T kind="h2">{t.askAi}</T>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <T kind="body" color={c.ink2}>{t.askAiHint}</T>
        <View style={{ marginTop: 14, flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: c.surface, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, padding: 12 }}>
          <TextInput accessibilityLabel={t.askAiPlaceholder} value={text} onChangeText={(v) => { setText(v); setAct(null); }} placeholder={t.askAiPlaceholder} placeholderTextColor={c.ink3} multiline
            style={{ flex: 1, color: c.ink, fontSize: 17, minHeight: 70, textAlignVertical: 'top' }} />
          <Press accessibilityLabel={listening ? t.tapToStop : t.tapToSpeak} onPress={listen} style={{ width: 46, height: 46, borderRadius: 23, backgroundColor: listening ? c.danger : c.accent, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={listening ? 'stop' : 'mic'} size={22} color={c.onAccent} />
          </Press>
        </View>
        <Btn label={t.doIt} icon="sparkle" style={{ marginTop: 14 }} disabled={!text.trim() || busy} onPress={think} />
        {busy ? <View style={{ marginTop: 14 }}><ActivityIndicator color={c.accent} /></View> : null}
        {act ? (
          <View style={{ marginTop: 18, padding: 16, borderRadius: 20, backgroundColor: c.accentSoft }}>
            <T kind="label">{t.willDo}</T>
            <T kind="h3" style={{ marginTop: 6 }}>{label(act)}</T>
            {act.kind === 'answer' && act.answer ? <T kind="body" style={{ marginTop: 10, fontSize: 16, lineHeight: 24 }}>{act.answer}</T> : null}
            {needsText ? <Field label={t.message} value={act.message ?? ''} onChange={(v) => setAct({ ...act, message: v })} multiline /> : null}
            {needsPhone ? <Field label={t.phoneOptional} value={act.phone ?? ''} onChange={(v) => setAct({ ...act, phone: v })} keyboard="phone-pad" /> : null}
            <Btn label={act.kind === 'answer' ? t.addToNote : t.doIt} icon="check" style={{ marginTop: 14 }} onPress={run} />
            {needsText ? <T kind="small" style={{ marginTop: 8 }}>{t.youPressSend}</T> : null}
          </View>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
