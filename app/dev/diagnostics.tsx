import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { TelemetryService } from '../../services/TelemetryService';
import { PerfTraceRecord } from '../../utils/perfTrace';

export default function DiagnosticsScreen() {
  const [traces, setTraces] = useState<PerfTraceRecord[]>([]);
  const [p, setP] = useState<{ p50: number | null; p95: number | null; samples: number }>({ p50: null, p95: null, samples: 0 });

  useEffect(() => {
    setTraces(TelemetryService.getRecentTraces(20));
    TelemetryService.fetchPercentiles().then(setP).catch(() => {});
  }, []);

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: 16 }}>
      <Text style={styles.h1}>Diagnostics</Text>

      <View style={styles.card}>
        <Text style={styles.h2}>Audio Pipeline percentiles</Text>
        <Text style={styles.text}>Samples: {p.samples}</Text>
        <Text style={styles.text}>p50: {p.p50 ?? '-'} ms</Text>
        <Text style={styles.text}>p95: {p.p95 ?? '-'} ms</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.h2}>Recent Traces</Text>
        {traces.length === 0 ? (
          <Text style={styles.text}>No recent traces</Text>
        ) : traces.map(t => (
          <View key={t.id} style={styles.trace}>
            <Text style={styles.h3}>{t.name}</Text>
            <Text style={styles.text}>Status: {t.status}</Text>
            <Text style={styles.text}>Duration: {t.metrics?.durationMs} ms</Text>
            <Text style={styles.text}>TTFP: {t.metrics?.ttfpMs ?? '-'} ms</Text>
            <Text style={styles.text}>TTC: {t.metrics?.ttcMs ?? '-'} ms</Text>
            {t.marks.length > 0 && (
              <View style={styles.marks}>
                {t.marks.map((m, idx) => (
                  <Text key={idx} style={styles.mark}>• {m.label} @ {m.at - t.startTime} ms</Text>
                ))}
              </View>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0b1020' },
  h1: { fontSize: 24, fontWeight: '700', color: '#e5e7eb', marginBottom: 12 },
  h2: { fontSize: 18, fontWeight: '600', color: '#e5e7eb', marginBottom: 8 },
  h3: { fontSize: 16, fontWeight: '600', color: '#cbd5e1' },
  text: { color: '#cbd5e1', marginBottom: 4 },
  card: { backgroundColor: '#111827', borderRadius: 8, padding: 12, marginBottom: 16 },
  trace: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: '#374151', paddingTop: 8, marginTop: 8 },
  marks: { marginTop: 6 },
  mark: { color: '#9ca3af', fontSize: 12 },
});
