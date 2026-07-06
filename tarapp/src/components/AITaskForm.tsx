import { useState } from 'react';
import { StyleSheet, View, Text, TextInput, Pressable, ActivityIndicator, ScrollView } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useTheme } from '@/hooks/use-theme';
import { AITask } from './AITaskCard';

interface AITaskFormProps {
  task: AITask;
  onSubmit: (values: Record<string, any>) => void;
  onCancel: () => void;
  executing: boolean;
}

const humanizeLabel = (name: string) => {
  return name
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
};

export function AITaskForm({ task, onSubmit, onCancel, executing }: AITaskFormProps) {
  const theme = useTheme();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  const handleInputChange = (paramName: string, text: string) => {
    setValues(prev => ({ ...prev, [paramName]: text }));
    if (errors[paramName]) {
      setErrors(prev => {
        const next = { ...prev };
        delete next[paramName];
        return next;
      });
    }
  };

  const handleSubmit = () => {
    const nextErrors: Record<string, string> = {};
    const submitValues: Record<string, any> = {};

    for (const param of task.params) {
      const val = (values[param.name] || '').trim();

      if (param.required && !val) {
        nextErrors[param.name] = `${humanizeLabel(param.name)} is required`;
      } else if (val) {
        if (param.type === 'number') {
          const num = parseFloat(val);
          if (isNaN(num)) {
            nextErrors[param.name] = `${humanizeLabel(param.name)} must be a number`;
          } else {
            submitValues[param.name] = num;
          }
        } else {
          submitValues[param.name] = val;
        }
      }
    }

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

    onSubmit(submitValues);
  };

  const humanizedTitle = task.name
    .replace(/^action_/i, '')
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');

  return (
    <View style={[styles.container, { backgroundColor: theme.backgroundElement, borderColor: theme.border }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>
            {humanizedTitle}
          </Text>
          <Pressable onPress={onCancel} style={styles.closeBtn} disabled={executing}>
            <Ionicons name="close" size={20} color={theme.textMuted} />
          </Pressable>
        </View>
        <Text style={[styles.purpose, { color: theme.textMuted }]}>
          {task.purpose}
        </Text>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
        {task.params.map(param => {
          const hasError = !!errors[param.name];
          const label = humanizeLabel(param.name);
          const placeholder = `${label}${param.required ? ' (Required)' : ' (Optional)'}`;

          return (
            <View key={param.name} style={styles.field}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {label} {param.required && <Text style={styles.asterisk}>*</Text>}
              </Text>
              <TextInput
                style={[
                  styles.input,
                  {
                    backgroundColor: theme.background,
                    color: theme.text,
                    borderColor: hasError ? '#FF3B30' : theme.border,
                  },
                ]}
                value={values[param.name] || ''}
                onChangeText={text => handleInputChange(param.name, text)}
                placeholder={placeholder}
                placeholderTextColor={theme.textMuted}
                keyboardType={param.type === 'number' ? 'numeric' : 'default'}
                editable={!executing}
              />
              {hasError && (
                <Text style={styles.errorText}>{errors[param.name]}</Text>
              )}
            </View>
          );
        })}
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: theme.border }]}>
        <Pressable
          style={[styles.btn, styles.cancelBtn, { borderColor: theme.border }]}
          onPress={onCancel}
          disabled={executing}
        >
          <Text style={[styles.btnText, { color: theme.text }]}>Cancel</Text>
        </Pressable>

        <Pressable
          style={[styles.btn, styles.submitBtn, { backgroundColor: theme.primary }]}
          onPress={handleSubmit}
          disabled={executing}
        >
          {executing ? (
            <ActivityIndicator color="#fff" size="small" />
          ) : (
            <>
              <Ionicons name="play" size={14} color="#fff" />
              <Text style={[styles.btnText, { color: '#fff', fontWeight: '600' }]}>Execute</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    maxHeight: 450,
  },
  header: {
    marginBottom: 14,
  },
  titleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    flex: 1,
  },
  closeBtn: {
    padding: 4,
  },
  purpose: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  scroll: {
    maxHeight: 280,
  },
  scrollContent: {
    paddingBottom: 8,
  },
  field: {
    marginBottom: 12,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 6,
  },
  asterisk: {
    color: '#FF3B30',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  errorText: {
    color: '#FF3B30',
    fontSize: 11,
    marginTop: 4,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 8,
  },
  btn: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  cancelBtn: {
    borderWidth: 1,
  },
  submitBtn: {
    minWidth: 100,
  },
  btnText: {
    fontSize: 13,
  },
});
