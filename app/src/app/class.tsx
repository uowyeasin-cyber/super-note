import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../lib/store';
import { files } from '../lib/db';
import { Btn, Chip, IconBtn, T } from '../components/ui';
import { Field } from '../components/Field';

/** Class mode: pick the class, then the mic keeps listening for the whole class and files it there. */
export default function ClassSetup() {
  const { c, t, version } = useApp();
  const insets = useSafeAreaInsets();
  const classes = useMemo(() => { void version; return files().filter((f) => f.area === 'academic').map((f) => f.topic); }, [version]);
  const [name, setName] = useState(classes[0] ?? '');
  const go = () => {
    const topic = name.trim();
    if (!topic) return;
    router.replace({ pathname: '/capture', params: { mode: 'class', area: 'academic', topic } });
  };
  return (
    <View style={{ flex: 1, backgroundColor: c.bg }}>
      <View style={{ paddingTop: insets.top + 10, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <IconBtn name="left" label={t.back} onPress={() => router.back()} />
        <T kind="h2">{t.classMode}</T>
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 20 }}>
        <T kind="body" color={c.ink2}>{t.classHint}</T>
        {classes.length ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 16 }}>
            {classes.map((x) => <Chip key={x} label={x} icon="school" active={x === name} onPress={() => setName(x)} />)}
          </View>
        ) : null}
        <Field label={t.className} value={name} onChange={setName} />
        <Btn label={t.startClass} icon="mic" style={{ marginTop: 20 }} disabled={!name.trim()} onPress={go} />
      </ScrollView>
    </View>
  );
}
