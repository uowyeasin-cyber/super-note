// Settings: the person's AI keys (any service), plus the owner's one-time sign-in that
// copies every change to the server.
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Linking, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useApp } from '../lib/store';
import { testKey } from '../lib/ai';
import { detect, mask, parseRing, PROVIDERS, ringText, type AiKey, type ProviderId } from '../lib/providers';
import { ownerSignIn, ownerSignOut, ownerToken, syncKeys } from '../lib/owner';
import { Icon } from './Icon';
import { Field } from './Field';
import { Btn, Chip, IconBtn, Press, T, toast } from './ui';

const CHOICES: (ProviderId | 'auto')[] = ['auto', 'gemini', 'groq', 'openai', 'openrouter', 'xai', 'deepseek', 'mistral', 'anthropic', 'custom'];

export function AiKeys() {
  const { c, t, s, set, pro } = useApp();
  const keys = parseRing(s.aiKey);
  const [key, setKey] = useState('');
  const [choice, setChoice] = useState<ProviderId | 'auto'>('auto');
  const [url, setUrl] = useState('');
  const [model, setModel] = useState('');
  const [busy, setBusy] = useState(false);

  const [owner, setOwner] = useState(!!ownerToken());
  const [openOwner, setOpenOwner] = useState(false);
  const [email, setEmail] = useState('');
  const [pw, setPw] = useState('');
  const [server, setServer] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);

  const sync = async (ring?: string) => {
    if (!ownerToken()) return;
    setSyncing(true);
    const r = await syncKeys(ring);
    setSyncing(false);
    if (r) setServer(r.length);
    else { setOwner(!!ownerToken()); if (ring !== undefined) toast(t.syncFail); }
  };
  useEffect(() => { if (owner) sync(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const save = (list: AiKey[]) => {
    const ring = ringText(list);
    set({ aiKey: ring });
    if (ownerToken()) sync(ring);
  };

  const add = async () => {
    const raw = key.trim();
    if (!raw) return;
    if (keys.some((k) => k.key === raw)) { toast(t.keyTwice); return; }
    const provider = choice === 'auto' ? detect(raw) : choice;
    if (provider === 'custom' && !/^https:\/\//.test(url.trim())) { toast(t.baseUrl); return; }
    const k: AiKey = { provider, key: raw };
    if (model.trim()) k.model = model.trim();
    if (provider === 'custom') k.url = url.trim().replace(/\/+$/, '');
    setBusy(true);
    const ok = await testKey(k, s.aiModel);
    setBusy(false);
    if (!ok) { toast(t.keyBad); return; }
    save([...keys, k]);
    setKey(''); setModel(''); setUrl(''); setChoice('auto');
    toast(t.keyWorks);
  };

  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= keys.length) return;
    const list = [...keys];
    [list[i], list[j]] = [list[j], list[i]];
    save(list);
  };

  const signIn = async () => {
    if (!email.trim() || !pw) return;
    setSyncing(true);
    const r = await ownerSignIn(email, pw);
    setSyncing(false);
    if (r === 'wrong') { toast(t.wrongLogin); return; }
    if (r === 'offline') { toast(t.syncFail); return; }
    setPw(''); setOwner(true); setOpenOwner(false);
    sync(keys.length ? s.aiKey : undefined);
  };

  const shown: ProviderId = choice === 'auto' ? (key.trim() ? detect(key) : 'gemini') : choice;
  const card = { backgroundColor: c.surface, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, overflow: 'hidden' as const };

  return (
    <View>
      <T kind="small" style={{ marginBottom: 10 }}>{t.aiKeysHint}</T>

      <View style={card}>
        {keys.length === 0 ? (
          <View style={{ padding: 16, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
            <Icon name="sparkle" size={18} color={pro ? c.accent : c.ink3} />
            <T kind="small" style={{ flex: 1 }}>{pro ? t.aiOn + ' · Pro' : t.noKeys}</T>
          </View>
        ) : keys.map((k, i) => (
          <View key={k.key} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingLeft: 16, paddingRight: 6, paddingVertical: 8, borderBottomWidth: i === keys.length - 1 ? 0 : StyleSheet.hairlineWidth, borderBottomColor: c.line }}>
            <View style={{ width: 26, height: 26, borderRadius: 13, backgroundColor: i === 0 ? c.accent : c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <T kind="small" color={i === 0 ? c.onAccent : c.accent} style={{ fontWeight: '700' }}>{i + 1}</T>
            </View>
            <View style={{ flex: 1 }}>
              <T kind="h3" style={{ fontSize: 15 }}>{PROVIDERS[k.provider].name}</T>
              <T kind="small">{mask(k.key)}{k.model ? ' · ' + k.model : ''}</T>
            </View>
            {i > 0 ? <IconBtn name="up" label="Up" onPress={() => move(i, -1)} /> : null}
            <IconBtn name="trash" label={t.removeKey} onPress={() => save(keys.filter((_, x) => x !== i))} />
          </View>
        ))}
      </View>

      <T kind="small" style={{ marginTop: 16, marginBottom: 6 }}>{t.serviceLabel}</T>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {CHOICES.map((p) => <Chip key={p} label={p === 'auto' ? t.auto : PROVIDERS[p].name} active={choice === p} onPress={() => setChoice(p)} />)}
      </ScrollView>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10, backgroundColor: c.surface, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, borderColor: c.line, paddingHorizontal: 14, height: 50 }}>
        <Icon name="sparkle" size={18} color={key ? c.accent : c.ink3} />
        <TextInput accessibilityLabel={t.aiKeyPlaceholder} value={key} onChangeText={setKey} placeholder={t.aiKeyPlaceholder} placeholderTextColor={c.ink3} secureTextEntry autoCapitalize="none" autoCorrect={false} style={{ flex: 1, color: c.ink, fontSize: 15 }} />
        {key.trim() ? <T kind="small" color={c.accent}>{PROVIDERS[shown].name}</T> : null}
      </View>
      {shown === 'custom' ? <Field label={t.baseUrl} value={url} onChange={setUrl} keyboard="email-address" placeholder="https://…/v1" /> : null}
      {key.trim() ? <Field label={t.modelOpt} value={model} onChange={setModel} keyboard="email-address" /> : null}
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
        <Btn style={{ flex: 1 }} icon="plus" label={busy ? '…' : t.addKey} disabled={busy || !key.trim()} onPress={add} />
        <Btn style={{ flex: 1 }} kind="ghost" label={t.getKey} onPress={() => Linking.openURL(PROVIDERS[shown === 'custom' ? 'gemini' : shown].keyUrl)} />
      </View>
      {busy ? <ActivityIndicator style={{ marginTop: 8 }} color={c.accent} /> : null}

      <View style={[card, { marginTop: 18 }]}>
        <Press onPress={() => !owner && setOpenOwner(!openOwner)}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 16 }}>
            <View style={{ width: 34, height: 34, borderRadius: 11, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name="shield" size={18} color={c.accent} />
            </View>
            <View style={{ flex: 1 }}>
              <T kind="h3" style={{ fontSize: 15 }}>{t.ownerTitle}</T>
              <T kind="small" style={{ marginTop: 2 }} color={owner ? c.ok : undefined}>
                {owner ? '● ' + t.ownerOn + (server !== null ? ' · ' + t.serverHas.replace('{n}', String(server)) : '') : t.ownerHint}
              </T>
            </View>
            {syncing ? <ActivityIndicator color={c.accent} /> : owner ? null : <Icon name={openOwner ? 'up' : 'down'} size={18} color={c.ink3} />}
          </View>
        </Press>
        {owner ? (
          <View style={{ flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingBottom: 16 }}>
            <Btn style={{ flex: 1 }} kind="ghost" icon="repeat" label={t.syncNow} disabled={syncing} onPress={() => sync(s.aiKey)} />
            <Btn style={{ flex: 1 }} kind="ghost" label={t.signOutBtn} onPress={() => { ownerSignOut(); setOwner(false); setServer(null); }} />
          </View>
        ) : openOwner ? (
          <View style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
            <Field label={t.email} value={email} onChange={setEmail} keyboard="email-address" />
            <Field label={t.passwordLabel} value={pw} onChange={setPw} secure />
            <Btn style={{ marginTop: 12 }} label={syncing ? '…' : t.signInBtn} disabled={syncing} onPress={signIn} />
          </View>
        ) : null}
      </View>
    </View>
  );
}
