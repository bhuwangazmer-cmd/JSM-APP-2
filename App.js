import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Pressable, Modal, Alert, Animated, Easing, LayoutAnimation, Platform, UIManager, StatusBar, Switch, ActivityIndicator, KeyboardAvoidingView, Linking } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { Provider as PaperProvider, Appbar, TextInput as PaperInput, Button as PaperButton, Surface, MD3LightTheme } from 'react-native-paper';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const triggerLayoutAnimation = () => LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);

// ==========================================
// 1. FIREBASE CONFIGURATION (JSM-APP-CDE22)
// ==========================================
const firebaseConfig = {
  apiKey: "AIzaSyBLbRyy9q5jwfuHlxi06DBiiWNtTK_koe8",
  authDomain: "jsm-app-cde22.firebaseapp.com",
  projectId: "jsm-app-cde22",
  storageBucket: "jsm-app-cde22.firebasestorage.app",
  messagingSenderId: "78588387738",
  appId: "1:78588387738:web:f07509bb2e37a751b0da23"
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// ==========================================
// 2. THEME & PALETTE
// ==========================================
const COLORS = { navy: '#0C2D57', navyLight: '#163E73', gold: '#D4B978', goldLight: 'rgba(212, 185, 120, 0.18)', cream: '#EFE7D3', silver: '#8E9399', ivory: '#FAF8F5', white: '#FFFFFF', danger: '#9E2A2B', dangerBg: '#FDE8E8', success: '#2D6A4F', successBg: '#E6F4EA', warning: '#B45309', warningBg: '#FEF3C7', charcoal: '#1D242B', border: '#E6E1D6' };
const jsmTheme = { ...MD3LightTheme, colors: { ...MD3LightTheme.colors, primary: COLORS.navy, secondary: COLORS.gold, background: COLORS.ivory, surface: COLORS.white, error: COLORS.danger, elevation: { level1: COLORS.white, level2: COLORS.cream } } };

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Tardy', 'Rescheduled'];
const FEE_TYPES = ['Monthly Fee', 'Admission Fee', 'Exam Fee', 'Instrument / Book'];
const PAYMENT_MODES = ['UPI', 'Cash', 'Bank Transfer', 'Card'];
const FEE_STATUSES = ['Paid', 'Partial', 'Unpaid'];

// ==========================================
// 3. LOCAL TIMEZONE DATE & STRING UTILITIES
// ==========================================
const getOffsetDateISO = (daysOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const getTodayISO = () => getOffsetDateISO(0);
const getYesterdayISO = () => getOffsetDateISO(-1);

const normalizeISODate = (rawStr) => {
  if (!rawStr || typeof rawStr !== 'string') return null;
  const match = rawStr.trim().match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
  if (!match) return null;
  const [_, year, month, day] = match.map(Number);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const checkDate = new Date(year, month - 1, day);
  if (checkDate.getFullYear() !== year || checkDate.getMonth() !== month - 1 || checkDate.getDate() !== day) return null;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const getLocalCurrentMonthLabel = () => `${MONTHS_FULL[new Date().getMonth()]} ${new Date().getFullYear()}`;
const getGreetingByLocalTime = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};

const formatReadableLocalDate = (isoDateStr) => {
  const normalized = normalizeISODate(isoDateStr) || isoDateStr;
  const parts = normalized.split('-');
  if (parts.length !== 3) return isoDateStr;
  const [year, monthIndex, day] = [parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)];
  return isNaN(year) || isNaN(monthIndex) || isNaN(day) || !MONTHS_SHORT[monthIndex] ? isoDateStr : `${day} ${MONTHS_SHORT[monthIndex]} ${year}`;
};

const getMonthYearFromISO = (isoDateStr) => {
  const normalized = normalizeISODate(isoDateStr) || isoDateStr;
  const parts = normalized.split('-');
  if (parts.length < 2) return 'Unknown Month';
  const monthIdx = parseInt(parts[1], 10) - 1;
  return isNaN(parseInt(parts[0], 10)) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11 ? 'Unknown Month' : `${MONTHS_FULL[monthIdx]} ${parts[0]}`;
};

const isWithinLastTwoLocalMonths = (isoDateStr) => {
  const normalized = normalizeISODate(isoDateStr) || isoDateStr;
  if (!normalized) return false;
  const parts = normalized.split('-');
  if (parts.length < 2) return false;
  const now = new Date();
  const diff = (now.getFullYear() * 12 + now.getMonth()) - (parseInt(parts[0], 10) * 12 + parseInt(parts[1], 10) - 1);
  return diff >= 0 && diff <= 1;
};

const getDaysRemainingInTrash = (deletedAtMs) => {
  if (!deletedAtMs) return 30;
  return Math.max(0, 30 - Math.floor((Date.now() - Number(deletedAtMs)) / (1000 * 60 * 60 * 24)));
};

const escapeHtml = (unsafe) => String(unsafe ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const sanitizeCurrency = (val) => {
  const cleaned = String(val ?? '').replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
};

// ==========================================
// 4. ANIMATED ENTRANCE SCREEN WRAPPER
// ==========================================
const AnimatedScreen = ({ children, triggerKey }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(14)).current;
  useEffect(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(14);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 240, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
    ]).start();
  }, [triggerKey, fadeAnim, slideAnim]);
  return <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>{children}</Animated.View>;
};

const QuickDateRow = ({ currentDate, onSelectDate }) => {
  const today = getTodayISO();
  const yesterday = getYesterdayISO();
  return (
    <View style={styles.quickDateRow}>
      <TouchableOpacity style={[styles.quickDateChip, currentDate === today && styles.quickDateChipActive]} onPress={() => onSelectDate(today)}>
        <Text style={[styles.quickDateChipText, currentDate === today && styles.quickDateChipTextActive]}>Today ({today})</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.quickDateChip, currentDate === yesterday && styles.quickDateChipActive]} onPress={() => onSelectDate(yesterday)}>
        <Text style={[styles.quickDateChipText, currentDate === yesterday && styles.quickDateChipTextActive]}>Yesterday</Text>
      </TouchableOpacity>
    </View>
  );
};

// ==========================================
// 5. MAIN APPLICATION COMPONENT
// ==========================================
export default function App() {
  const [activeTab, setActiveTab] = useState('Home');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [profileTab, setProfileTab] = useState('Classes');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerSlideAnim = useRef(new Animated.Value(-290)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    drawerSlideAnim.setValue(-290);
    Animated.timing(drawerSlideAnim, { toValue: 0, duration: 250, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  };
  const closeDrawer = (callback) => {
    Animated.timing(drawerSlideAnim, { toValue: -290, duration: 200, easing: Easing.in(Easing.cubic), useNativeDriver: true }).start(() => {
      setDrawerOpen(false);
      if (typeof callback === 'function') callback();
    });
  };

  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState([]);
  const [activities, setActivities] = useState([]);
  const [noticeText, setNoticeText] = useState('');
  const [noticeUpdatedAt, setNoticeUpdatedAt] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('All');
  const [contextMenu, setContextMenu] = useState({ visible: false, entityType: null, item: null, title: '', reopenSubjectsModal: false });
  const [noticeReadModal, setNoticeReadModal] = useState(false);
  const [noticeEditModal, setNoticeEditModal] = useState(false);
  const [noticeInput, setNoticeInput] = useState('');
  const [todayLogModal, setTodayLogModal] = useState(false);
  const [subjectsModal, setSubjectsModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ id: null, name: '' });
  const [studentModal, setStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({ id: null, name: '', subjectId: '', phone: '', guardian: '', joinedDate: getTodayISO() });
  const [inlineLessonForm, setInlineLessonForm] = useState({ date: getTodayISO(), technique: '', repertoire: '', assignment: '' });
  const [lessonEditModal, setLessonEditModal] = useState(false);
  const [lessonEditForm, setLessonEditForm] = useState({ id: null, studentId: '', date: getTodayISO(), technique: '', repertoire: '', assignment: '' });
  const [inlineAttendanceForm, setInlineAttendanceForm] = useState({ date: getTodayISO(), status: 'Present', remarks: '' });
  const [attendanceModal, setAttendanceModal] = useState(false);
  const [attendanceFilterAllMonths, setAttendanceFilterAllMonths] = useState(false);
  const [attendanceModalForm, setAttendanceModalForm] = useState({ id: null, studentId: '', date: getTodayISO(), status: 'Present', remarks: '' });
  const [feeModal, setFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({ id: null, studentId: '', feeType: 'Monthly Fee', monthPaidFor: getLocalCurrentMonthLabel(), date: getTodayISO(), mode: 'UPI', status: 'Paid', amountPaid: '', balanceDue: '0', remarks: '' });
  const [noteDraft, setNoteDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState(false);
  const [checkingOTA, setCheckingOTA] = useState(false);
  const initialLoadDone = useRef(false);

  useEffect(() => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const timer = setTimeout(() => { initialLoadDone.current = true; }, 1200);
    const handleSnapshotWithAutoPurge = (colName, snapshot, setter) => {
      const records = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        if (data.isDeleted && data.deletedAt && Date.now() - Number(data.deletedAt) > THIRTY_DAYS_MS) {
          deleteDoc(doc(db, colName, docSnap.id)).catch(() => {});
        } else { records.push({ id: docSnap.id, ...data }); }
      });
      if (initialLoadDone.current) triggerLayoutAnimation();
      setter(records);
    };

    const unsubSubjects = onSnapshot(collection(db, 'subjects'), (snap) => handleSnapshotWithAutoPurge('subjects', snap, setSubjects), () => {});
    const unsubStudents = onSnapshot(collection(db, 'students'), (snap) => handleSnapshotWithAutoPurge('students', snap, setStudents), () => {});
    const unsubLessons = onSnapshot(collection(db, 'lessons'), (snap) => handleSnapshotWithAutoPurge('lessons', snap, setLessons), () => {});
    const unsubAttendance = onSnapshot(collection(db, 'attendance'), (snap) => handleSnapshotWithAutoPurge('attendance', snap, setAttendance), () => {});
    const unsubFees = onSnapshot(collection(db, 'fees'), (snap) => handleSnapshotWithAutoPurge('fees', snap, setFees), () => {});
    const unsubActivities = onSnapshot(collection(db, 'activities'), (snap) => {
      const list = [];
      snap.forEach((d) => {
        const data = d.data();
        if (data.timestamp && Date.now() - Number(data.timestamp) > THIRTY_DAYS_MS) deleteDoc(doc(db, 'activities', d.id)).catch(() => {});
        else list.push({ id: d.id, ...data });
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      setActivities(list);
    }, () => {});
    const unsubNotice = onSnapshot(doc(db, 'settings', 'noticeBoard'), (docSnap) => {
      if (docSnap.exists()) { setNoticeText(docSnap.data().text || ''); setNoticeUpdatedAt(docSnap.data().updatedDate || ''); }
    }, () => {});

    return () => { clearTimeout(timer); unsubSubjects(); unsubStudents(); unsubLessons(); unsubAttendance(); unsubFees(); unsubActivities(); unsubNotice(); };
  }, []);

  const logActivity = async (actionTitle, subtitle) => {
    try { await addDoc(collection(db, 'activities'), { title: actionTitle, subtitle: subtitle || '', dateISO: getTodayISO(), timestamp: Date.now() }); } catch (e) {}
  };

  const activeSubjects = useMemo(() => subjects.filter((s) => !s.isDeleted).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)), [subjects]);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map(s => [s.id, s])), [subjects]);
  const activeStudents = useMemo(() => students.filter((st) => !st.isDeleted).sort((a, b) => (a.name || '').localeCompare(b.name || '')), [students]);
  const studentMap = useMemo(() => Object.fromEntries(students.map(s => [s.id, s])), [students]);
  const activeLessons = useMemo(() => lessons.filter((l) => !l.isDeleted && studentMap[l.studentId] && !studentMap[l.studentId].isDeleted).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [lessons, studentMap]);
  const activeAttendance = useMemo(() => attendance.filter((a) => !a.isDeleted && studentMap[a.studentId] && !studentMap[a.studentId].isDeleted).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [attendance, studentMap]);
  const activeFees = useMemo(() => fees.filter((f) => !f.isDeleted && studentMap[f.studentId] && !studentMap[f.studentId].isDeleted).sort((a, b) => (b.date || '').localeCompare(a.date || '')), [fees, studentMap]);

  const globalFeeTotals = useMemo(() => {
    let collected = 0, pending = 0;
    activeFees.forEach((f) => { collected += Number(f.amountPaid || 0); pending += Number(f.balanceDue || 0); });
    return { collected, pending };
  }, [activeFees]);

  const trashItems = useMemo(() => [
    ...subjects.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'subjects', _label: `Subject: ${x.name}` })),
    ...students.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'students', _label: `Student: ${x.name}` })),
    ...lessons.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'lessons', _label: `Lesson: ${studentMap[x.studentId]?.name || 'Student'} (${formatReadableLocalDate(x.date)})` })),
    ...attendance.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'attendance', _label: `Attendance: ${studentMap[x.studentId]?.name || 'Student'} - ${x.status} (${formatReadableLocalDate(x.date)})` })),
    ...fees.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'fees', _label: `Fee: ${studentMap[x.studentId]?.name || 'Student'} - ₹${x.amountPaid} (${formatReadableLocalDate(x.date)})` })),
  ].sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0)), [subjects, students, lessons, attendance, fees, studentMap]);

  const selectedStudent = useMemo(() => activeStudents.find((s) => s.id === selectedStudentId) || null, [activeStudents, selectedStudentId]);
  useEffect(() => {
    if (selectedStudent) { setNoteDraft(selectedStudent.notes || ''); setPriorityDraft(Boolean(selectedStudent.priorityNote)); }
  }, [selectedStudentId, selectedStudent]);

  const getStudentMetrics = useCallback((studentId) => {
    const stLessons = activeLessons.filter((l) => l.studentId === studentId);
    const stAttendance = activeAttendance.filter((a) => a.studentId === studentId);
    const stFees = activeFees.filter((f) => f.studentId === studentId);
    let attendancePct = 'N/A';
    if (stAttendance.length > 0) attendancePct = `${Math.round((stAttendance.filter((a) => a.status === 'Present' || a.status === 'Tardy').length / stAttendance.length) * 100)}%`;
    let feeStatus = 'No Records', totalDue = 0;
    if (stFees.length > 0) {
      stFees.forEach((f) => { totalDue += Number(f.balanceDue || 0); });
      feeStatus = stFees.some((f) => f.status === 'Unpaid' || f.status === 'Partial' || Number(f.balanceDue || 0) > 0) ? 'Due / Unpaid' : 'Paid';
    }
    return { classesTaken: stLessons.length, attendancePct, feeStatus, totalDue, stLessons, stAttendance, stFees };
  }, [activeLessons, activeAttendance, activeFees]);

  const handleCheckOTA = async () => {
    try {
      setCheckingOTA(true);
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert('Update Ready', 'Restarting JSM APP with the latest version.', [{ text: 'Restart Now', onPress: () => Updates.reloadAsync() }]);
      } else { Alert.alert('Up to Date', 'You are running the latest JSM APP build.'); }
    } catch (e) { Alert.alert('OTA Notice', 'OTA check requires a production/preview Expo Updates build.'); } finally { setCheckingOTA(false); }
  };

  const handlePhoneCall = (phoneStr) => {
    const cleaned = String(phoneStr || '').replace(/[^\d+]/g, '');
    if (!cleaned) return;
    Linking.openURL(`tel:${cleaned}`).catch(() => Alert.alert('Action Unavailable', 'Could not open phone dialer.'));
  };

  const handleOpenWhatsApp = (phoneStr, studentName) => {
    const digits = String(phoneStr || '').replace(/[^\d]/g, '');
    if (!digits) return;
    Linking.openURL(`https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(`Hello from JSM APP regarding ${studentName || 'your music classes'}.`)}`).catch(() => Alert.alert('WhatsApp Unavailable', 'Could not open WhatsApp.'));
  };

  const generateAndShareReceiptPDF = async (feeRecord) => {
    const st = studentMap[feeRecord.studentId];
    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8" />
      <style>
        body { font-family: 'Georgia', serif; background: #FAF8F5; padding: 32px; color: #0C2D57; }
        .card { background: #0C2D57; color: #FAF8F5; border: 3px solid #D4B978; border-radius: 14px; padding: 32px; }
        .crest { color: #D4B978; text-align: center; letter-spacing: 3px; font-size: 12px; font-weight: bold; }
        .title { text-align: center; font-size: 26px; margin: 8px 0 4px; color: #FFFFFF; letter-spacing: 1px; }
        .subtitle { text-align: center; color: #EFE7D3; font-size: 13px; margin-bottom: 24px; }
        .divider { height: 1px; background: #D4B978; margin: 20px 0; opacity: 0.5; }
        .row { display: flex; justify-content: space-between; margin: 12px 0; font-size: 15px; }
        .label { color: #EFE7D3; } .val { color: #D4B978; font-weight: bold; }
        .total-box { background: rgba(212, 185, 120, 0.14); border: 1px solid #D4B978; padding: 16px; border-radius: 8px; margin-top: 20px; }
        .footer { text-align: center; margin-top: 28px; font-size: 11px; color: #8E9399; }
      </style></head>
      <body><div class="card">
        <div class="crest">★ EST. 2022 ★</div><div class="title">JSM APP</div><div class="subtitle">OFFICIAL TUITION &amp; FEE RECEIPT</div><div class="divider"></div>
        <div class="row"><span class="label">Student Name:</span><span class="val">${escapeHtml(st?.name || 'JSM Student')}</span></div>
        <div class="row"><span class="label">Instrument / Subject:</span><span class="val">${escapeHtml(subjectMap[st?.subjectId]?.name || 'Music Studies')}</span></div>
        <div class="row"><span class="label">Date of Transaction:</span><span class="val">${formatReadableLocalDate(feeRecord.date)}</span></div>
        <div class="row"><span class="label">Fee Category:</span><span class="val">${escapeHtml(feeRecord.feeType || 'Tuition Fee')}</span></div>
        ${feeRecord.feeType === 'Monthly Fee' ? `<div class="row"><span class="label">Month Paid For:</span><span class="val">${escapeHtml(feeRecord.monthPaidFor || '-')}</span></div>` : ''}
        <div class="row"><span class="label">Payment Mode:</span><span class="val">${escapeHtml(feeRecord.mode || 'UPI')}</span></div>
        <div class="row"><span class="label">Payment Status:</span><span class="val">${escapeHtml(feeRecord.status || 'Paid')}</span></div>
        <div class="total-box">
          <div class="row"><span class="label">Amount Paid:</span><span class="val">₹${Number(feeRecord.amountPaid || 0).toFixed(2)}</span></div>
          <div class="row"><span class="label">Balance Due:</span><span class="val">₹${Number(feeRecord.balanceDue || 0).toFixed(2)}</span></div>
        </div>
        ${feeRecord.remarks ? `<div class="row" style="margin-top:16px;"><span class="label">Remarks:</span><span class="val">${escapeHtml(feeRecord.remarks)}</span></div>` : ''}
        <div class="footer">Generated by JSM Administration • Est. 2022</div>
      </div></body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Share Receipt - ${st?.name || 'Student'}`, UTI: 'com.adobe.pdf' });
      } else { Alert.alert('PDF Created', `Saved to: ${uri}`); }
    } catch (err) { Alert.alert('Receipt Error', 'Could not generate or share the PDF receipt.'); }
  };

  const openLongPressMenu = (entityType, item, title, reopenSubjectsModal = false) => setContextMenu({ visible: true, entityType, item, title, reopenSubjectsModal });
  const closeContextMenu = () => setContextMenu({ visible: false, entityType: null, item: null, title: '', reopenSubjectsModal: false });

  const handleSoftDelete = async (collectionName, item, label) => {
    try {
      triggerLayoutAnimation();
      await updateDoc(doc(db, collectionName, item.id), { isDeleted: true, deletedAt: Date.now() });
      await logActivity('Moved to Trash', label);
      if (collectionName === 'students' && selectedStudentId === item.id) setSelectedStudentId(null);
    } catch (e) { Alert.alert('Error', 'Unable to move item to Trash.'); }
  };

  const handleMoveSubjectOrder = async (subjectItem, direction) => {
    try {
      const idx = activeSubjects.findIndex((s) => s.id === subjectItem.id);
      const targetIdx = direction === 'moveUp' ? idx - 1 : idx + 1;
      if (targetIdx < 0 || targetIdx >= activeSubjects.length) return;
      const reordered = [...activeSubjects];
      const [moved] = reordered.splice(idx, 1);
      reordered.splice(targetIdx, 0, moved);
      triggerLayoutAnimation();
      const batch = writeBatch(db);
      reordered.forEach((subj, index) => batch.update(doc(db, 'subjects', subj.id), { order: index }));
      await batch.commit();
      await logActivity('Reordered Subject', `${subjectItem.name} moved ${direction === 'moveUp' ? 'up' : 'down'}`);
    } catch (e) { Alert.alert('Error', 'Could not reorder subject.'); }
  };

  const handleContextAction = async (action) => {
    const { entityType, item, title, reopenSubjectsModal } = contextMenu;
    closeContextMenu();
    if (!item) return;
    if (action === 'delete') {
      await handleSoftDelete({ subject: 'subjects', student: 'students', lesson: 'lessons', attendance: 'attendance', fee: 'fees' }[entityType], item, title);
      if (reopenSubjectsModal) setSubjectsModal(true);
      return;
    }
    if ((action === 'moveUp' || action === 'moveDown') && entityType === 'subject') {
      await handleMoveSubjectOrder(item, action);
      if (reopenSubjectsModal) setSubjectsModal(true);
      return;
    }
    if (action === 'edit') {
      if (entityType === 'subject') { setSubjectForm({ id: item.id, name: item.name }); setSubjectsModal(true); }
      else if (entityType === 'student') { setStudentForm({ id: item.id, name: item.name || '', subjectId: item.subjectId || activeSubjects[0]?.id || '', phone: item.phone || '', guardian: item.guardian || '', joinedDate: item.joinedDate || getTodayISO() }); setStudentModal(true); }
      else if (entityType === 'lesson') { setLessonEditForm({ id: item.id, studentId: item.studentId, date: item.date || getTodayISO(), technique: item.technique || '', repertoire: item.repertoire || '', assignment: item.assignment || '' }); setLessonEditModal(true); }
      else if (entityType === 'attendance') { setAttendanceModalForm({ id: item.id, studentId: item.studentId, date: item.date || getTodayISO(), status: item.status || 'Present', remarks: item.remarks || '' }); setAttendanceModal(true); }
      else if (entityType === 'fee') { setFeeForm({ id: item.id, studentId: item.studentId, feeType: item.feeType || 'Monthly Fee', monthPaidFor: item.monthPaidFor || getLocalCurrentMonthLabel(), date: item.date || getTodayISO(), mode: item.mode || 'UPI', status: item.status || 'Paid', amountPaid: String(item.amountPaid ?? '0'), balanceDue: String(item.balanceDue ?? '0'), remarks: item.remarks || '' }); setFeeModal(true); }
    }
  };

  const handleSaveSubject = async () => {
    const trimmed = subjectForm.name.trim();
    if (!trimmed) return Alert.alert('Validation', 'Please enter a subject/instrument name.');
    try {
      triggerLayoutAnimation();
      if (subjectForm.id) { await updateDoc(doc(db, 'subjects', subjectForm.id), { name: trimmed }); await logActivity('Updated Subject', trimmed); }
      else { await addDoc(collection(db, 'subjects'), { name: trimmed, order: activeSubjects.length, isDeleted: false, deletedAt: null }); await logActivity('Added Subject', trimmed); }
      setSubjectForm({ id: null, name: '' });
    } catch (e) { Alert.alert('Error', 'Could not save subject.'); }
  };

  const handleSaveStudent = async () => {
    if (!studentForm.name.trim() || !studentForm.subjectId) return Alert.alert('Validation', 'Student Name and Subject are required.');
    const validDate = normalizeISODate(studentForm.joinedDate);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid enrollment date in YYYY-MM-DD format.');
    try {
      triggerLayoutAnimation();
      const payload = { name: studentForm.name.trim(), subjectId: studentForm.subjectId, phone: studentForm.phone.trim(), guardian: studentForm.guardian.trim(), joinedDate: validDate };
      if (studentForm.id) { await updateDoc(doc(db, 'students', studentForm.id), payload); await logActivity('Updated Student', payload.name); }
      else { await addDoc(collection(db, 'students'), { ...payload, notes: '', priorityNote: false, isDeleted: false, deletedAt: null }); await logActivity('Enrolled Student', `${payload.name} (${subjectMap[payload.subjectId]?.name || ''})`); }
      setStudentModal(false);
      setStudentForm({ id: null, name: '', subjectId: activeSubjects[0]?.id || '', phone: '', guardian: '', joinedDate: getTodayISO() });
    } catch (e) { Alert.alert('Error', 'Could not save student record.'); }
  };

  const handleSaveInlineLesson = async () => {
    if (!selectedStudentId) return;
    const validDate = normalizeISODate(inlineLessonForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    if (!inlineLessonForm.technique.trim() && !inlineLessonForm.repertoire.trim() && !inlineLessonForm.assignment.trim()) return Alert.alert('Validation', 'Enter at least one lesson detail.');
    try {
      triggerLayoutAnimation();
      await addDoc(collection(db, 'lessons'), { studentId: selectedStudentId, date: validDate, technique: inlineLessonForm.technique.trim(), repertoire: inlineLessonForm.repertoire.trim(), assignment: inlineLessonForm.assignment.trim(), isDeleted: false, deletedAt: null });
      await logActivity('Logged Lesson', `${studentMap[selectedStudentId]?.name || 'Student'} (${formatReadableLocalDate(validDate)})`);
      setInlineLessonForm({ date: getTodayISO(), technique: '', repertoire: '', assignment: '' });
    } catch (e) { Alert.alert('Error', 'Could not log lesson.'); }
  };

  const handleSaveEditedLesson = async () => {
    if (!lessonEditForm.id || !lessonEditForm.studentId) return;
    const validDate = normalizeISODate(lessonEditForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    if (!lessonEditForm.technique.trim() && !lessonEditForm.repertoire.trim() && !lessonEditForm.assignment.trim()) return Alert.alert('Validation', 'Enter at least one lesson detail.');
    try {
      triggerLayoutAnimation();
      await updateDoc(doc(db, 'lessons', lessonEditForm.id), { studentId: lessonEditForm.studentId, date: validDate, technique: lessonEditForm.technique.trim(), repertoire: lessonEditForm.repertoire.trim(), assignment: lessonEditForm.assignment.trim() });
      await logActivity('Updated Lesson', `${studentMap[lessonEditForm.studentId]?.name || 'Student'} (${formatReadableLocalDate(validDate)})`);
      setLessonEditModal(false);
    } catch (e) { Alert.alert('Error', 'Could not update lesson.'); }
  };

  const handleSaveInlineAttendance = async () => {
    if (!selectedStudentId) return;
    const validDate = normalizeISODate(inlineAttendanceForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    try {
      triggerLayoutAnimation();
      const existingRecord = activeAttendance.find((a) => a.studentId === selectedStudentId && a.date === validDate);
      if (existingRecord) {
        await updateDoc(doc(db, 'attendance', existingRecord.id), { status: inlineAttendanceForm.status, remarks: inlineAttendanceForm.remarks.trim() });
        await logActivity('Updated Attendance', `${studentMap[selectedStudentId]?.name || 'Student'} • ${inlineAttendanceForm.status}`);
      } else {
        await addDoc(collection(db, 'attendance'), { studentId: selectedStudentId, date: validDate, status: inlineAttendanceForm.status, remarks: inlineAttendanceForm.remarks.trim(), isDeleted: false, deletedAt: null });
        await logActivity('Marked Attendance', `${studentMap[selectedStudentId]?.name || 'Student'} • ${inlineAttendanceForm.status}`);
      }
      setInlineAttendanceForm({ date: getTodayISO(), status: 'Present', remarks: '' });
    } catch (e) { Alert.alert('Error', 'Could not save attendance.'); }
  };

  const handleSaveModalAttendance = async () => {
    if (!attendanceModalForm.studentId) return Alert.alert('Validation', 'Please select a Student.');
    const validDate = normalizeISODate(attendanceModalForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    try {
      triggerLayoutAnimation();
      const payload = { studentId: attendanceModalForm.studentId, date: validDate, status: attendanceModalForm.status, remarks: attendanceModalForm.remarks.trim() };
      const duplicateRecord = activeAttendance.find((a) => a.studentId === payload.studentId && a.date === validDate && a.id !== attendanceModalForm.id);
      if (attendanceModalForm.id) {
        if (duplicateRecord) return Alert.alert('Duplicate Date', 'An attendance entry already exists for this student on that date.');
        await updateDoc(doc(db, 'attendance', attendanceModalForm.id), payload);
        await logActivity('Updated Attendance', `${studentMap[payload.studentId]?.name || 'Student'} • ${payload.status}`);
      } else if (duplicateRecord) {
        await updateDoc(doc(db, 'attendance', duplicateRecord.id), payload);
        await logActivity('Updated Attendance', `${studentMap[payload.studentId]?.name || 'Student'} • ${payload.status}`);
      } else {
        await addDoc(collection(db, 'attendance'), { ...payload, isDeleted: false, deletedAt: null });
        await logActivity('Marked Attendance', `${studentMap[payload.studentId]?.name || 'Student'} • ${payload.status}`);
      }
      setAttendanceModal(false);
    } catch (e) { Alert.alert('Error', 'Could not save attendance.'); }
  };

  const handleSaveStudentNotes = async () => {
    if (!selectedStudentId) return;
    try {
      await updateDoc(doc(db, 'students', selectedStudentId), { notes: noteDraft, priorityNote: priorityDraft });
      await logActivity('Updated Student Notes', studentMap[selectedStudentId]?.name || '');
      Alert.alert('Saved', 'Student notes updated.');
    } catch (e) { Alert.alert('Error', 'Could not update student notes.'); }
  };

  const handleSaveFee = async (shouldSharePDF = false) => {
    if (!feeForm.studentId) return Alert.alert('Validation', 'Please select a Student.');
    if (feeForm.feeType === 'Monthly Fee' && !feeForm.monthPaidFor.trim()) return Alert.alert('Validation', '"Month Paid For" is required for Monthly Fees.');
    const validDate = normalizeISODate(feeForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    const numericPaid = feeForm.status === 'Unpaid' ? 0 : parseFloat(sanitizeCurrency(feeForm.amountPaid)) || 0;
    const numericBalance = feeForm.status === 'Paid' ? 0 : parseFloat(sanitizeCurrency(feeForm.balanceDue)) || 0;
    if (feeForm.status === 'Unpaid' && numericBalance <= 0) return Alert.alert('Validation', 'Unpaid records require a Balance Due greater than ₹0.');
    if (feeForm.status === 'Paid' && numericPaid <= 0) return Alert.alert('Validation', 'Paid records require an Amount Paid greater than ₹0.');
    if (feeForm.status === 'Partial' && (numericPaid <= 0 || numericBalance <= 0)) return Alert.alert('Validation', 'Partial payments require both Amount Paid and Balance Due to be greater than ₹0.');

    try {
      triggerLayoutAnimation();
      const payload = { studentId: feeForm.studentId, feeType: feeForm.feeType, monthPaidFor: feeForm.feeType === 'Monthly Fee' ? feeForm.monthPaidFor.trim() : '', date: validDate, mode: feeForm.mode, status: feeForm.status, amountPaid: numericPaid, balanceDue: numericBalance, remarks: feeForm.remarks.trim() };
      if (feeForm.id) { await updateDoc(doc(db, 'fees', feeForm.id), payload); await logActivity('Updated Fee Record', `${studentMap[payload.studentId]?.name || 'Student'} • ₹${numericPaid}`); }
      else { await addDoc(collection(db, 'fees'), { ...payload, isDeleted: false, deletedAt: null }); await logActivity('Recorded Fee', `${studentMap[payload.studentId]?.name || 'Student'} • ₹${numericPaid} (${payload.status})`); }
      setFeeModal(false);
      if (shouldSharePDF) await generateAndShareReceiptPDF(payload);
    } catch (e) { Alert.alert('Error', 'Could not save fee record.'); }
  };

  const handleUpdateNotice = async () => {
    try {
      const today = getTodayISO();
      await setDoc(doc(db, 'settings', 'noticeBoard'), { text: noticeInput.trim(), updatedDate: today });
      await logActivity('Updated Notice Board', formatReadableLocalDate(today));
      setNoticeEditModal(false);
    } catch (e) { Alert.alert('Error', 'Could not update notice board.'); }
  };

  const handleRestoreTrashItem = async (item) => {
    try { triggerLayoutAnimation(); await updateDoc(doc(db, item._col, item.id), { isDeleted: false, deletedAt: null }); await logActivity('Restored from Trash', item._label); } catch (e) { Alert.alert('Error', 'Could not restore item.'); }
  };

  const handlePermanentDeleteItem = async (item) => {
    try {
      triggerLayoutAnimation();
      const batch = writeBatch(db);
      batch.delete(doc(db, item._col, item.id));
      if (item._col === 'students') {
        lessons.filter((l) => l.studentId === item.id).forEach((l) => batch.delete(doc(db, 'lessons', l.id)));
        attendance.filter((a) => a.studentId === item.id).forEach((a) => batch.delete(doc(db, 'attendance', a.id)));
        fees.filter((f) => f.studentId === item.id).forEach((f) => batch.delete(doc(db, 'fees', f.id)));
      }
      await batch.commit();
      await logActivity('Permanently Deleted', item._label);
    } catch (e) { Alert.alert('Error', 'Could not delete item.'); }
  };

  const handleEmptyTrash = () => {
    if (trashItems.length === 0) return;
    Alert.alert('Empty Trash Permanently?', `This will permanently erase ${trashItems.length} item(s).`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Empty Trash', style: 'destructive', onPress: async () => {
          try {
            triggerLayoutAnimation();
            const batch = writeBatch(db);
            const deletedStudentIds = new Set(trashItems.filter((i) => i._col === 'students').map((i) => i.id));
            const docsToDelete = new Map();
            trashItems.forEach((item) => docsToDelete.set(`${item._col}/${item.id}`, { col: item._col, id: item.id }));
            if (deletedStudentIds.size > 0) {
              lessons.filter((l) => deletedStudentIds.has(l.studentId)).forEach((l) => docsToDelete.set(`lessons/${l.id}`, { col: 'lessons', id: l.id }));
              attendance.filter((a) => deletedStudentIds.has(a.studentId)).forEach((a) => docsToDelete.set(`attendance/${a.id}`, { col: 'attendance', id: a.id }));
              fees.filter((f) => deletedStudentIds.has(f.studentId)).forEach((f) => docsToDelete.set(`fees/${f.id}`, { col: 'fees', id: f.id }));
            }
            Array.from(docsToDelete.values()).slice(0, 450).forEach((entry) => batch.delete(doc(db, entry.col, entry.id)));
            await batch.commit();
            await logActivity('Emptied Trash Archive', `${trashItems.length} items removed`);
          } catch (e) { Alert.alert('Error', 'Failed to empty trash.'); }
        },
      },
    ]);
  };

  const groupRecordsBySubjectAndMonth = useCallback((records) => {
    const grouped = [];
    const activeSubjectIds = new Set(activeSubjects.map((s) => s.id));
    activeSubjects.forEach((subj) => {
      const subjectRecords = records.filter((r) => studentMap[r.studentId]?.subjectId === subj.id);
      if (subjectRecords.length > 0) {
        const monthsMap = {};
        subjectRecords.forEach((rec) => { const mLabel = getMonthYearFromISO(rec.date); if (!monthsMap[mLabel]) monthsMap[mLabel] = []; monthsMap[mLabel].push(rec); });
        grouped.push({ subject: subj, months: Object.entries(monthsMap).map(([monthName, items]) => ({ monthName, items })) });
      }
    });
    const unassignedRecords = records.filter((r) => !activeSubjectIds.has(studentMap[r.studentId]?.subjectId));
    if (unassignedRecords.length > 0) {
      const monthsMap = {};
      unassignedRecords.forEach((rec) => { const mLabel = getMonthYearFromISO(rec.date); if (!monthsMap[mLabel]) monthsMap[mLabel] = []; monthsMap[mLabel].push(rec); });
      grouped.push({ subject: { id: '_unassigned', name: 'Unassigned / Other' }, months: Object.entries(monthsMap).map(([monthName, items]) => ({ monthName, items })) });
    }
    return grouped;
  }, [activeSubjects, studentMap]);

  const renderHomeTab = () => {
    const recentFourActivities = activities.slice(0, 4);
    const todayISO = getTodayISO();
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Surface style={styles.heroCard} elevation={4}>
          <View style={styles.crestBadge}><Text style={styles.crestBadgeText}>★ JSM APP • EST. 2022 ★</Text></View>
          <Text style={styles.heroGreeting}>{getGreetingByLocalTime()}, Maestro</Text>
          <Text style={styles.heroDate}>{formatReadableLocalDate(todayISO)}</Text>
          <View style={styles.heroDivider} />
          <View style={styles.heroStatRow}>
            <View><Text style={styles.heroStatLabel}>ACTIVE ENROLLMENT</Text><Text style={styles.heroStatValue}>{activeStudents.length} Students</Text></View>
            <View style={{ alignItems: 'flex-end' }}><Text style={styles.heroStatLabel}>DEPARTMENTS</Text><Text style={styles.heroStatValue}>{activeSubjects.length} Instruments</Text></View>
          </View>
        </Surface>

        <Surface style={styles.creamCard} elevation={1}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="megaphone-outline" size={16} color={COLORS.navy} />
              <Text style={styles.sectionTitle}>JSM APP NOTICE BOARD</Text>
            </View>
            {noticeUpdatedAt ? <Text style={styles.silverMeta}>{formatReadableLocalDate(noticeUpdatedAt)}</Text> : null}
          </View>
          <Text style={styles.noticePreviewText} numberOfLines={3}>{noticeText ? noticeText : 'No active announcements posted.'}</Text>
          <View style={styles.noticeActionRow}>
            <PaperButton mode="outlined" textColor={COLORS.navy} style={{ borderColor: COLORS.silver }} onPress={() => setNoticeReadModal(true)}>Read More</PaperButton>
            <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => { setNoticeInput(noticeText); setNoticeEditModal(true); }}>Update Notice</PaperButton>
          </View>
        </Surface>

        <View style={styles.bentoRow}>
          <TouchableOpacity style={[styles.bentoCard, { backgroundColor: COLORS.navy }]} onPress={() => {
              if (activeSubjects.length === 0) return Alert.alert('Create Subject First', 'Please add at least one instrument in Manage Subjects before registering a student.');
              setStudentForm({ id: null, name: '', subjectId: activeSubjects[0]?.id || '', phone: '', guardian: '', joinedDate: getTodayISO() });
              setStudentModal(true);
            }}>
            <MaterialCommunityIcons name="account-music-outline" size={28} color={COLORS.gold} />
            <Text style={styles.bentoTitleGold}>Add Student</Text><Text style={styles.bentoSubCream}>New Registration</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.bentoCard, { backgroundColor: COLORS.cream, borderColor: COLORS.gold, borderWidth: 1.2 }]} onPress={() => { setSubjectForm({ id: null, name: '' }); setSubjectsModal(true); }}>
            <MaterialCommunityIcons name="piano" size={28} color={COLORS.navy} />
            <Text style={styles.bentoTitleNavy}>Manage Subjects</Text><Text style={styles.bentoSubSilver}>{activeSubjects.length} Active</Text>
          </TouchableOpacity>
        </View>

        <Surface style={styles.whiteCard} elevation={1}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>RECENT ACTIVITY AUDIT</Text>
            <PaperButton mode="outlined" buttonColor={COLORS.navy} textColor={COLORS.gold} style={{ borderColor: COLORS.gold }} labelStyle={{ fontSize: 11 }} onPress={() => setTodayLogModal(true)}>Today's Log</PaperButton>
          </View>
          {recentFourActivities.length === 0 ? <Text style={styles.emptyText}>No recent actions recorded yet.</Text> : recentFourActivities.map((act) => (
            <View key={act.id} style={styles.activityItem}>
              <View style={styles.activityDot} />
              <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{act.title}</Text>{act.subtitle ? <Text style={styles.activitySub}>{act.subtitle}</Text> : null}</View>
              <Text style={styles.silverMeta}>{formatReadableLocalDate(act.dateISO)}</Text>
            </View>
          ))}
        </Surface>
      </ScrollView>
    );
  };

  const renderStudentCard = (st) => {
    const metrics = getStudentMetrics(st.id);
    return (
      <Pressable key={st.id} style={({ pressed }) => pressed && styles.cardPressed} onPress={() => { setSelectedStudentId(st.id); setProfileTab('Classes'); }} onLongPress={() => openLongPressMenu('student', st, st.name)} delayLongPress={300}>
        <Surface style={styles.cleanRecordCard} elevation={2}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.recordPrimaryTitle}>{st.name}</Text>
              {st.priorityNote ? <View style={styles.priorityBadge}><Text style={styles.priorityBadgeText}>★ NOTE</Text></View> : null}
            </View>
            <Text style={styles.recordSecondarySub}>Joined {formatReadableLocalDate(st.joinedDate)} • Attendance: {metrics.attendancePct}</Text>
          </View>
          <View style={[styles.feeBadge, metrics.feeStatus === 'Paid' ? styles.feeBadgePaid : metrics.feeStatus === 'Due / Unpaid' ? styles.feeBadgeDue : styles.feeBadgeNeutral]}>
            <Text style={styles.feeBadgeText}>{metrics.feeStatus}</Text>
          </View>
        </Surface>
      </Pressable>
    );
  };

  const renderStudentsTab = () => {
    if (selectedStudent) return renderStudentProfile(selectedStudent);
    const query = studentSearch.trim().toLowerCase();
    const filteredStudents = activeStudents.filter((st) => {
      const matchesQuery = !query || (st.name || '').toLowerCase().includes(query) || (st.phone || '').toLowerCase().includes(query) || (subjectMap[st.subjectId]?.name || '').toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (studentFilter === 'Priority') return Boolean(st.priorityNote);
      if (studentFilter === 'Due') return getStudentMetrics(st.id).feeStatus === 'Due / Unpaid';
      return true;
    });
    const unassignedStudents = filteredStudents.filter((st) => !new Set(activeSubjects.map((s) => s.id)).has(st.subjectId));

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}><Text style={styles.pageHeading}>Student Directory</Text><Text style={styles.silverMeta}>Tap to open profile • Hold card to edit/delete</Text></View>
          <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => {
            if (activeSubjects.length === 0) return Alert.alert('Subject Required', 'Add an instrument in Manage Subjects first.');
            setStudentForm({ id: null, name: '', subjectId: activeSubjects[0]?.id || '', phone: '', guardian: '', joinedDate: getTodayISO() });
            setStudentModal(true);
          }}>+ Student</PaperButton>
        </View>

        <PaperInput mode="outlined" placeholder="Search student, instrument, or phone..." value={studentSearch} onChangeText={setStudentSearch} left={<PaperInput.Icon icon="magnify" />} right={studentSearch.length > 0 && <PaperInput.Icon icon="close-circle" onPress={() => setStudentSearch('')} />} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 14 }} />

        <View style={[styles.chipRow, { marginBottom: 14 }]}>
          {[{ key: 'All', label: `All (${activeStudents.length})` }, { key: 'Due', label: 'Due / Unpaid' }, { key: 'Priority', label: '★ Priority Notes' }].map((f) => (
            <TouchableOpacity key={f.key} style={[styles.choiceChip, studentFilter === f.key && styles.choiceChipSelected]} onPress={() => setStudentFilter(f.key)}>
              <Text style={[styles.choiceChipText, studentFilter === f.key && styles.choiceChipTextSelected]}>{f.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeSubjects.length === 0 && unassignedStudents.length === 0 ? (
          <Surface style={styles.whiteCard} elevation={1}><Text style={styles.emptyText}>No subjects configured. Open "Manage Subjects" on the Home Dashboard to add instruments.</Text></Surface>
        ) : (
          <>
            {activeSubjects.map((subj) => {
              const subjStudents = filteredStudents.filter((s) => s.subjectId === subj.id);
              if ((query || studentFilter !== 'All') && subjStudents.length === 0) return null;
              return (
                <View key={subj.id} style={styles.groupBlock}>
                  <View style={styles.groupHeaderBar}><Text style={styles.groupHeaderTitle}>{subj.name.toUpperCase()}</Text><Text style={styles.groupHeaderCount}>{subjStudents.length}</Text></View>
                  {subjStudents.length === 0 ? <Text style={styles.emptyGroupText}>No students enrolled in {subj.name}</Text> : subjStudents.map(renderStudentCard)}
                </View>
              );
            })}
            {unassignedStudents.length > 0 && (
              <View style={styles.groupBlock}>
                <View style={styles.groupHeaderBar}><Text style={styles.groupHeaderTitle}>UNASSIGNED / OTHER</Text><Text style={styles.groupHeaderCount}>{unassignedStudents.length}</Text></View>
                {unassignedStudents.map(renderStudentCard)}
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  const renderStudentProfile = (student) => {
    const metrics = getStudentMetrics(student.id);
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.cardHeaderRow}>
          <TouchableOpacity style={styles.backButtonRow} onPress={() => setSelectedStudentId(null)}>
            <Ionicons name="arrow-back" size={18} color={COLORS.navy} /><Text style={styles.backButtonText}>Back to Directory</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => openLongPressMenu('student', student, student.name)}>
            <Ionicons name="create-outline" size={15} color={COLORS.navy} /><Text style={styles.secondaryButtonSmallText}>Edit Student</Text>
          </TouchableOpacity>
        </View>

        <Surface style={styles.heroCard} elevation={3}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.crestBadgeText}>{(subjectMap[student.subjectId]?.name || 'Unassigned').toUpperCase()} DEPARTMENT</Text>
              <Text style={styles.heroGreeting}>{student.name}</Text>
              {student.guardian ? <Text style={styles.heroDate}>Guardian: {student.guardian}</Text> : null}
              {student.phone ? <Text style={styles.heroDate}>Contact: {student.phone}</Text> : null}
            </View>
            {student.priorityNote ? <View style={styles.priorityBadge}><Text style={styles.priorityBadgeText}>★ NOTE</Text></View> : null}
          </View>
          {student.phone ? (
            <View style={styles.contactActionRow}>
              <TouchableOpacity style={styles.contactActionBtn} onPress={() => handlePhoneCall(student.phone)}>
                <Ionicons name="call-outline" size={15} color={COLORS.gold} /><Text style={styles.contactActionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.contactActionBtn} onPress={() => handleOpenWhatsApp(student.phone, student.name)}>
                <Ionicons name="logo-whatsapp" size={15} color={COLORS.gold} /><Text style={styles.contactActionText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.profileStatsGrid}>
            <View style={styles.profileStatBox}><Text style={styles.profileStatLabel}>ATTENDANCE</Text><Text style={styles.profileStatVal}>{metrics.attendancePct}</Text></View>
            <View style={styles.profileStatBox}><Text style={styles.profileStatLabel}>CLASSES TAKEN</Text><Text style={styles.profileStatVal}>{metrics.classesTaken}</Text></View>
            <View style={styles.profileStatBox}><Text style={styles.profileStatLabel}>FEE STATUS</Text><Text style={[styles.profileStatVal, { fontSize: 13, color: metrics.feeStatus === 'Due / Unpaid' ? '#FFB4A2' : COLORS.gold }]}>{metrics.feeStatus}</Text></View>
          </View>
        </Surface>

        <View style={styles.pillNavContainer}>
          {['Classes', 'Attendance', 'Notes', 'Fees'].map((tab) => (
            <TouchableOpacity key={tab} style={[styles.pillNavItem, profileTab === tab && styles.pillNavItemActive]} onPress={() => { triggerLayoutAnimation(); setProfileTab(tab); }}>
              <Text style={[styles.pillNavText, profileTab === tab && styles.pillNavTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {profileTab === 'Classes' && (
          <View>
            <Surface style={styles.whiteCard} elevation={1}>
              <Text style={styles.sectionTitle}>LOG NEW LESSON</Text>
              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <QuickDateRow currentDate={inlineLessonForm.date} onSelectDate={(d) => setInlineLessonForm({ ...inlineLessonForm, date: d })} />
              <PaperInput mode="outlined" value={inlineLessonForm.date} onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, date: t })} placeholder="YYYY-MM-DD" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Technique</Text>
              <PaperInput mode="outlined" value={inlineLessonForm.technique} onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, technique: t })} placeholder="Scales, arpeggios, posture..." outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Repertoire</Text>
              <PaperInput mode="outlined" value={inlineLessonForm.repertoire} onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, repertoire: t })} placeholder="Sonatina in C, Etude Op. 10..." outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Assignment</Text>
              <PaperInput mode="outlined" value={inlineLessonForm.assignment} onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, assignment: t })} placeholder="Practice measures 16-32 at 80 BPM" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveInlineLesson} style={{ marginTop: 10, borderRadius: 8 }}>Save Lesson Entry</PaperButton>
            </Surface>
            <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>LESSON HISTORY (HOLD CARD TO EDIT/DELETE)</Text>
            {metrics.stLessons.length === 0 ? <Text style={styles.emptyText}>No lessons logged for this student yet.</Text> : metrics.stLessons.map((les) => (
              <Pressable key={les.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('lesson', les, `Lesson on ${formatReadableLocalDate(les.date)}`)} delayLongPress={300}>
                <Surface style={styles.cleanRecordCard} elevation={2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordPrimaryTitle}>{formatReadableLocalDate(les.date)}</Text>
                    {les.technique ? <Text style={styles.recordDetailLine}><Text style={styles.boldLabel}>Technique: </Text>{les.technique}</Text> : null}
                    {les.repertoire ? <Text style={styles.recordDetailLine}><Text style={styles.boldLabel}>Repertoire: </Text>{les.repertoire}</Text> : null}
                    {les.assignment ? <Text style={styles.recordDetailLine}><Text style={styles.boldLabel}>Assignment: </Text>{les.assignment}</Text> : null}
                  </View>
                </Surface>
              </Pressable>
            ))}
          </View>
        )}

        {profileTab === 'Attendance' && (
          <View>
            <Surface style={styles.whiteCard} elevation={1}>
              <Text style={styles.sectionTitle}>MARK STUDENT ATTENDANCE</Text>
              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <QuickDateRow currentDate={inlineAttendanceForm.date} onSelectDate={(d) => setInlineAttendanceForm({ ...inlineAttendanceForm, date: d })} />
              <PaperInput mode="outlined" value={inlineAttendanceForm.date} onChangeText={(t) => setInlineAttendanceForm({ ...inlineAttendanceForm, date: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Status</Text>
              <View style={styles.chipRow}>
                {ATTENDANCE_STATUSES.map((st) => (
                  <TouchableOpacity key={st} style={[styles.choiceChip, inlineAttendanceForm.status === st && styles.choiceChipSelected]} onPress={() => setInlineAttendanceForm({ ...inlineAttendanceForm, status: st })}>
                    <Text style={[styles.choiceChipText, inlineAttendanceForm.status === st && styles.choiceChipTextSelected]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Remarks</Text>
              <PaperInput mode="outlined" value={inlineAttendanceForm.remarks} onChangeText={(t) => setInlineAttendanceForm({ ...inlineAttendanceForm, remarks: t })} placeholder="Optional attendance notes" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveInlineAttendance} style={{ marginTop: 10, borderRadius: 8 }}>Record Attendance</PaperButton>
            </Surface>
            <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>ATTENDANCE LOG (HOLD CARD TO EDIT/DELETE)</Text>
            {metrics.stAttendance.length === 0 ? <Text style={styles.emptyText}>No attendance records found.</Text> : metrics.stAttendance.map((att) => (
              <Pressable key={att.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('attendance', att, `${att.status} (${formatReadableLocalDate(att.date)})`)} delayLongPress={300}>
                <Surface style={styles.cleanRecordCard} elevation={2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordPrimaryTitle}>{formatReadableLocalDate(att.date)}</Text>
                    {att.remarks ? <Text style={styles.recordSecondarySub}>{att.remarks}</Text> : null}
                  </View>
                  <View style={styles.statusPill}><Text style={styles.statusPillText}>{att.status}</Text></View>
                </Surface>
              </Pressable>
            ))}
          </View>
        )}

        {profileTab === 'Notes' && (
          <Surface style={styles.whiteCard} elevation={1}>
            <Text style={styles.sectionTitle}>FACULTY STUDENT NOTES</Text>
            <View style={styles.prioritySwitchRow}>
              <View style={{ flex: 1 }}><Text style={styles.recordPrimaryTitle}>Priority "★ NOTE" Indicator</Text><Text style={styles.silverMeta}>Highlights student card in the main Student Directory</Text></View>
              <Switch value={priorityDraft} onValueChange={setPriorityDraft} trackColor={{ false: COLORS.silver, true: COLORS.navy }} thumbColor={priorityDraft ? COLORS.gold : COLORS.white} />
            </View>
            <PaperInput mode="outlined" multiline numberOfLines={5} value={noteDraft} onChangeText={setNoteDraft} placeholder="Enter examination goals, recital readiness, or parent communication notes..." outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginTop: 12 }} />
            <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveStudentNotes} style={{ marginTop: 12, borderRadius: 8 }}>Save Notes</PaperButton>
          </Surface>
        )}

        {profileTab === 'Fees' && (
          <View>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>LOCALIZED FEE LEDGER</Text>
              <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => {
                setFeeForm({ id: null, studentId: student.id, feeType: 'Monthly Fee', monthPaidFor: getLocalCurrentMonthLabel(), date: getTodayISO(), mode: 'UPI', status: 'Paid', amountPaid: '', balanceDue: '0', remarks: '' });
                setFeeModal(true);
              }}>+ Record Fee</PaperButton>
            </View>
            {metrics.stFees.length === 0 ? <Surface style={styles.whiteCard} elevation={1}><Text style={styles.emptyText}>No fee records logged for this student.</Text></Surface> : metrics.stFees.map((fee) => (
              <Pressable key={fee.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('fee', fee, `${fee.feeType} - ₹${fee.amountPaid} (${formatReadableLocalDate(fee.date)})`)} delayLongPress={300}>
                <Surface style={styles.cleanRecordCard} elevation={2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordPrimaryTitle}>{fee.feeType} {fee.feeType === 'Monthly Fee' && fee.monthPaidFor ? `• ${fee.monthPaidFor}` : ''}</Text>
                    <Text style={styles.recordSecondarySub}>{formatReadableLocalDate(fee.date)} • {fee.mode} • Status: {fee.status}</Text>
                    <Text style={styles.recordDetailLine}>Paid: ₹{fee.amountPaid} | Balance Due: ₹{fee.balanceDue}</Text>
                    {fee.remarks ? <Text style={styles.silverMeta}>Note: {fee.remarks}</Text> : null}
                  </View>
                  <TouchableOpacity style={styles.pdfShareBtn} onPress={() => generateAndShareReceiptPDF(fee)}>
                    <Ionicons name="share-social-outline" size={13} color={COLORS.gold} /><Text style={styles.pdfShareBtnText}>Receipt</Text>
                  </TouchableOpacity>
                </Surface>
              </Pressable>
            ))}
          </View>
        )}
      </ScrollView>
    );
  };

  const renderAttendanceTab = () => {
    const filteredRecords = attendanceFilterAllMonths ? activeAttendance : activeAttendance.filter((a) => isWithinLastTwoLocalMonths(a.date));
    const groupedAttendance = groupRecordsBySubjectAndMonth(filteredRecords);
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}><Text style={styles.pageHeading}>Attendance Register</Text><Text style={styles.silverMeta}>{attendanceFilterAllMonths ? 'Showing complete history' : 'Showing last 2 months'} • Hold card to edit/delete</Text></View>
          <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => {
            if (activeStudents.length === 0) return Alert.alert('No Students', 'Add a student before marking attendance.');
            setAttendanceModalForm({ id: null, studentId: activeStudents[0]?.id || '', date: getTodayISO(), status: 'Present', remarks: '' });
            setAttendanceModal(true);
          }}>+ Mark</PaperButton>
        </View>
        <View style={{ marginBottom: 12, flexDirection: 'row', justifyContent: 'flex-end' }}>
          <PaperButton mode="outlined" textColor={COLORS.navy} style={{ borderColor: COLORS.silver }} onPress={() => { triggerLayoutAnimation(); setAttendanceFilterAllMonths(!attendanceFilterAllMonths); }}>
            {attendanceFilterAllMonths ? 'Show Last 2 Months' : 'View All Months'}
          </PaperButton>
        </View>

        {groupedAttendance.length === 0 ? <Surface style={styles.whiteCard} elevation={1}><Text style={styles.emptyText}>No attendance records in this timeframe.</Text></Surface> : groupedAttendance.map((group) => (
          <View key={group.subject.id} style={styles.groupBlock}>
            <View style={styles.groupHeaderBar}><Text style={styles.groupHeaderTitle}>{group.subject.name.toUpperCase()}</Text></View>
            {group.months.map((mGroup) => (
              <View key={mGroup.monthName} style={{ marginTop: 8 }}>
                <Text style={styles.monthSubHeader}>{mGroup.monthName}</Text>
                {mGroup.items.map((att) => {
                  const st = studentMap[att.studentId];
                  return (
                    <Pressable key={att.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('attendance', att, `${st?.name || 'Student'} - ${att.status} (${formatReadableLocalDate(att.date)})`)} delayLongPress={300}>
                      <Surface style={styles.cleanRecordCard} elevation={2}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordPrimaryTitle}>{st?.name || 'Unknown'}</Text>
                          <Text style={styles.recordSecondarySub}>{formatReadableLocalDate(att.date)}{att.remarks ? ` • ${att.remarks}` : ''}</Text>
                        </View>
                        <View style={styles.statusPill}><Text style={styles.statusPillText}>{att.status}</Text></View>
                      </Surface>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderFeesTab = () => {
    const groupedFees = groupRecordsBySubjectAndMonth(activeFees);
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}><Text style={styles.pageHeading}>Global Fee Ledger</Text><Text style={styles.silverMeta}>Grouped by Subject & Month • Hold card to edit/delete</Text></View>
          <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => {
            if (activeStudents.length === 0) return Alert.alert('No Students', 'Enroll a student before recording fees.');
            setFeeForm({ id: null, studentId: activeStudents[0]?.id || '', feeType: 'Monthly Fee', monthPaidFor: getLocalCurrentMonthLabel(), date: getTodayISO(), mode: 'UPI', status: 'Paid', amountPaid: '', balanceDue: '0', remarks: '' });
            setFeeModal(true);
          }}>+ Record Fee</PaperButton>
        </View>

        <View style={styles.ledgerSummaryRow}>
          <View style={[styles.ledgerSummaryBox, { backgroundColor: COLORS.navy }]}><Text style={styles.ledgerSummaryLabel}>TOTAL COLLECTED</Text><Text style={styles.ledgerSummaryValGold}>₹{globalFeeTotals.collected.toFixed(0)}</Text></View>
          <View style={[styles.ledgerSummaryBox, { backgroundColor: COLORS.cream, borderColor: COLORS.gold, borderWidth: 1 }]}><Text style={[styles.ledgerSummaryLabel, { color: COLORS.navy }]}>PENDING BALANCE</Text><Text style={[styles.ledgerSummaryValGold, { color: COLORS.danger }]}>₹{globalFeeTotals.pending.toFixed(0)}</Text></View>
        </View>

        {groupedFees.length === 0 ? <Surface style={styles.whiteCard} elevation={1}><Text style={styles.emptyText}>No fee transactions recorded yet.</Text></Surface> : groupedFees.map((group) => (
          <View key={group.subject.id} style={styles.groupBlock}>
            <View style={styles.groupHeaderBar}><Text style={styles.groupHeaderTitle}>{group.subject.name.toUpperCase()}</Text></View>
            {group.months.map((mGroup) => (
              <View key={mGroup.monthName} style={{ marginTop: 8 }}>
                <Text style={styles.monthSubHeader}>{mGroup.monthName}</Text>
                {mGroup.items.map((fee) => {
                  const st = studentMap[fee.studentId];
                  const isFullyPaid = fee.status === 'Paid' && Number(fee.balanceDue || 0) === 0;
                  return (
                    <Pressable key={fee.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('fee', fee, `${st?.name || 'Student'} - ₹${fee.amountPaid}`)} delayLongPress={300}>
                      <Surface style={styles.cleanRecordCard} elevation={2}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordPrimaryTitle}>{st?.name || 'Unknown'} • {fee.feeType}</Text>
                          <Text style={styles.recordSecondarySub}>{formatReadableLocalDate(fee.date)} • {fee.mode}{fee.feeType === 'Monthly Fee' && fee.monthPaidFor ? ` • For ${fee.monthPaidFor}` : ''}</Text>
                          <Text style={styles.recordDetailLine}>Paid: ₹{fee.amountPaid} | Balance: ₹{fee.balanceDue}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end', gap: 6 }}>
                          <View style={[styles.feeBadge, isFullyPaid ? styles.feeBadgePaid : styles.feeBadgeDue]}><Text style={styles.feeBadgeText}>{fee.status}</Text></View>
                          <TouchableOpacity style={styles.pdfShareBtnSmall} onPress={() => generateAndShareReceiptPDF(fee)}>
                            <Ionicons name="document-text-outline" size={12} color={COLORS.gold} /><Text style={styles.pdfShareBtnText}>PDF</Text>
                          </TouchableOpacity>
                        </View>
                      </Surface>
                    </Pressable>
                  );
                })}
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    );
  };

  const renderTrashTab = () => {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}><Text style={styles.pageHeading}>Trash Archive</Text><Text style={styles.silverMeta}>Items are auto-purged after 30 days. Tap any item to Restore or Delete Permanently.</Text></View>
          {trashItems.length > 0 && <PaperButton mode="contained" buttonColor={COLORS.danger} textColor={COLORS.white} onPress={handleEmptyTrash}>Empty Trash</PaperButton>}
        </View>

        {trashItems.length === 0 ? <Surface style={styles.whiteCard} elevation={1}><Text style={styles.emptyText}>Trash archive is completely clean.</Text></Surface> : trashItems.map((item) => {
          const daysLeft = getDaysRemainingInTrash(item.deletedAt);
          return (
            <TouchableOpacity key={`${item._col}-${item.id}`} onPress={() => {
              Alert.alert(item._label, `${daysLeft} days remaining before permanent purge.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Restore', onPress: () => handleRestoreTrashItem(item) },
                { text: 'Delete Permanently', style: 'destructive', onPress: () => handlePermanentDeleteItem(item) },
              ]);
            }}>
              <Surface style={styles.cleanRecordCard} elevation={2}>
                <View style={{ flex: 1 }}><Text style={styles.recordPrimaryTitle}>{item._label}</Text><Text style={styles.recordSecondarySub}>Collection: {item._col.toUpperCase()}</Text></View>
                <View style={styles.daysRemainingBadge}><Text style={styles.daysRemainingText}>{daysLeft}d left</Text></View>
              </Surface>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  return (
    <SafeAreaProvider>
      <PaperProvider theme={jsmTheme}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

          <Appbar.Header style={{ backgroundColor: COLORS.navy, borderBottomWidth: 2, borderBottomColor: COLORS.gold }}>
            <Appbar.Action icon="menu" color={COLORS.gold} onPress={openDrawer} />
            <Appbar.Content title="JSM APP" subtitle="EST. 2022" titleStyle={{ color: COLORS.white, fontSize: 18, fontWeight: '700', letterSpacing: 2 }} subtitleStyle={{ color: COLORS.gold, fontSize: 10, letterSpacing: 3, fontWeight: '600' }} style={{ alignItems: 'center' }} />
            <View style={{ width: 48 }} />
          </Appbar.Header>

          <AnimatedScreen triggerKey={`${activeTab}-${selectedStudentId || 'list'}`}>
            {activeTab === 'Home' && renderHomeTab()}
            {activeTab === 'Students' && renderStudentsTab()}
            {activeTab === 'Attendance' && renderAttendanceTab()}
            {activeTab === 'Fees' && renderFeesTab()}
            {activeTab === 'Trash' && renderTrashTab()}
          </AnimatedScreen>

          <View style={styles.bottomTabBar}>
            {[{ key: 'Home', icon: 'grid-outline', label: 'Home' }, { key: 'Students', icon: 'people-outline', label: 'Students' }, { key: 'Attendance', icon: 'calendar-check-outline', label: 'Attendance', mci: true }, { key: 'Fees', icon: 'card-outline', label: 'Fees' }, { key: 'Trash', icon: 'trash-outline', label: 'Trash' }].map((tab) => {
              const isFocused = activeTab === tab.key;
              return (
                <TouchableOpacity key={tab.key} style={styles.bottomTabItem} onPress={() => { if (tab.key !== 'Students') setSelectedStudentId(null); setActiveTab(tab.key); }}>
                  <View>
                    {tab.mci ? <MaterialCommunityIcons name={tab.icon} size={22} color={isFocused ? COLORS.gold : COLORS.silver} /> : <Ionicons name={tab.icon} size={22} color={isFocused ? COLORS.gold : COLORS.silver} />}
                    {tab.key === 'Trash' && trashItems.length > 0 && <View style={styles.trashTabBadge}><Text style={styles.trashTabBadgeText}>{trashItems.length}</Text></View>}
                  </View>
                  <Text style={[styles.bottomTabLabel, isFocused && styles.bottomTabLabelActive]}>{tab.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* ANIMATED SLIDE DRAWER */}
          <Modal visible={drawerOpen} transparent animationType="none" onRequestClose={() => closeDrawer()}>
            <View style={styles.drawerOverlay}>
              <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: drawerSlideAnim }] }]}>
                <View style={styles.drawerHeader}><Text style={styles.crestBadgeText}>★ JSM APP ★</Text><Text style={styles.drawerTitle}>Music School Portal</Text><Text style={styles.drawerSub}>Est. 2022 • Official Edition</Text></View>
                <View style={{ padding: 16, gap: 10 }}>
                  {[{ label: 'Home Dashboard', tab: 'Home', icon: 'grid-outline' }, { label: 'Student Directory', tab: 'Students', icon: 'people-outline' }, { label: 'Global Attendance', tab: 'Attendance', icon: 'calendar-outline' }, { label: 'Global Fee Register', tab: 'Fees', icon: 'card-outline' }, { label: `Trash Archive (${trashItems.length})`, tab: 'Trash', icon: 'trash-outline' }].map((nav) => (
                    <TouchableOpacity key={nav.tab} style={[styles.drawerNavItem, activeTab === nav.tab && styles.drawerNavItemActive]} onPress={() => { closeDrawer(() => { setSelectedStudentId(null); setActiveTab(nav.tab); }); }}>
                      <Ionicons name={nav.icon} size={18} color={activeTab === nav.tab ? COLORS.gold : COLORS.navy} /><Text style={[styles.drawerNavText, activeTab === nav.tab && styles.drawerNavTextActive]}>{nav.label}</Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.drawerDivider} />
                  <TouchableOpacity style={styles.drawerNavItem} onPress={() => { closeDrawer(() => { setSubjectForm({ id: null, name: '' }); setSubjectsModal(true); }); }}>
                    <Ionicons name="musical-notes-outline" size={18} color={COLORS.navy} /><Text style={styles.drawerNavText}>Manage Instruments & Order</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.drawerNavItem} onPress={handleCheckOTA} disabled={checkingOTA}>
                    {checkingOTA ? <ActivityIndicator size="small" color={COLORS.navy} /> : <><Ionicons name="cloud-download-outline" size={18} color={COLORS.navy} /><Text style={styles.drawerNavText}>Check for OTA Update</Text></>}
                  </TouchableOpacity>
                </View>
              </Animated.View>
              <Pressable style={{ flex: 1 }} onPress={() => closeDrawer()} />
            </View>
          </Modal>

          {/* LONG-PRESS CONTEXT MENU */}
          <Modal visible={contextMenu.visible} transparent animationType="fade" onRequestClose={closeContextMenu}>
            <Pressable style={styles.modalBackdrop} onPress={closeContextMenu}>
              <Pressable style={styles.contextSheet} onPress={(e) => e.stopPropagation()}>
                <Text style={styles.contextSheetHeader}>{contextMenu.title}</Text>
                <View style={styles.contextDivider} />
                <TouchableOpacity style={styles.contextOptionBtn} onPress={() => handleContextAction('edit')}><Text style={styles.contextOptionText}>Edit Record</Text></TouchableOpacity>
                {contextMenu.entityType === 'subject' && (
                  <><TouchableOpacity style={styles.contextOptionBtn} onPress={() => handleContextAction('moveUp')}><Text style={styles.contextOptionText}>Reorder: Move Up</Text></TouchableOpacity>
                  <TouchableOpacity style={styles.contextOptionBtn} onPress={() => handleContextAction('moveDown')}><Text style={styles.contextOptionText}>Reorder: Move Down</Text></TouchableOpacity></>
                )}
                <TouchableOpacity style={styles.contextOptionBtn} onPress={() => handleContextAction('delete')}><Text style={[styles.contextOptionText, { color: COLORS.danger }]}>Delete (Move to Trash)</Text></TouchableOpacity>
                <PaperButton mode="outlined" textColor={COLORS.navy} style={{ marginTop: 10, width: '100%', borderColor: COLORS.silver }} onPress={() => { const shouldReopen = contextMenu.reopenSubjectsModal; closeContextMenu(); if (shouldReopen) setSubjectsModal(true); }}>Cancel</PaperButton>
              </Pressable>
            </Pressable>
          </Modal>

          {/* NOTICE READ MODAL */}
          <Modal visible={noticeReadModal} transparent animationType="slide" onRequestClose={() => setNoticeReadModal(false)}>
            <View style={styles.modalBackdrop}>
              <Surface style={styles.modalCard} elevation={5}>
                <Text style={styles.sectionTitle}>JSM APP OFFICIAL NOTICE</Text>
                {noticeUpdatedAt ? <Text style={styles.silverMeta}>Posted {formatReadableLocalDate(noticeUpdatedAt)}</Text> : null}
                <ScrollView style={{ maxHeight: 260, marginVertical: 14 }}><Text style={styles.noticeFullText}>{noticeText || 'No active notice has been posted.'}</Text></ScrollView>
                <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => setNoticeReadModal(false)}>Close</PaperButton>
              </Surface>
            </View>
          </Modal>

          {/* NOTICE EDIT MODAL */}
          <Modal visible={noticeEditModal} transparent animationType="slide" onRequestClose={() => setNoticeEditModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
              <Surface style={styles.modalCard} elevation={5}>
                <Text style={styles.sectionTitle}>UPDATE NOTICE BOARD</Text>
                <PaperInput mode="outlined" multiline numberOfLines={5} value={noticeInput} onChangeText={setNoticeInput} placeholder="Type new JSM announcement..." outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginTop: 10, marginBottom: 14 }} />
                <View style={styles.modalBtnRow}>
                  <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => setNoticeEditModal(false)}>Cancel</PaperButton>
                  <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleUpdateNotice}>Publish</PaperButton>
                </View>
              </Surface>
            </KeyboardAvoidingView>
          </Modal>

          {/* TODAY'S AUDIT LOG MODAL */}
          <Modal visible={todayLogModal} transparent animationType="slide" onRequestClose={() => setTodayLogModal(false)}>
            <View style={styles.modalBackdrop}>
              <Surface style={styles.modalCard} elevation={5}>
                <Text style={styles.sectionTitle}>TODAY'S AUDIT LOG ({formatReadableLocalDate(getTodayISO())})</Text>
                <ScrollView style={{ maxHeight: 320, marginVertical: 12 }}>
                  {activities.filter((a) => a.dateISO === getTodayISO()).length === 0 ? <Text style={styles.emptyText}>No actions logged today.</Text> : activities.filter((a) => a.dateISO === getTodayISO()).map((act) => (
                    <View key={act.id} style={styles.activityItem}>
                      <View style={styles.activityDot} /><View style={{ flex: 1 }}><Text style={styles.activityTitle}>{act.title}</Text><Text style={styles.activitySub}>{act.subtitle}</Text></View>
                    </View>
                  ))}
                </ScrollView>
                <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => setTodayLogModal(false)}>Close</PaperButton>
              </Surface>
            </View>
          </Modal>

          {/* MANAGE SUBJECTS MODAL */}
          <Modal visible={subjectsModal} transparent animationType="slide" onRequestClose={() => setSubjectsModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
              <Surface style={styles.modalCard} elevation={5}>
                <Text style={styles.sectionTitle}>MANAGE INSTRUMENTS & SUBJECTS</Text>
                <Text style={styles.silverMeta}>Use the action buttons or long-press any subject to reorder, edit, or delete.</Text>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                  <PaperInput mode="outlined" value={subjectForm.name} onChangeText={(t) => setSubjectForm({ ...subjectForm, name: t })} placeholder="e.g., Piano, Violin, Guitar" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ flex: 1, backgroundColor: COLORS.white, height: 50 }} />
                  <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveSubject}>{subjectForm.id ? 'Update' : 'Add'}</PaperButton>
                </View>
                <ScrollView style={{ maxHeight: 280, marginVertical: 14 }}>
                  {activeSubjects.length === 0 ? <Text style={styles.emptyText}>No subjects added yet.</Text> : activeSubjects.map((subj, idx) => (
                    <Pressable key={subj.id} onLongPress={() => { setSubjectsModal(false); setTimeout(() => openLongPressMenu('subject', subj, subj.name, true), 200); }} delayLongPress={300}>
                      <Surface style={styles.cleanRecordCard} elevation={2}>
                        <Text style={[styles.recordPrimaryTitle, { flex: 1 }]}>{idx + 1}. {subj.name}</Text>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity style={styles.iconActionBtn} disabled={idx === 0} onPress={() => handleMoveSubjectOrder(subj, 'moveUp')}><Ionicons name="arrow-up" size={15} color={idx === 0 ? COLORS.silver : COLORS.navy} /></TouchableOpacity>
                          <TouchableOpacity style={styles.iconActionBtn} disabled={idx === activeSubjects.length - 1} onPress={() => handleMoveSubjectOrder(subj, 'moveDown')}><Ionicons name="arrow-down" size={15} color={idx === activeSubjects.length - 1 ? COLORS.silver : COLORS.navy} /></TouchableOpacity>
                          <TouchableOpacity style={styles.iconActionBtn} onPress={() => setSubjectForm({ id: subj.id, name: subj.name })}><Ionicons name="pencil" size={15} color={COLORS.navy} /></TouchableOpacity>
                          <TouchableOpacity style={styles.iconActionBtn} onPress={() => handleSoftDelete('subjects', subj, `Subject: ${subj.name}`)}><Ionicons name="trash-outline" size={15} color={COLORS.danger} /></TouchableOpacity>
                        </View>
                      </Surface>
                    </Pressable>
                  ))}
                </ScrollView>
                <PaperButton mode="outlined" textColor={COLORS.navy} style={{ alignSelf: 'flex-end', borderColor: COLORS.silver }} onPress={() => { setSubjectForm({ id: null, name: '' }); setSubjectsModal(false); }}>Done</PaperButton>
              </Surface>
            </KeyboardAvoidingView>
          </Modal>

          {/* REGISTER / EDIT STUDENT MODAL */}
          <Modal visible={studentModal} transparent animationType="slide" onRequestClose={() => setStudentModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
              <Surface style={styles.modalCard} elevation={5}>
                <Text style={styles.sectionTitle}>{studentForm.id ? 'EDIT STUDENT DETAILS' : 'REGISTER NEW STUDENT'}</Text>
                <ScrollView style={{ maxHeight: 380 }}>
                  <Text style={styles.inputLabel}>Full Name *</Text>
                  <PaperInput mode="outlined" value={studentForm.name} onChangeText={(t) => setStudentForm({ ...studentForm, name: t })} placeholder="Student Full Name" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                  <Text style={styles.inputLabel}>Select Subject / Instrument *</Text>
                  <View style={styles.chipRow}>
                    {activeSubjects.map((s) => (
                      <TouchableOpacity key={s.id} style={[styles.choiceChip, studentForm.subjectId === s.id && styles.choiceChipSelected]} onPress={() => setStudentForm({ ...studentForm, subjectId: s.id })}>
                        <Text style={[styles.choiceChipText, studentForm.subjectId === s.id && styles.choiceChipTextSelected]}>{s.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.inputLabel}>Phone / WhatsApp</Text>
                  <PaperInput mode="outlined" value={studentForm.phone} onChangeText={(t) => setStudentForm({ ...studentForm, phone: t })} keyboardType="phone-pad" placeholder="+91 98765 43210" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                  <Text style={styles.inputLabel}>Parent / Guardian Name</Text>
                  <PaperInput mode="outlined" value={studentForm.guardian} onChangeText={(t) => setStudentForm({ ...studentForm, guardian: t })} placeholder="Optional" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                  <Text style={styles.inputLabel}>Enrollment Date (YYYY-MM-DD)</Text>
                  <QuickDateRow currentDate={studentForm.joinedDate} onSelectDate={(d) => setStudentForm({ ...studentForm, joinedDate: d })} />
                  <PaperInput mode="outlined" value={studentForm.joinedDate} onChangeText={(t) => setStudentForm({ ...studentForm, joinedDate: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                </ScrollView>
                <View style={styles.modalBtnRow}>
                  <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => setStudentModal(false)}>Cancel</PaperButton>
                  <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveStudent}>Save Student</PaperButton>
                </View>
              </Surface>
            </KeyboardAvoidingView>
          </Modal>

          {/* EDIT LESSON MODAL */}
          <Modal visible={lessonEditModal} transparent animationType="slide" onRequestClose={() => setLessonEditModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
              <Surface style={styles.modalCard} elevation={5}>
                <Text style={styles.sectionTitle}>EDIT LESSON RECORD</Text>
                <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                <QuickDateRow currentDate={lessonEditForm.date} onSelectDate={(d) => setLessonEditForm({ ...lessonEditForm, date: d })} />
                <PaperInput mode="outlined" value={lessonEditForm.date} onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, date: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <Text style={styles.inputLabel}>Technique</Text>
                <PaperInput mode="outlined" value={lessonEditForm.technique} onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, technique: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <Text style={styles.inputLabel}>Repertoire</Text>
                <PaperInput mode="outlined" value={lessonEditForm.repertoire} onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, repertoire: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <Text style={styles.inputLabel}>Assignment</Text>
                <PaperInput mode="outlined" value={lessonEditForm.assignment} onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, assignment: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <View style={styles.modalBtnRow}>
                  <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => setLessonEditModal(false)}>Cancel</PaperButton>
                  <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveEditedLesson}>Update</PaperButton>
                </View>
              </Surface>
            </KeyboardAvoidingView>
          </Modal>

          {/* MARK / EDIT ATTENDANCE MODAL */}
          <Modal visible={attendanceModal} transparent animationType="slide" onRequestClose={() => setAttendanceModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
              <Surface style={styles.modalCard} elevation={5}>
                <Text style={styles.sectionTitle}>{attendanceModalForm.id ? 'EDIT ATTENDANCE' : 'MARK GLOBAL ATTENDANCE'}</Text>
                <ScrollView style={{ maxHeight: 360 }}>
                  <Text style={styles.inputLabel}>Select Student *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {activeStudents.map((st) => (
                        <TouchableOpacity key={st.id} style={[styles.choiceChip, attendanceModalForm.studentId === st.id && styles.choiceChipSelected]} onPress={() => setAttendanceModalForm({ ...attendanceModalForm, studentId: st.id })}>
                          <Text style={[styles.choiceChipText, attendanceModalForm.studentId === st.id && styles.choiceChipTextSelected]}>{st.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                  <QuickDateRow currentDate={attendanceModalForm.date} onSelectDate={(d) => setAttendanceModalForm({ ...attendanceModalForm, date: d })} />
                  <PaperInput mode="outlined" value={attendanceModalForm.date} onChangeText={(t) => setAttendanceModalForm({ ...attendanceModalForm, date: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                  <Text style={styles.inputLabel}>Attendance Status</Text>
                  <View style={styles.chipRow}>
                    {ATTENDANCE_STATUSES.map((st) => (
                      <TouchableOpacity key={st} style={[styles.choiceChip, attendanceModalForm.status === st && styles.choiceChipSelected]} onPress={() => setAttendanceModalForm({ ...attendanceModalForm, status: st })}>
                        <Text style={[styles.choiceChipText, attendanceModalForm.status === st && styles.choiceChipTextSelected]}>{st}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.inputLabel}>Remarks</Text>
                  <PaperInput mode="outlined" value={attendanceModalForm.remarks} onChangeText={(t) => setAttendanceModalForm({ ...attendanceModalForm, remarks: t })} placeholder="Optional remarks" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                </ScrollView>
                <View style={styles.modalBtnRow}>
                  <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => setAttendanceModal(false)}>Cancel</PaperButton>
                  <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveModalAttendance}>Save</PaperButton>
                </View>
              </Surface>
            </KeyboardAvoidingView>
          </Modal>

          {/* RECORD / EDIT FEE MODAL */}
          <Modal visible={feeModal} transparent animationType="slide" onRequestClose={() => setFeeModal(false)}>
            <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
              <Surface style={styles.modalCard} elevation={5}>
                <Text style={styles.sectionTitle}>{feeForm.id ? 'EDIT FEE TRANSACTION' : 'RECORD FEE'}</Text>
                <ScrollView style={{ maxHeight: 420 }}>
                  <Text style={styles.inputLabel}>Select Student *</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }}>
                    <View style={{ flexDirection: 'row', gap: 6 }}>
                      {activeStudents.map((st) => (
                        <TouchableOpacity key={st.id} style={[styles.choiceChip, feeForm.studentId === st.id && styles.choiceChipSelected]} onPress={() => setFeeForm({ ...feeForm, studentId: st.id })}>
                          <Text style={[styles.choiceChipText, feeForm.studentId === st.id && styles.choiceChipTextSelected]}>{st.name}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </ScrollView>
                  <Text style={styles.inputLabel}>Fee Type</Text>
                  <View style={styles.chipRow}>
                    {FEE_TYPES.map((ft) => (
                      <TouchableOpacity key={ft} style={[styles.choiceChip, feeForm.feeType === ft && styles.choiceChipSelected]} onPress={() => setFeeForm({ ...feeForm, feeType: ft })}>
                        <Text style={[styles.choiceChipText, feeForm.feeType === ft && styles.choiceChipTextSelected]}>{ft}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {feeForm.feeType === 'Monthly Fee' && (
                    <><Text style={styles.inputLabel}>Month Paid For * (Required for Monthly Fee)</Text>
                    <PaperInput mode="outlined" value={feeForm.monthPaidFor} onChangeText={(t) => setFeeForm({ ...feeForm, monthPaidFor: t })} placeholder="e.g., October 2026" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} /></>
                  )}
                  <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                  <QuickDateRow currentDate={feeForm.date} onSelectDate={(d) => setFeeForm({ ...feeForm, date: d })} />
                  <PaperInput mode="outlined" value={feeForm.date} onChangeText={(t) => setFeeForm({ ...feeForm, date: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                  <Text style={styles.inputLabel}>Payment Mode</Text>
                  <View style={styles.chipRow}>
                    {PAYMENT_MODES.map((m) => (
                      <TouchableOpacity key={m} style={[styles.choiceChip, feeForm.mode === m && styles.choiceChipSelected]} onPress={() => setFeeForm({ ...feeForm, mode: m })}>
                        <Text style={[styles.choiceChipText, feeForm.mode === m && styles.choiceChipTextSelected]}>{m}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.inputLabel}>Fee Status</Text>
                  <View style={styles.chipRow}>
                    {FEE_STATUSES.map((st) => (
                      <TouchableOpacity key={st} style={[styles.choiceChip, feeForm.status === st && styles.choiceChipSelected]} onPress={() => {
                        if (st === 'Unpaid') setFeeForm({ ...feeForm, status: st, amountPaid: '0' });
                        else if (st === 'Paid') setFeeForm({ ...feeForm, status: st, balanceDue: '0' });
                        else setFeeForm({ ...feeForm, status: st });
                      }}>
                        <Text style={[styles.choiceChipText, feeForm.status === st && styles.choiceChipTextSelected]}>{st}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  <Text style={styles.inputLabel}>Amount Paid (₹) {feeForm.status === 'Unpaid' ? '(Auto-locked to 0)' : '*'}</Text>
                  <PaperInput mode="outlined" editable={feeForm.status !== 'Unpaid'} keyboardType="numeric" value={feeForm.status === 'Unpaid' ? '0' : feeForm.amountPaid} onChangeText={(t) => setFeeForm({ ...feeForm, amountPaid: sanitizeCurrency(t) })} placeholder="0" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: feeForm.status === 'Unpaid' ? '#E5E5E5' : COLORS.white, marginBottom: 8 }} />
                  <Text style={styles.inputLabel}>Balance Due (₹) {feeForm.status === 'Paid' ? '(Auto-locked to 0)' : '*'}</Text>
                  <PaperInput mode="outlined" editable={feeForm.status !== 'Paid'} keyboardType="numeric" value={feeForm.status === 'Paid' ? '0' : feeForm.balanceDue} onChangeText={(t) => setFeeForm({ ...feeForm, balanceDue: sanitizeCurrency(t) })} placeholder="0" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: feeForm.status === 'Paid' ? '#E5E5E5' : COLORS.white, marginBottom: 8 }} />
                  <Text style={styles.inputLabel}>Remarks</Text>
                  <PaperInput mode="outlined" value={feeForm.remarks} onChangeText={(t) => setFeeForm({ ...feeForm, remarks: t })} placeholder="Optional receipt notes" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                </ScrollView>
                <View style={[styles.modalBtnRow, { flexWrap: 'wrap', gap: 8 }]}>
                  <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => setFeeModal(false)}>Cancel</PaperButton>
                  <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => handleSaveFee(false)}>Save</PaperButton>
                  <PaperButton mode="contained" buttonColor={COLORS.gold} textColor={COLORS.navy} onPress={() => handleSaveFee(true)}>Save & Share</PaperButton>
                </View>
              </Surface>
            </KeyboardAvoidingView>
          </Modal>

        </SafeAreaView>
      </PaperProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.ivory },
  scrollContent: { padding: 16, paddingBottom: 36 },
  heroCard: { backgroundColor: COLORS.navy, borderRadius: 16, padding: 20, borderWidth: 1.5, borderColor: COLORS.gold, marginBottom: 16 },
  crestBadge: { alignSelf: 'flex-start', backgroundColor: COLORS.goldLight, borderColor: COLORS.gold, borderWidth: 1, borderRadius: 6, paddingHorizontal: 10, paddingVertical: 3, marginBottom: 10 },
  crestBadgeText: { color: COLORS.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  heroGreeting: { color: COLORS.white, fontSize: 22, fontWeight: '700' },
  heroDate: { color: COLORS.cream, fontSize: 13, marginTop: 4 },
  heroDivider: { height: 1, backgroundColor: COLORS.gold, opacity: 0.35, marginVertical: 14 },
  heroStatRow: { flexDirection: 'row', justifyContent: 'space-between' },
  heroStatLabel: { color: COLORS.silver, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  heroStatValue: { color: COLORS.gold, fontSize: 18, fontWeight: '700', marginTop: 2 },
  contactActionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(212, 185, 120, 0.16)', borderWidth: 1, borderColor: COLORS.gold, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  contactActionText: { color: COLORS.gold, fontSize: 12, fontWeight: '700' },
  creamCard: { backgroundColor: COLORS.cream, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.gold },
  whiteCard: { backgroundColor: COLORS.white, borderRadius: 14, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: COLORS.border },
  cardHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { color: COLORS.navy, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  silverMeta: { color: COLORS.silver, fontSize: 12 },
  noticePreviewText: { color: COLORS.charcoal, fontSize: 14, lineHeight: 20, marginVertical: 6 },
  noticeFullText: { color: COLORS.charcoal, fontSize: 15, lineHeight: 22 },
  noticeActionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 10 },
  bentoRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  bentoCard: { flex: 1, borderRadius: 14, padding: 18, justifyContent: 'space-between', minHeight: 115 },
  bentoTitleGold: { color: COLORS.gold, fontSize: 16, fontWeight: '700', marginTop: 10 },
  bentoSubCream: { color: COLORS.cream, fontSize: 12, marginTop: 2 },
  bentoTitleNavy: { color: COLORS.navy, fontSize: 16, fontWeight: '700', marginTop: 10 },
  bentoSubSilver: { color: COLORS.silver, fontSize: 12, marginTop: 2 },
  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0ECE1', gap: 10 },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  activityTitle: { color: COLORS.navy, fontSize: 14, fontWeight: '600' },
  activitySub: { color: COLORS.silver, fontSize: 12 },
  tabTopBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, gap: 10 },
  pageHeading: { color: COLORS.navy, fontSize: 20, fontWeight: '800' },
  ledgerSummaryRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  ledgerSummaryBox: { flex: 1, borderRadius: 12, padding: 14 },
  ledgerSummaryLabel: { color: COLORS.cream, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  ledgerSummaryValGold: { color: COLORS.gold, fontSize: 18, fontWeight: '800', marginTop: 4 },
  groupBlock: { marginBottom: 18 },
  groupHeaderBar: { backgroundColor: COLORS.navy, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderLeftWidth: 4, borderLeftColor: COLORS.gold },
  groupHeaderTitle: { color: COLORS.gold, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  groupHeaderCount: { color: COLORS.cream, fontSize: 12, fontWeight: '700' },
  monthSubHeader: { color: COLORS.navy, fontSize: 13, fontWeight: '700', marginVertical: 6, paddingLeft: 4 },
  cleanRecordCard: { backgroundColor: COLORS.white, borderRadius: 12, padding: 14, marginTop: 8, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 10 },
  cardPressed: { opacity: 0.7 },
  recordPrimaryTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '700' },
  recordSecondarySub: { color: COLORS.silver, fontSize: 12, marginTop: 3 },
  recordDetailLine: { color: COLORS.charcoal, fontSize: 13, marginTop: 4 },
  boldLabel: { fontWeight: '700', color: COLORS.navy },
  priorityBadge: { backgroundColor: COLORS.navy, borderColor: COLORS.gold, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  priorityBadgeText: { color: COLORS.gold, fontSize: 10, fontWeight: '800' },
  feeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  feeBadgePaid: { backgroundColor: COLORS.successBg },
  feeBadgeDue: { backgroundColor: COLORS.dangerBg },
  feeBadgeNeutral: { backgroundColor: COLORS.cream },
  feeBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.navy },
  statusPill: { backgroundColor: COLORS.cream, borderColor: COLORS.gold, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusPillText: { color: COLORS.navy, fontSize: 11, fontWeight: '700' },
  backButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backButtonText: { color: COLORS.navy, fontSize: 14, fontWeight: '700' },
  secondaryButtonSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.cream, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: COLORS.gold },
  secondaryButtonSmallText: { color: COLORS.navy, fontSize: 12, fontWeight: '700' },
  profileStatsGrid: { flexDirection: 'row', gap: 8, marginTop: 16 },
  profileStatBox: { flex: 1, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 10, borderWidth: 1, borderColor: 'rgba(212, 185, 120, 0.4)', alignItems: 'center' },
  profileStatLabel: { color: COLORS.cream, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  profileStatVal: { color: COLORS.gold, fontSize: 16, fontWeight: '800', marginTop: 4 },
  pillNavContainer: { flexDirection: 'row', backgroundColor: COLORS.cream, borderRadius: 12, padding: 4, marginBottom: 16 },
  pillNavItem: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 9 },
  pillNavItemActive: { backgroundColor: COLORS.navy },
  pillNavText: { color: COLORS.navy, fontSize: 12, fontWeight: '700' },
  pillNavTextActive: { color: COLORS.gold },
  inputLabel: { color: COLORS.navy, fontSize: 12, fontWeight: '700', marginTop: 8, marginBottom: 4 },
  quickDateRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  quickDateChip: { backgroundColor: COLORS.cream, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, borderWidth: 1, borderColor: '#D8D2C5' },
  quickDateChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.gold },
  quickDateChipText: { fontSize: 11, fontWeight: '600', color: COLORS.navy },
  quickDateChipTextActive: { color: COLORS.gold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 6 },
  choiceChip: { backgroundColor: COLORS.cream, paddingHorizontal: 12, paddingVertical: 7, borderRadius: 8, borderWidth: 1, borderColor: '#D8D2C5' },
  choiceChipSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.gold },
  choiceChipText: { color: COLORS.navy, fontSize: 12, fontWeight: '600' },
  choiceChipTextSelected: { color: COLORS.gold, fontWeight: '700' },
  prioritySwitchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 8 },
  pdfShareBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.navy, borderColor: COLORS.gold, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  pdfShareBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.navy, borderColor: COLORS.gold, borderWidth: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  pdfShareBtnText: { color: COLORS.gold, fontSize: 11, fontWeight: '700' },
  iconActionBtn: { padding: 6, borderRadius: 6, backgroundColor: COLORS.ivory, borderWidth: 1, borderColor: COLORS.border },
  daysRemainingBadge: { backgroundColor: COLORS.cream, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, borderColor: COLORS.gold },
  daysRemainingText: { color: COLORS.navy, fontSize: 11, fontWeight: '700' },
  emptyText: { color: COLORS.silver, fontSize: 13, textAlign: 'center', paddingVertical: 16 },
  emptyGroupText: { color: COLORS.silver, fontSize: 12, fontStyle: 'italic', paddingLeft: 8, paddingTop: 6 },
  bottomTabBar: { flexDirection: 'row', backgroundColor: COLORS.navy, borderTopWidth: 2, borderTopColor: COLORS.gold, paddingVertical: 8 },
  bottomTabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomTabLabel: { color: COLORS.silver, fontSize: 10, marginTop: 3, fontWeight: '600' },
  bottomTabLabelActive: { color: COLORS.gold, fontWeight: '800' },
  trashTabBadge: { position: 'absolute', right: -10, top: -4, backgroundColor: COLORS.gold, borderRadius: 9, minWidth: 18, height: 18, paddingHorizontal: 4, alignItems: 'center', justifyContent: 'center' },
  trashTabBadgeText: { color: COLORS.navy, fontSize: 10, fontWeight: '800' },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(12, 45, 87, 0.55)' },
  drawerContainer: { width: 280, backgroundColor: COLORS.ivory, height: '100%', borderRightWidth: 2, borderRightColor: COLORS.gold },
  drawerHeader: { backgroundColor: COLORS.navy, padding: 22, borderBottomWidth: 2, borderBottomColor: COLORS.gold },
  drawerTitle: { color: COLORS.white, fontSize: 18, fontWeight: '800', marginTop: 6 },
  drawerSub: { color: COLORS.cream, fontSize: 12, marginTop: 2 },
  drawerNavItem: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 12, borderRadius: 8, backgroundColor: COLORS.cream },
  drawerNavItemActive: { backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.gold },
  drawerNavText: { color: COLORS.navy, fontSize: 14, fontWeight: '700' },
  drawerNavTextActive: { color: COLORS.gold },
  drawerDivider: { height: 1, backgroundColor: '#D8D2C5', marginVertical: 8 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(12, 45, 87, 0.6)', justifyContent: 'center', padding: 18 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 2, borderColor: COLORS.gold },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  contextSheet: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 2, borderColor: COLORS.gold, alignItems: 'center', width: '100%' },
  contextSheetHeader: { color: COLORS.navy, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  contextDivider: { height: 1, backgroundColor: COLORS.cream, width: '100%', marginVertical: 12 },
  contextOptionBtn: { width: '100%', paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F2EFE9' },
  contextOptionText: { color: COLORS.navy, fontSize: 15, fontWeight: '700' },
});
