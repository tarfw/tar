import { useState, useEffect, useCallback } from 'react';
import { StyleSheet, ScrollView, Pressable, View, TextInput, Text, ActivityIndicator, Modal } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, Stack } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '@/hooks/use-theme';
import { useDb } from '@/db/provider';
import { useFormById, type FormRow } from '@/hooks/use-form';
import { type MatterRow } from '@/hooks/use-matter';

function parseData(data: string): Record<string, any> {
  try { return JSON.parse(data); } catch { return {}; }
}

const LEAD_STATUSES = ['New', 'Review', 'Contacted', 'Converted'];

export default function CrmScreen() {
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const db = useDb();
  const params = useLocalSearchParams<{ id: string }>();
  const { row, loading: rowLoading } = useFormById(params.id);

  const [leadMatter, setLeadMatter] = useState<MatterRow | null>(null);
  const [tickets, setTickets] = useState<FormRow[]>([]);
  const [motions, setMotions] = useState<any[]>([]);
  const [localTitle, setLocalTitle] = useState('');
  const [showMenu, setShowMenu] = useState(false);
  const [showTicketSheet, setShowTicketSheet] = useState(false);
  const [showReplySheet, setShowReplySheet] = useState<string | null>(null);
  const [newTicketSubject, setNewTicketSubject] = useState('');
  const [replyText, setReplyText] = useState('');
  const [expandedTicket, setExpandedTicket] = useState<string | null>(null);

  const loadCrm = useCallback(async () => {
    if (!row) return;
    setLocalTitle(row.title);

    const lead = await db.getFirstAsync<MatterRow>(
      "SELECT * FROM matter WHERE form = ? AND type = 'lead' AND active = 1 LIMIT 1",
      row.id
    );
    setLeadMatter(lead);

    const t = await db.getAllAsync<FormRow>(
      "SELECT * FROM form WHERE type = 'ticket' AND active = 1 AND data LIKE ? ORDER BY time DESC",
      `%"customer":"${row.id}"%`
    );
    setTickets(t);

    const m = await db.getAllAsync<any>(
      "SELECT * FROM motion WHERE stream = ? ORDER BY seq DESC LIMIT 20",
      row.id
    );
    setMotions(m);
  }, [db, row]);

  useEffect(() => {
    if (row) setLocalTitle(row.title);
    loadCrm();
  }, [row, loadCrm]);

  const saveFormTitle = async () => {
    if (!row || !localTitle.trim()) return;
    await db.runAsync('UPDATE form SET title = ? WHERE id = ?', localTitle.trim(), row.id);
  };

  const getNextSeq = async (stream: string): Promise<number> => {
    const r = await db.getFirstAsync<{ max_seq: number }>(
      "SELECT COALESCE(MAX(seq), 0) + 1 as max_seq FROM motion WHERE stream = ?",
      stream
    );
    return r?.max_seq ?? 1;
  };

  const handleUpdateLeadStatus = async (status: string) => {
    if (!row) return;
    const now = new Date().toISOString();

    if (leadMatter) {
      const data = parseData(leadMatter.data);
      data.status = status;
      await db.runAsync('UPDATE matter SET data = ? WHERE id = ?', JSON.stringify(data), leadMatter.id);
    } else {
      const leadId = `lead_${Date.now()}`;
      await db.runAsync(
        "INSERT INTO matter (id, form, type, value, data, time, active) VALUES (?, ?, 'lead', 0, ?, ?, 1)",
        leadId, row.id, JSON.stringify({ status, name: row.title }), now
      );
      const seq = await getNextSeq(row.id);
      await db.runAsync(
        "INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 303, 0, ?, ?)",
        row.id, seq, JSON.stringify({ status, name: row.title }), now
      );
    }
    setShowMenu(false);
    loadCrm();
  };

  const handleLogVisit = async () => {
    if (!row) return;
    const seq = await getNextSeq(row.id);
    await db.runAsync(
      "INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 301, 0, ?, ?)",
      row.id, seq, JSON.stringify({}), new Date().toISOString()
    );
    setShowMenu(false);
    loadCrm();
  };

  const handleReview = async (rating: number) => {
    if (!row) return;
    const seq = await getNextSeq(row.id);
    await db.runAsync(
      "INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 302, 0, ?, ?)",
      row.id, seq, JSON.stringify({ rating }), new Date().toISOString()
    );
    setShowMenu(false);
    loadCrm();
  };

  const handleCreateTicket = async () => {
    if (!newTicketSubject.trim()) return;
    const now = new Date().toISOString();
    const ticketId = `ticket_${Date.now()}`;
    await db.runAsync(
      "INSERT INTO form (id, type, title, scope, data, time, active) VALUES (?, 'ticket', ?, 'p', ?, ?, 1)",
      ticketId, newTicketSubject.trim(), JSON.stringify({ subject: newTicketSubject.trim(), customer: row?.id, status: 'Open', priority: 'Medium' }), now
    );
    const seq = await getNextSeq(ticketId);
    await db.runAsync(
      "INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 306, 0, ?, ?)",
      ticketId, seq, JSON.stringify({ agent: 'system', channel: 'app' }), now
    );
    setNewTicketSubject('');
    setShowTicketSheet(false);
    loadCrm();
  };

  const handleReply = async (ticketId: string) => {
    if (!replyText.trim()) return;
    const seq = await getNextSeq(ticketId);
    await db.runAsync(
      "INSERT INTO motion (stream, seq, action, phase, data, time) VALUES (?, ?, 307, 0, ?, ?)",
      ticketId, seq, JSON.stringify({ from: row?.id, text: replyText.trim() }), new Date().toISOString()
    );
    setReplyText('');
    setShowReplySheet(null);
  };

  const handleResolveTicket = async (ticket: FormRow) => {
    const d = parseData(ticket.data);
    d.status = 'Resolved';
    await db.runAsync('UPDATE form SET data = ? WHERE id = ?', JSON.stringify(d), ticket.id);
    loadCrm();
  };

  const handleDeleteItem = async (id: string) => {
    await db.runAsync('UPDATE form SET active = 0 WHERE id = ?', id);
    await db.runAsync('UPDATE matter SET active = 0 WHERE form = ?', id);
    await db.runAsync('DELETE FROM motion WHERE stream = ?', id);
    loadCrm();
  };

  const leadStatus = leadMatter ? parseData(leadMatter.data).status || 'New' : null;

  const formatTime = (time: string) => {
    const d = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60000);
    if (diffMin < 1) return 'Just now';
    if (diffMin < 60) return `${diffMin}m ago`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr}h ago`;
    return `${Math.floor(diffHr / 24)}d ago`;
  };

  const motionLabel = (action: number) => {
    const labels: Record<number, string> = {
      301: 'Store visit', 302: 'Review', 303: 'Lead created',
      306: 'Ticket opened', 307: 'Reply', 309: 'Birthday offer',
    };
    return labels[action] || `Action ${action}`;
  };

  if (rowLoading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator style={{ flex: 1 }} color={theme.textSecondary} />
      </View>
    );
  }

  if (!row) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <Stack.Screen options={{ headerShown: false }} />
        <Text style={{ color: theme.text, paddingTop: insets.top + 16, paddingHorizontal: 16 }}>Not found</Text>
      </View>
    );
  }

  const data = parseData(row.data);
  const avatarColor = data.color || '#5E6AD2';

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      <Stack.Screen options={{ headerShown: false }} />

      <ScrollView style={styles.scrollView} contentContainerStyle={{ paddingTop: insets.top + 16, paddingBottom: insets.bottom + 80 }}>

        {/* Header */}
        <View style={styles.titleRow}>
          <View style={[styles.avatar, { backgroundColor: avatarColor }]}>
            <Text style={styles.avatarText}>{row.title.charAt(0).toUpperCase()}</Text>
          </View>
          <TextInput
            style={[styles.titleInput, { color: theme.text }]}
            value={localTitle}
            onChangeText={setLocalTitle}
            onBlur={saveFormTitle}
            placeholder="Name"
            placeholderTextColor={theme.textSecondary}
          />
          <Pressable onPress={() => setShowMenu(true)} style={styles.menuBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={theme.textSecondary} />
          </Pressable>
        </View>

        {/* Contact chips */}
        <View style={styles.chipsRow}>
          {data.phone ? (
            <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="call-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.chipText, { color: theme.text }]}>{data.phone}</Text>
            </View>
          ) : null}
          {data.email ? (
            <View style={[styles.chip, { backgroundColor: theme.backgroundElement }]}>
              <Ionicons name="mail-outline" size={14} color={theme.textSecondary} />
              <Text style={[styles.chipText, { color: theme.text }]}>{data.email}</Text>
            </View>
          ) : null}
        </View>

        <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

        {/* Lead Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Lead</Text>
        </View>

        {leadMatter ? (
          <View style={styles.leadCard}>
            <View style={styles.leadRow}>
              <Text style={[styles.leadLabel, { color: theme.textSecondary }]}>Status</Text>
              <View style={[styles.statusDot, { backgroundColor: leadStatus === 'Converted' ? '#34C759' : leadStatus === 'Review' ? '#FF9500' : '#5E6AD2' }]} />
              <Text style={[styles.leadValue, { color: theme.text }]}>{leadStatus || 'New'}</Text>
            </View>
            {leadMatter.value > 0 && (
              <View style={styles.leadRow}>
                <Text style={[styles.leadLabel, { color: theme.textSecondary }]}>Value</Text>
                <Text style={[styles.leadValue, { color: theme.text }]}>₹{leadMatter.value.toLocaleString()}</Text>
              </View>
            )}
          </View>
        ) : (
          <Pressable style={[styles.createLeadBtn, { backgroundColor: theme.backgroundElement }]} onPress={() => handleUpdateLeadStatus('New')}>
            <Ionicons name="add-circle-outline" size={18} color="#5E6AD2" />
            <Text style={[styles.createLeadText, { color: '#5E6AD2' }]}>Create lead</Text>
          </Pressable>
        )}

        <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

        {/* Tickets Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Tickets</Text>
          <Pressable onPress={() => setShowTicketSheet(true)} style={styles.sectionAction}>
            <Ionicons name="add" size={20} color="#5E6AD2" />
          </Pressable>
        </View>

        {tickets.length > 0 ? tickets.map((t) => {
          const td = parseData(t.data);
          const isExpanded = expandedTicket === t.id;
          const statusColor = td.status === 'Resolved' ? '#34C759' : td.priority === 'Urgent' ? '#FF3B30' : td.priority === 'High' ? '#FF9500' : '#5E6AD2';
          return (
            <Pressable key={t.id} style={styles.ticketCard} onPress={() => setExpandedTicket(isExpanded ? null : t.id)}>
              <View style={styles.ticketHeader}>
                <View style={[styles.ticketPriority, { backgroundColor: statusColor }]}>
                  <Text style={styles.ticketPriorityText}>!</Text>
                </View>
                <View style={styles.ticketInfo}>
                  <Text style={[styles.ticketTitle, { color: theme.text }]}>{td.subject || t.title}</Text>
                  <Text style={[styles.ticketMeta, { color: theme.textSecondary }]}>{td.priority || 'Medium'} · {formatTime(t.time)}</Text>
                </View>
                <View style={[styles.ticketStatus, { backgroundColor: statusColor + '20' }]}>
                  <Text style={[styles.ticketStatusText, { color: statusColor }]}>{td.status || 'Open'}</Text>
                </View>
              </View>
              {isExpanded && (
                <View style={styles.ticketActions}>
                  {td.status !== 'Resolved' && (
                    <>
                      <Pressable style={[styles.ticketActionBtn, { backgroundColor: '#5E6AD2' + '20' }]} onPress={() => { setShowReplySheet(t.id); }}>
                        <Text style={[styles.ticketActionText, { color: '#5E6AD2' }]}>Reply</Text>
                      </Pressable>
                      <Pressable style={[styles.ticketActionBtn, { backgroundColor: '#34C759' + '20' }]} onPress={() => handleResolveTicket(t)}>
                        <Text style={[styles.ticketActionText, { color: '#34C759' }]}>Resolve</Text>
                      </Pressable>
                    </>
                  )}
                  <Pressable style={[styles.ticketActionBtn, { backgroundColor: '#FF3B30' + '20' }]} onPress={() => handleDeleteItem(t.id)}>
                    <Text style={[styles.ticketActionText, { color: '#FF3B30' }]}>Delete</Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          );
        }) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No tickets</Text>
        )}

        <View style={[styles.divider, { backgroundColor: theme.backgroundElement }]} />

        {/* Timeline */}
        <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>Timeline</Text>

        {motions.length > 0 ? motions.map((m, i) => {
          const md = parseData(m.data);
          return (
            <View key={i} style={styles.timelineRow}>
              <View style={[styles.timelineDot, { backgroundColor: theme.textSecondary }]} />
              <View style={styles.timelineContent}>
                <Text style={[styles.timelineTitle, { color: theme.text }]}>{motionLabel(m.action)}</Text>
                <Text style={[styles.timelineMeta, { color: theme.textSecondary }]}>
                  {formatTime(m.time)}
                  {md.text ? ` · ${md.text}` : ''}
                  {md.status ? ` → ${md.status}` : ''}
                  {md.rating ? ` · ${md.rating}/5` : ''}
                </Text>
              </View>
            </View>
          );
        }) : (
          <Text style={[styles.emptyText, { color: theme.textSecondary }]}>No activity yet</Text>
        )}

      </ScrollView>

      {/* Menu Bottom Sheet */}
      <Modal visible={showMenu} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowMenu(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.sheetOptions}>
              {leadMatter && LEAD_STATUSES.map((s) => (
                <Pressable key={s} style={[styles.sheetOption, { backgroundColor: leadStatus === s ? '#5E6AD2' : theme.backgroundElement }]} onPress={() => handleUpdateLeadStatus(s)}>
                  <Text style={[styles.sheetOptionText, { color: leadStatus === s ? '#fff' : theme.text }]}>{s}</Text>
                </Pressable>
              ))}
              <View style={[styles.sheetSeparator, { backgroundColor: theme.backgroundElement }]} />
              <Pressable style={styles.sheetAction} onPress={handleLogVisit}>
                <Ionicons name="walk-outline" size={18} color={theme.text} />
                <Text style={[styles.sheetActionText, { color: theme.text }]}>Log store visit</Text>
              </Pressable>
              <Pressable style={styles.sheetAction} onPress={() => handleReview(5)}>
                <Ionicons name="star-outline" size={18} color={theme.text} />
                <Text style={[styles.sheetActionText, { color: theme.text }]}>Review (5 star)</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* New Ticket Bottom Sheet */}
      <Modal visible={showTicketSheet} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => setShowTicketSheet(false)}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>New Ticket</Text>
              <Pressable onPress={handleCreateTicket}>
                <Text style={{ color: '#5E6AD2', fontSize: 15, fontWeight: '600' }}>Create</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <TextInput
                style={[styles.ticketInput, { color: theme.text, borderColor: theme.backgroundElement }]}
                value={newTicketSubject}
                onChangeText={setNewTicketSubject}
                placeholder="Subject"
                placeholderTextColor={theme.textSecondary}
                autoFocus
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Reply Bottom Sheet */}
      <Modal visible={!!showReplySheet} transparent animationType="slide">
        <Pressable style={styles.modalOverlay} onPress={() => { setShowReplySheet(null); setReplyText(''); }}>
          <Pressable style={[styles.bottomSheet, { backgroundColor: theme.background }]} onPress={(e) => e.stopPropagation()}>
            <View style={[styles.dragHandle, { backgroundColor: theme.textSecondary }]} />
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: theme.text }]}>Reply</Text>
              <Pressable onPress={() => { if (showReplySheet) handleReply(showReplySheet); }}>
                <Text style={{ color: '#5E6AD2', fontSize: 15, fontWeight: '600' }}>Send</Text>
              </Pressable>
            </View>
            <View style={{ paddingHorizontal: 20, paddingBottom: 20 }}>
              <TextInput
                style={[styles.ticketInput, { color: theme.text, borderColor: theme.backgroundElement }]}
                value={replyText}
                onChangeText={setReplyText}
                placeholder="Type reply..."
                placeholderTextColor={theme.textSecondary}
                autoFocus
                multiline
              />
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollView: { flex: 1 },
  titleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  avatar: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  avatarText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  titleInput: { flex: 1, fontSize: 22, fontWeight: '600', paddingVertical: 0 },
  menuBtn: { padding: 8 },
  chipsRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 12, gap: 8, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 16, gap: 6 },
  chipText: { fontSize: 13, fontWeight: '500' },
  divider: { height: 1, marginHorizontal: 16, marginTop: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 16, paddingTop: 16 },
  sectionTitle: { fontSize: 13, fontWeight: '500' },
  sectionAction: { padding: 4 },
  leadCard: { marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: 12, backgroundColor: 'rgba(128,128,128,0.08)' },
  leadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 },
  leadLabel: { fontSize: 14, width: 60 },
  leadValue: { fontSize: 14, fontWeight: '500' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  createLeadBtn: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 8, padding: 14, borderRadius: 12, gap: 8 },
  createLeadText: { fontSize: 14, fontWeight: '500' },
  ticketCard: { marginHorizontal: 16, marginTop: 8, padding: 12, borderRadius: 12, backgroundColor: 'rgba(128,128,128,0.08)' },
  ticketHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  ticketPriority: { width: 22, height: 22, borderRadius: 11, justifyContent: 'center', alignItems: 'center' },
  ticketPriorityText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  ticketInfo: { flex: 1 },
  ticketTitle: { fontSize: 14, fontWeight: '500' },
  ticketMeta: { fontSize: 12, marginTop: 2 },
  ticketStatus: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  ticketStatusText: { fontSize: 11, fontWeight: '600' },
  ticketActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  ticketActionBtn: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  ticketActionText: { fontSize: 13, fontWeight: '600' },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 20 },
  timelineRow: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 10, gap: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 5 },
  timelineContent: { flex: 1 },
  timelineTitle: { fontSize: 14, fontWeight: '500' },
  timelineMeta: { fontSize: 12, marginTop: 2 },
  // Bottom Sheet
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' },
  bottomSheet: { borderTopLeftRadius: 20, borderTopRightRadius: 20, maxHeight: '50%' },
  dragHandle: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 12, marginBottom: 8, opacity: 0.3 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingBottom: 12 },
  sheetTitle: { fontSize: 16, fontWeight: '600' },
  sheetOptions: { paddingHorizontal: 20, paddingBottom: 24 },
  sheetOption: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 20, marginBottom: 8, alignSelf: 'flex-start' },
  sheetOptionText: { fontSize: 14, fontWeight: '500' },
  sheetSeparator: { height: 1, marginVertical: 12 },
  sheetAction: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, gap: 12 },
  sheetActionText: { fontSize: 16, fontWeight: '500' },
  ticketInput: { fontSize: 16, borderWidth: 1, borderRadius: 10, padding: 12, marginTop: 8 },
});
