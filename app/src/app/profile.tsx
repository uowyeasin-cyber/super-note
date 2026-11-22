import React, { useState } from 'react';
import { KeyboardAvoidingView, ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { useApp } from '../lib/store';
import { kvGet, kvSet } from '../lib/db';
import { cvHtml, EMPTY_PROFILE, type Profile } from '../lib/profile';
import { Btn, IconBtn, T, toast } from '../components/ui';
import { Field } from '../components/Field';

function load(): Profile {
  try { return { ...EMPTY_PROFILE, ...JSON.parse(kvGet('profile') || '{}') }; } catch { return EMPTY_PROFILE; }
}

/** My profile: filled once, kept on the phone, turned into a CV / intro PDF to share. */
export default function ProfileScreen() {
  const { c, t } = useApp();
  const insets = useSafeAreaInsets();
  const [p, setP] = useState<Profile>(load);
  const [busy, setBusy] = useState(false);
  const field = (k: keyof Profile) => (v: string) => setP((old) => { const next = { ...old, [k]: v }; kvSet('profile', JSON.stringify(next)); return next; });

  async function pdf() {
    if (!p.name.trim()) { toast(t.fullName); return; }
    setBusy(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: cvHtml(p, { about: t.aboutMe, education: t.education, experience: t.experience, skills: t.skills }) });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: p.name });
      else toast(uri);
    } catch {
      toast(t.pdfFailed);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBtn name="left" label={t.back} onPress={() => router.back()} />
        <T kind="h2">{t.profile}</T>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20, paddingBottom: 60 }}>
        <T kind="body" color={c.ink2}>{t.profileHint}</T>
        <Field label={t.fullName} value={p.name} onChange={field('name')} />
        <Field label={t.headline} value={p.headline} onChange={field('headline')} />
        <Field label={t.phone} value={p.phone} onChange={field('phone')} keyboard="phone-pad" />
        <Field label={t.email} value={p.email} onChange={field('email')} keyboard="email-address" />
        <Field label={t.aboutMe} value={p.about} onChange={field('about')} multiline />
        <Field label={t.education} value={p.education} onChange={field('education')} multiline />
        <Field label={t.experience} value={p.experience} onChange={field('experience')} multiline />
        <Field label={t.skillList} value={p.skills} onChange={field('skills')} />
        <Btn label={busy ? t.saving : t.makePdf} icon="share" style={{ marginTop: 20 }} disabled={busy} onPress={pdf} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
