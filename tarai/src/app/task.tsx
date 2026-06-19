import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, Pressable, View, TextInput, Text, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { useFormById } from '@/hooks/use-form';
import { type MatterRow } from '@/hooks/use-matter';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

interface Subtask {
  id: string;
  title: string;
  done: boolean;
}

const REMINDER_OPTIONS = [
  'At time of event',
  '5 minutes before',
  '15 minutes before',
  '30 minutes before',
  '1 hour before',
  '1 day before',
  '2 days before',
];

const REPEAT_OPTIONS = [
  'Don\'t repeat',
  'Daily',
  'Weekly',
  'Monthly',
  'Yearly',
];

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

function isSameDay(d1: Date | null, d2: Date): boolean {
  if (!d1) return false;
  return d1.toDateString() === d2.toDateString();
}

function isTomorrow(d1: Date | null): boolean {
  if (!d1) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return d1.toDateString() === tomorrow.toDateString();
}

function isNextWeek(d1: Date | null): boolean {
  if (!d1) return false;
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  return d1.toDateString() === nextWeek.toDateString();
}

export default function TaskDetailScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const params = useLocalSearchParams<{ id: string }>();
  const { row: task, loading: taskLoading } = useFormById(params.id);

  const [matter, setMatter] = useState<MatterRow | null>(null);
  const [localTitle, setLocalTitle] = useState('');
  const [subtasks, setSubtasks] = useState<Subtask[]>([]);
  const [newSubtask, setNewSubtask] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [dueDate, setDueDate] = useState<Date | null>(null);
  const [reminder, setReminder] = useState<string | null>(null);
  const [showReminderOptions, setShowReminderOptions] = useState(false);
  const [repeat, setRepeat] = useState<string>('Don\'t repeat');
  const [showRepeatOptions, setShowRepeatOptions] = useState(false);
  const [showTimePicker, setShowTimePicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);

  const loadMatter = useCallback(async () => {
    if (!task) return;
    const m = await db.getFirstAsync<MatterRow>(
      "SELECT * FROM matter WHERE form = ? AND type = 'task_state' AND active = 1 LIMIT 1",
      task.id
    );
    console.log(`[TASK] Matter for ${task.id}: ${m ? 'found' : 'not found'}`);
    setMatter(m);
    if (m) {
      const d = parseData(m.data);
      setSubtasks(d.subtasks || []);
      if (d.dueDate) setDueDate(new Date(d.dueDate));
      setReminder(d.reminder || null);
      setRepeat(d.repeat || 'Don\'t repeat');
    }
  }, [db, task]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (task) setLocalTitle(task.title);
    loadMatter();
  }, [task, loadMatter]);

  const saveMatter = async (updates: Record<string, any>) => {
    if (!matter) return;
    const data = parseData(matter.data);
    const merged = { ...data, ...updates };
    console.log(`[TASK] Save matter: ${matter.id}`, merged);
    await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', JSON.stringify(merged), matter.id);
    await loadMatter();
  };

  const handleSaveTitle = async () => {
    if (!task || !localTitle.trim()) return;
    console.log(`[TASK] Save title: ${task.id} → "${localTitle.trim()}"`);
    await db.runAsync('UPDATE form SET title = ? WHERE id = ?', localTitle.trim(), task.id);
  };

  const handleToggleSubtask = (id: string) => {
    const updated = subtasks.map(s => s.id === id ? { ...s, done: !s.done } : s);
    setSubtasks(updated);
    saveMatter({ subtasks: updated });
  };

  const handleUpdateSubtaskTitle = (id: string, newTitle: string) => {
    const updated = subtasks.map(s => s.id === id ? { ...s, title: newTitle } : s);
    setSubtasks(updated);
    saveMatter({ subtasks: updated });
  };

  const handleAddSubtask = () => {
    if (!newSubtask.trim()) return;
    const sub: Subtask = { id: `sub_${Date.now()}`, title: newSubtask.trim(), done: false };
    const updated = [...subtasks, sub];
    setSubtasks(updated);
    setNewSubtask('');
    saveMatter({ subtasks: updated });
  };

  const handleSetDueDate = (date: Date) => {
    setDueDate(date);
    saveMatter({ dueDate: date.toISOString() });
  };

  const handleClearDueDate = () => {
    setDueDate(null);
    saveMatter({ dueDate: null });
  };

  const handleSetReminder = (r: string | null) => {
    setReminder(r);
    setShowReminderOptions(false);
    saveMatter({ reminder: r });
  };

  const handleSetRepeat = (r: string) => {
    setRepeat(r);
    setShowRepeatOptions(false);
    saveMatter({ repeat: r });
  };

  const handleDeleteTask = async () => {
    if (!task) return;
    console.log(`[TASK] Delete task: ${task.id}`);
    await db.runAsync('UPDATE form SET active = 0 WHERE id = ?', task.id);
    await db.runAsync('UPDATE matter SET active = 0 WHERE form = ?', task.id);
    await db.runAsync('DELETE FROM motion WHERE stream = ?', task.id);
    setShowMenu(false);
  };

  const handleArchiveTask = async () => {
    if (!matter) return;
    const data = parseData(matter.data);
    data.status = 'done';
    console.log(`[TASK] Archive task: ${matter.id}`);
    await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', JSON.stringify(data), matter.id);
    setShowMenu(false);
  };

  const formatDueDate = () => {
    if (!dueDate) return 'Today';
    const d = dueDate;
    const today = new Date();

    if (d.toDateString() === today.toDateString()) return 'Today';
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (d.toDateString() === tomorrow.toDateString()) return 'Tomorrow';
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${months[d.getMonth()]} ${d.getDate()}`;
  };

  const formatDueTime = () => {
    if (!dueDate) return '';
    const hours = dueDate.getHours();
    const minutes = dueDate.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const h = hours % 12 || 12;
    const m = minutes.toString().padStart(2, '0');
    return `${h}:${m} ${ampm}`;
  };

  const renderCalendar = () => {
    const calYear = dueDate ? dueDate.getFullYear() : new Date().getFullYear();
    const calMonth = dueDate ? dueDate.getMonth() : new Date().getMonth();
    const daysInMonth = getDaysInMonth(calYear, calMonth);
    const firstDay = getFirstDayOfMonth(calYear, calMonth);
    const days = [];

    for (let i = 0; i < firstDay; i++) {
      days.push(<View key={`empty-${i}`} style={styles.calendarDay} />);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateObj = new Date(calYear, calMonth, day);
      const isSelected = dueDate && dueDate.toDateString() === dateObj.toDateString();
      const isToday = new Date().toDateString() === dateObj.toDateString();

      days.push(
        <Pressable
          key={day}
          style={[styles.calendarDay, isSelected && styles.calendarDaySelected]}
          onPress={() => {
            const newDate = dueDate ? new Date(dueDate) : new Date();
            newDate.setFullYear(calYear, calMonth, day);
            handleSetDueDate(newDate);
          }}>
          <Text style={[styles.calendarDayText, { color: isSelected ? '#fff' : isToday ? '#FF3B30' : theme.text }]}>
            {day}
          </Text>
        </Pressable>
      );
    }

    return days;
  };

  if (taskLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  if (!task) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: theme.text, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>Task not found</Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }}>
        {/* Title with circle and menu */}
        <View style={styles.titleRow}>
          <Pressable onPress={() => {
            if (matter) {
              const data = parseData(matter.data);
              const newStatus = data.status === 'done' ? 'todo' : 'done';
              data.status = newStatus;
              saveMatter({ status: newStatus });
            }
          }}>
            <View style={[styles.circle, { borderColor: matter && parseData(matter.data).status === 'done' ? '#34C759' : theme.textSecondary, backgroundColor: matter && parseData(matter.data).status === 'done' ? '#34C759' : 'transparent' }]}>
              {matter && parseData(matter.data).status === 'done' && <Ionicons name="checkmark" size={14} color="#fff" />}
            </View>
          </Pressable>
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            value={localTitle}
            onChangeText={setLocalTitle}
            onBlur={handleSaveTitle}
            placeholder="Task title"
            placeholderTextColor={theme.textSecondary}
            multiline
          />
          <Pressable onPress={() => setShowMenu(true)} style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Metadata Chips */}
        <View style={styles.chipsRow}>
          <Pressable style={[styles.chip, { backgroundColor: theme.backgroundElement }]} onPress={() => setShowDatePicker(true)}>
            <Ionicons name="calendar-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.chipText, { color: theme.text }]}>{formatDueDate()}</Text>
            {dueDate && <Text style={[styles.chipText, { color: theme.textSecondary }]}> {formatDueTime()}</Text>}
          </Pressable>

          <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
            <Ionicons name="person-outline" size={14} color={theme.textSecondary} />
            <Text style={[styles.chipText, { color: theme.textSecondary }]}>Assignee</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

        {/* Subtasks - editable inline */}
        {subtasks.map((sub) => (
          <View key={sub.id} style={styles.subtaskRow}>
            <Pressable onPress={() => handleToggleSubtask(sub.id)}>
              <View style={[styles.subtaskCircle, { borderColor: sub.done ? '#34C759' : theme.textSecondary, backgroundColor: sub.done ? '#34C759' : 'transparent' }]}>
                {sub.done && <Ionicons name="checkmark" size={12} color="#fff" />}
              </View>
            </Pressable>
            <TextInput
              style={[styles.subtaskInput, { color: sub.done ? theme.textSecondary : theme.text, textDecorationLine: sub.done ? 'line-through' : 'none' }]}
              value={sub.title}
              onChangeText={(text) => handleUpdateSubtaskTitle(sub.id, text)}
              onBlur={() => saveMatter({ subtasks })}
              placeholder="Subtask"
              placeholderTextColor={theme.textSecondary}
            />
          </View>
        ))}

        {/* Add Subtask Input */}
        <View style={styles.subtaskRow}>
          <View style={[styles.subtaskCircle, { borderColor: theme.textSecondary }]} />
          <TextInput
            style={[styles.subtaskInput, { color: theme.text }]}
            value={newSubtask}
            onChangeText={setNewSubtask}
            onSubmitEditing={handleAddSubtask}
            placeholder="Add subtask"
            placeholderTextColor={theme.textSecondary}
            returnKeyType="done"
          />
        </View>
      </ScrollView>

      {/* Menu Bottom Sheet */}
      <Modal visible={showMenu} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />

            <View style={styles.menuOptions}>
              <Pressable style={styles.menuOption} onPress={handleArchiveTask}>
                <Ionicons name="checkmark-circle-outline" size={20} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>Mark as done</Text>
              </Pressable>

              <Pressable style={styles.menuOption} onPress={() => { setShowMenu(false); }}>
                <Ionicons name="copy-outline" size={20} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>Duplicate</Text>
              </Pressable>

              <Pressable style={styles.menuOption} onPress={() => { setShowMenu(false); }}>
                <Ionicons name="arrow-forward-outline" size={20} color={theme.text} />
                <Text style={[styles.menuOptionText, { color: theme.text }]}>Move to another task</Text>
              </Pressable>

              <View style={[styles.menuSeparator, { backgroundColor: theme.backgroundElement }]} />

              <Pressable style={styles.menuOption} onPress={handleDeleteTask}>
                <Ionicons name="trash-outline" size={20} color="#FF3B30" />
                <Text style={[styles.menuOptionText, { color: '#FF3B30' }]}>Delete task</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Date Picker Bottom Sheet */}
      <Modal visible={showDatePicker} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowDatePicker(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            {/* Drag Handle */}
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />

            {/* Header */}
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Edit due date</Text>
              <View style={styles.sheetHeaderBtns}>
                <Pressable onPress={handleClearDueDate}>
                  <Text style={[styles.sheetClear, { color: theme.textSecondary }]}>Clear</Text>
                </Pressable>
                <Pressable style={styles.sheetDoneBtn} onPress={() => setShowDatePicker(false)}>
                  <Text style={styles.sheetDoneText}>Done</Text>
                </Pressable>
              </View>
            </View>

            <ScrollView style={styles.sheetScroll} contentContainerStyle={{ paddingBottom: 40 }}>
              {/* Quick Options */}
              <Pressable
                style={[styles.sheetOption, isSameDay(dueDate, new Date()) && { backgroundColor: theme.backgroundElement }]}
                onPress={() => handleSetDueDate(new Date())}>
                <Ionicons name="calendar-outline" size={18} color={isSameDay(dueDate, new Date()) ? '#5E6AD2' : theme.textSecondary} />
                <Text style={[styles.sheetOptionText, { color: isSameDay(dueDate, new Date()) ? '#5E6AD2' : theme.text }]}>Today</Text>
                {isSameDay(dueDate, new Date()) && <Ionicons name="checkmark" size={18} color="#5E6AD2" style={{ marginLeft: 'auto' }} />}
              </Pressable>

              <Pressable
                style={[styles.sheetOption, isTomorrow(dueDate) && { backgroundColor: theme.backgroundElement }]}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 1);
                  handleSetDueDate(d);
                }}>
                <Ionicons name="calendar-outline" size={18} color={isTomorrow(dueDate) ? '#5E6AD2' : theme.textSecondary} />
                <Text style={[styles.sheetOptionText, { color: isTomorrow(dueDate) ? '#5E6AD2' : theme.text }]}>Tomorrow</Text>
                {isTomorrow(dueDate) && <Ionicons name="checkmark" size={18} color="#5E6AD2" style={{ marginLeft: 'auto' }} />}
              </Pressable>

              <Pressable
                style={[styles.sheetOption, isNextWeek(dueDate) && { backgroundColor: theme.backgroundElement }]}
                onPress={() => {
                  const d = new Date();
                  d.setDate(d.getDate() + 7);
                  handleSetDueDate(d);
                }}>
                <Ionicons name="calendar-outline" size={18} color={isNextWeek(dueDate) ? '#5E6AD2' : theme.textSecondary} />
                <Text style={[styles.sheetOptionText, { color: isNextWeek(dueDate) ? '#5E6AD2' : theme.text }]}>Next week</Text>
                {isNextWeek(dueDate) && <Ionicons name="checkmark" size={18} color="#5E6AD2" style={{ marginLeft: 'auto' }} />}
              </Pressable>

              {/* Calendar */}
              <View style={styles.calendarContainer}>
                <View style={styles.calendarHeader}>
                  <Text style={[styles.calendarTitle, { color: theme.text }]}>
                    {MONTHS[dueDate ? dueDate.getMonth() : new Date().getMonth()]} {dueDate ? dueDate.getFullYear() : new Date().getFullYear()}
                  </Text>
                </View>

                <View style={styles.calendarWeekdays}>
                  {WEEKDAYS.map((day, i) => (
                    <Text key={i} style={[styles.calendarWeekday, { color: theme.textSecondary }]}>{day}</Text>
                  ))}
                </View>

                <View style={styles.calendarGrid}>
                  {renderCalendar()}
                </View>
              </View>

              {/* Time */}
              <Pressable style={[styles.sheetOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundElement }]} onPress={() => setShowTimePicker(true)}>
                <Ionicons name="time-outline" size={18} color={dueDate ? '#5E6AD2' : theme.textSecondary} />
                <Text style={[styles.sheetOptionText, { color: dueDate ? '#5E6AD2' : theme.text }]}>
                  {dueDate ? formatDueTime() : 'Time'}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
              </Pressable>

              {/* Remind me */}
              <View style={[styles.sheetOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundElement }]}>
                <Pressable style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }} onPress={() => setShowReminderOptions(!showReminderOptions)}>
                  <Ionicons name="notifications-outline" size={18} color={reminder ? '#FF3B30' : theme.textSecondary} />
                  <Text style={[styles.sheetOptionText, { color: reminder ? '#FF3B30' : theme.text }]}>
                    {reminder || 'Remind me'}
                  </Text>
                </Pressable>
                {reminder && (
                  <Pressable onPress={() => handleSetReminder(null)}>
                    <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
                  </Pressable>
                )}
                {!reminder && <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />}
              </View>

              {/* Reminder Options */}
              {showReminderOptions && (
                <View style={styles.optionsContainer}>
                  {REMINDER_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      style={[styles.optionItem, { backgroundColor: reminder === option ? '#5E6AD2' : theme.backgroundElement }]}
                      onPress={() => handleSetReminder(option)}>
                      <Text style={[styles.optionText, { color: reminder === option ? '#fff' : theme.text }]}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              )}

              {/* Repeat */}
              <Pressable style={[styles.sheetOption, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.backgroundElement }]} onPress={() => setShowRepeatOptions(!showRepeatOptions)}>
                <Ionicons name="repeat-outline" size={18} color={repeat !== 'Don\'t repeat' ? '#5E6AD2' : theme.textSecondary} />
                <Text style={[styles.sheetOptionText, { color: repeat !== 'Don\'t repeat' ? '#5E6AD2' : theme.text }]}>
                  {repeat}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} style={{ marginLeft: 'auto' }} />
              </Pressable>

              {/* Repeat Options */}
              {showRepeatOptions && (
                <View style={styles.optionsContainer}>
                  {REPEAT_OPTIONS.map((option) => (
                    <Pressable
                      key={option}
                      style={[styles.optionItem, { backgroundColor: repeat === option ? '#5E6AD2' : theme.backgroundElement }]}
                      onPress={() => handleSetRepeat(option)}>
                      <Text style={[styles.optionText, { color: repeat === option ? '#fff' : theme.text }]}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Expo UI Time Picker - Native Clock */}
      {showTimePicker && (
        <DateTimePicker
          value={dueDate || new Date()}
          mode="time"
          is24Hour={false}
          accentColor="#5E6AD2"
          onValueChange={(event, date) => {
            setShowTimePicker(false);
            if (date) handleSetDueDate(date);
          }}
          onDismiss={() => setShowTimePicker(false)}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingBottom: 8 },
  doneBtn: { backgroundColor: '#1a1a1a', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 20 },
  doneBtnText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  scrollView: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 16, gap: 8, paddingTop: 8 },
  circle: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, marginTop: 6, justifyContent: 'center', alignItems: 'center' },
  titleInput: { flex: 1, fontSize: 24, fontWeight: '600', paddingVertical: 0, lineHeight: 30 },
  menuBtn: { padding: 8 },
  chipsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8 },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20, gap: 6 },
  chipText: { fontSize: 13, fontWeight: '500' },
  divider: { height: 1, marginHorizontal: 16, marginTop: 16 },
  subtaskRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 12 },
  subtaskCircle: { width: 20, height: 20, borderRadius: 10, borderWidth: 2, justifyContent: 'center', alignItems: 'center' },
  subtaskInput: { flex: 1, fontSize: 16, paddingVertical: 0 },
  // Bottom Sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '85%' },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8, opacity: 0.3 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '600' },
  sheetHeaderBtns: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  sheetClear: { fontSize: 15 },
  sheetDoneBtn: { backgroundColor: '#1a1a1a', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  sheetDoneText: { color: '#fff', fontSize: 14, fontWeight: '600' },
  sheetScroll: { paddingHorizontal: 20 },
  sheetOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, gap: 12, borderRadius: 12 },
  sheetOptionText: { fontSize: 16, fontWeight: '500' },
  calendarContainer: { paddingVertical: 16 },
  calendarHeader: { flexDirection: 'row', justifyContent: 'center', marginBottom: 16 },
  calendarTitle: { fontSize: 16, fontWeight: '600' },
  calendarWeekdays: { flexDirection: 'row', marginBottom: 8 },
  calendarWeekday: { flex: 1, textAlign: 'center', fontSize: 13, fontWeight: '500' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDay: { width: '14.28%', aspectRatio: 1, justifyContent: 'center', alignItems: 'center' },
  calendarDaySelected: { backgroundColor: '#FF3B30', borderRadius: 20 },
  calendarDayText: { fontSize: 15, fontWeight: '500' },
  optionsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingBottom: 12 },
  optionItem: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 20 },
  optionText: { fontSize: 13, fontWeight: '500' },
  // Menu
  menuOptions: { paddingHorizontal: 20, paddingVertical: 16 },
  menuOption: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  menuOptionText: { fontSize: 16, fontWeight: '500' },
  menuSeparator: { height: 1, marginVertical: 8 },
});
