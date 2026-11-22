import React, { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Linking, ScrollView, Share, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../lib/store';
import { aiAvailable } from '../lib/brain';
import { writeMessage } from '../lib/study';
import { smsUrl, whatsappUrl, type Tone } from '../lib/message';
import { Btn, Chip, IconBtn, T, toast } from '../components/ui';
import { Field } from '../components/Field';

/** Write a message: say what you mean, get a clean message, send it on WhatsApp or SMS. */
export default function MessageScreen() {
  const { c, t, s, pro, plan } = useApp();
  const insets = useSafeAreaInsets();
  const [what, setWhat] = useState('');
  const [tone, setTone] = useState<Tone>('polite');
  const [lang, setLang] = useState<'en' | 'bn'>(s.lang === 'bn' ? 'bn' : 'en');
  const [out, setOut] = useState('');
  const [phone, setPhone] = useState('');
  const [busy, setBusy] = useState(false);
  const ctx = { key: s.aiKey, model: s.aiModel, pro, plan };

  async function write() {
    if (!what.trim()) return;
    if (!aiAvailable(ctx)) { setOut(what.trim()); toast(t.aiNeeded); return; }
    setBusy(true);
    const r = await writeMessage(what, tone, lang, ctx);
    setBusy(false);
    setOut(r ?? what.trim());
  }
  const open = (url: string) => Linking.openURL(url).catch(() => Share.share({ message: out }));

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBtn name="left" label={t.back} onPress={() => router.back()} />
        <T kind="h2">{t.message}</T>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <T kind="body" color={c.ink2}>{t.messageHint}</T>
        <Field label={t.messageWhat} value={what} onChange={setWhat} multiline />
        <T kind="small" style={{ marginTop: 14, marginBottom: 6 }}>{t.tone}</T>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {(['polite', 'formal', 'friendly'] as Tone[]).map((x) => <Chip key={x} label={t[x]} active={tone === x} onPress={() => setTone(x)} />)}
          <Chip label="বাংলা" active={lang === 'bn'} onPress={() => setLang('bn')} />
          <Chip label="English" active={lang === 'en'} onPress={() => setLang('en')} />
        </View>
        <Btn label={t.writeIt} icon="sparkle" style={{ marginTop: 16 }} disabled={!what.trim() || busy} onPress={write} />
        {busy ? <View style={{ marginTop: 14 }}><ActivityIndicator color={c.accent} /></View> : null}
        {out ? (
          <>
            <Field label={t.message} value={out} onChange={setOut} multiline />
            <Field label={t.phoneOptional} value={phone} onChange={setPhone} keyboard="phone-pad" />
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
              <Btn label={t.whatsapp} icon="send" style={{ flex: 1 }} onPress={() => open(whatsappUrl(phone, out))} />
              <Btn label={t.sms} icon="message" kind="ghost" style={{ flex: 1 }} onPress={() => open(smsUrl(phone, out))} />
            </View>
            <Btn label={t.share} icon="share" kind="ghost" style={{ marginTop: 10 }} onPress={() => Share.share({ message: out })} />
          </>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
