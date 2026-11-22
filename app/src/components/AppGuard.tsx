import React from 'react';
import { Appearance, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { describe, onFatal, recordCrash, takeLastCrash } from '../lib/crash';

type State = { error: string; last: string; copied: boolean };

/**
 * Outermost wrapper. If anything below throws, the person sees a calm screen with
 * "Try again" and "Copy report" instead of Android's "app keeps stopping".
 * It uses no app theme or storage, so it still works when those are what failed.
 */
export class AppGuard extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: '', last: '', copied: false };
  private off?: () => void;

  static getDerivedStateFromError(e: unknown): Partial<State> {
    return { error: describe(e) };
  }

  componentDidCatch(e: unknown) {
    recordCrash(e, 'render');
  }

  componentDidMount() {
    this.off = onFatal((e) => this.setState({ error: describe(e) }));
    const last = takeLastCrash();
    if (last) this.setState({ last });
  }

  componentWillUnmount() { this.off?.(); }

  private copy = async (text: string) => {
    try { await Clipboard.setStringAsync(text); this.setState({ copied: true }); } catch {}
  };

  render() {
    const dark = Appearance.getColorScheme() === 'dark';
    const c = dark
      ? { bg: '#0B0F17', card: '#151B27', text: '#F3F5F9', sub: '#9AA4B5', line: '#232B3A' }
      : { bg: '#F5F6F8', card: '#FFFFFF', text: '#0F172A', sub: '#5B6577', line: '#E4E7EC' };
    const { error, last, copied } = this.state;

    if (error) {
      return (
        <View style={[s.wrap, { backgroundColor: c.bg }]}>
          <Text style={[s.title, { color: c.text }]}>Something went wrong</Text>
          <Text style={[s.sub, { color: c.sub }]}>
            Your notes are safe. Tap “Try again”. If it keeps happening, tap “Copy report” and send it to us on WhatsApp.
          </Text>
          <ScrollView style={[s.box, { backgroundColor: c.card, borderColor: c.line }]}>
            <Text selectable style={[s.mono, { color: c.sub }]}>{error}</Text>
          </ScrollView>
          <View style={s.row}>
            <Pressable style={[s.btn, s.primary]} onPress={() => this.setState({ error: '', copied: false })}>
              <Text style={s.primaryText}>Try again</Text>
            </Pressable>
            <Pressable style={[s.btn, { borderColor: c.line, borderWidth: 1 }]} onPress={() => this.copy(error)}>
              <Text style={[s.btnText, { color: c.text }]}>{copied ? 'Copied' : 'Copy report'}</Text>
            </Pressable>
          </View>
        </View>
      );
    }

    return (
      <View style={{ flex: 1 }}>
        {this.props.children}
        {last ? (
          <View style={[s.banner, { backgroundColor: c.card, borderColor: c.line }]}>
            <Text style={[s.bannerText, { color: c.text }]}>Easy Life closed unexpectedly last time.</Text>
            <View style={s.row}>
              <Pressable style={[s.small, s.primary]} onPress={() => this.copy(last)}>
                <Text style={s.primaryText}>{copied ? 'Copied' : 'Copy report'}</Text>
              </Pressable>
              <Pressable style={[s.small, { borderColor: c.line, borderWidth: 1 }]} onPress={() => this.setState({ last: '', copied: false })}>
                <Text style={[s.btnText, { color: c.text }]}>Dismiss</Text>
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    );
  }
}

const s = StyleSheet.create({
  wrap: { flex: 1, padding: 24, paddingTop: 72 },
  title: { fontSize: 24, fontWeight: '700', marginBottom: 8 },
  sub: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  box: { flex: 1, borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 16 },
  mono: { fontFamily: 'monospace', fontSize: 11, lineHeight: 16 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { flex: 1, height: 50, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  small: { paddingHorizontal: 14, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  primary: { backgroundColor: '#4B3BE0' },
  primaryText: { color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
  btnText: { fontWeight: '600', fontSize: 15 },
  banner: { position: 'absolute', left: 16, right: 16, bottom: 110, borderWidth: 1, borderRadius: 16, padding: 14, gap: 10,
    shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 12, elevation: 6 },
  bannerText: { fontSize: 14, fontWeight: '600' },
});
