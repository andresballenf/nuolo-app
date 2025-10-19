import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { TelemetryService } from '../../services/TelemetryService';
import { getFeatureFlag, initFeatureFlags, subscribe } from '../../config/featureFlags';
import { PerfTracer, PerfTraceRecord } from '../../utils/perfTrace';
import { router } from 'expo-router';

export function DiagnosticsOverlay() {
  const [visible, setVisible] = useState(false);
  const [traces, setTraces] = useState<PerfTraceRecord[]>([]);

  useEffect(() => {
    let unsub: (() => void) | null = null;
    (async () => {
      await initFeatureFlags();
      setVisible(getFeatureFlag('perf_overlay_enabled'));
      unsub = subscribe((flags) => setVisible(flags.perf_overlay_enabled));
    })();
    return () => { if (unsub) unsub(); };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setTraces(TelemetryService.getRecentTraces(5));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  if (!visible) return null;

  return (
    <View style={styles.container} pointerEvents="box-none">
      <View style={styles.panel}>
        <View style={styles.header}>
          <Text style={styles.title}>Diagnostics</Text>
          <TouchableOpacity onPress={() => router.push('/dev/diagnostics')}>
            <Text style={styles.link}>Open</Text>
          </TouchableOpacity>
        </View>
        {traces.length === 0 ? (
          <Text style={styles.small}>No recent traces</Text>
        ) : traces.map(t => (
          <View key={t.id} style={styles.row}>
            <Text numberOfLines={1} style={styles.small}>{t.name}</Text>
            <Text style={styles.small}>{t.metrics?.ttfpMs ? `${t.metrics.ttfpMs} ms` : '-'} / {t.metrics?.ttcMs ?? t.metrics?.durationMs} ms</Text>
            <Text style={[styles.small, { color: t.status === 'success' ? '#16a34a' : '#dc2626' }]}>{t.status}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'flex-end',
    justifyContent: 'flex-start',
  },
  panel: {
    marginTop: 50,
    marginRight: 8,
    backgroundColor: 'rgba(0,0,0,0.75)',
    borderRadius: 8,
    padding: 8,
    minWidth: 220,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  title: { color: '#fff', fontWeight: '600' },
  link: { color: '#60a5fa' },
  small: { color: '#e5e7eb', fontSize: 12 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 2 },
});
