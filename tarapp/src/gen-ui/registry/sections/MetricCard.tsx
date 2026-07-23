import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export interface MetricCardProps {
  props?: {
    title?: string;
    subtitle?: string;
    value?: string | number;
    unit?: string;
    backgroundColor?: string;
    months?: string[];
    data?: number[];
  };
  designTokens?: any;
}

export default function MetricCard({ props }: MetricCardProps) {
  const title = props?.title || 'Request';
  const subtitle = props?.subtitle || 'Analytics';
  const value = props?.value ?? '893,283';
  const unit = props?.unit || 'All Time';
  const bg = props?.backgroundColor || '#52ffe1'; // Signature Mint Cyan
  const months = Array.isArray(props?.months) ? props.months : ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'];
  
  // High density data points for smooth line graph wave (guarded against string/non-array props)
  const defaultDataPoints = [
    30, 48, 35, 52, 40, 75, 42, 58, 62, 50, 70, 38, 48, 65, 60, 78, 72, 85, 75, 80, 82, 78, 88, 85, 90
  ];
  const dataPoints = Array.isArray(props?.data) ? props.data : defaultDataPoints;
  const maxVal = Math.max(...dataPoints, 100);

  return (
    <View style={[styles.card, { backgroundColor: bg }]}>
      {/* Top Left Title Stack */}
      <View style={styles.titleContainer}>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
      </View>

      {/* Middle Wave Line Chart with Soft Gradient Fill */}
      <View style={styles.chartSection}>
        <View style={styles.chartLineContainer}>
          {dataPoints.map((val: number, idx: number) => {
            const heightPct = (val / maxVal) * 100;
            const isPeak = idx > 0 && val > dataPoints[idx - 1] && (idx < dataPoints.length - 1 ? val > dataPoints[idx + 1] : true);
            return (
              <View key={idx} style={styles.chartCol}>
                <View style={[styles.chartAreaFill, { height: `${heightPct}%` }]} />
                <View
                  style={[
                    styles.chartLinePoint,
                    { bottom: `${heightPct}%` },
                    isPeak && styles.peakPoint
                  ]}
                />
              </View>
            );
          })}
        </View>

        {/* Month Labels Axis */}
        <View style={styles.monthsRow}>
          {months.map((m: string, i: number) => (
            <Text key={i} style={styles.monthLabel}>
              {m}
            </Text>
          ))}
        </View>
      </View>

      {/* Bottom Left Big Metric & Subtitle */}
      <View style={styles.bottomRow}>
        <Text style={styles.valueText}>{value}</Text>
        <Text style={styles.unitText}>{unit}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 24,
    padding: 24,
    minHeight: 260,
    justifyContent: 'space-between',
    marginVertical: 8,
    borderWidth: 0,
  },
  titleContainer: {
    marginBottom: 8,
  },
  title: {
    fontSize: 34,
    fontWeight: '800',
    color: '#041d18',
    letterSpacing: -0.8,
    lineHeight: 38,
  },
  subtitle: {
    fontSize: 30,
    fontWeight: '400',
    color: '#1a7565',
    letterSpacing: -0.5,
    lineHeight: 34,
  },
  chartSection: {
    marginVertical: 12,
    height: 110,
    justifyContent: 'flex-end',
  },
  chartLineContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    height: 80,
    width: '100%',
    paddingHorizontal: 4,
  },
  chartCol: {
    flex: 1,
    height: '100%',
    justifyContent: 'flex-end',
    alignItems: 'center',
    position: 'relative',
  },
  chartAreaFill: {
    width: '100%',
    backgroundColor: 'rgba(4, 29, 24, 0.08)',
    borderTopLeftRadius: 2,
    borderTopRightRadius: 2,
  },
  chartLinePoint: {
    position: 'absolute',
    width: 2.5,
    height: 2.5,
    borderRadius: 1.5,
    backgroundColor: '#1a7565',
  },
  peakPoint: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#041d18',
  },
  monthsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
    paddingHorizontal: 4,
  },
  monthLabel: {
    fontSize: 12,
    fontWeight: '500',
    color: '#1a7565',
    opacity: 0.8,
  },
  bottomRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    marginTop: 8,
  },
  valueText: {
    fontSize: 42,
    fontWeight: '800',
    color: '#041d18',
    letterSpacing: -1,
    marginRight: 10,
  },
  unitText: {
    fontSize: 26,
    fontWeight: '400',
    color: '#1a7565',
    letterSpacing: -0.3,
  },
});
