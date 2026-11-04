import React, { Component, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, ScrollView, TouchableOpacity, Pressable, Modal, Alert, Animated, Easing, LayoutAnimation, Platform, UIManager, StatusBar, Switch, ActivityIndicator, KeyboardAvoidingView, Linking, Keyboard, Vibration, BackHandler } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, setDoc, onSnapshot, writeBatch } from 'firebase/firestore';
import { Provider as PaperProvider, Appbar, TextInput as PaperInput, Button as PaperButton, Surface, MD3LightTheme } from 'react-native-paper';
import { PanGestureHandler, GestureHandlerRootView, State } from 'react-native-gesture-handler';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const triggerLayoutAnimation = () => {
  try { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); } catch (e) {}
};
const triggerHaptic = (ms = 12) => {
  try { Vibration.vibrate(ms); } catch (e) {}
};

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
const WEEKDAYS_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
const ATTENDANCE_STATUSES = ['Present', 'Absent', 'Tardy', 'Rescheduled'];
const FEE_TYPES = ['Monthly Fee', 'Admission Fee', 'Exam Fee', 'Instrument / Book'];
const PAYMENT_MODES = ['UPI', 'Cash', 'Bank Transfer', 'Card'];
const FEE_STATUSES = ['Paid', 'Partial', 'Unpaid'];

const MAIN_TABS = ['Home', 'Students', 'Attendance', 'Fees', 'Trash'];
const PROFILE_TABS = ['Classes', 'Attendance', 'Notes', 'Fees'];
const SUBJECT_ROW_HEIGHT = 60;

// ==========================================
// 3. UTILITIES, SANITIZERS & BATCH HELPERS
// ==========================================
const safeString = (val, fallback = '') => (val === null || val === undefined ? fallback : String(val));
const safeNumber = (val, fallback = 0) => {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

const sanitizeDocRecord = (id, raw = {}) => {
  const data = raw && typeof raw === 'object' ? raw : {};
  return {
    ...data,
    id: safeString(id),
    name: safeString(data.name),
    title: safeString(data.title),
    subtitle: safeString(data.subtitle),
    subjectId: safeString(data.subjectId),
    studentId: safeString(data.studentId),
    phone: safeString(data.phone),
    guardian: safeString(data.guardian),
    joinedDate: safeString(data.joinedDate),
    date: safeString(data.date),
    dateISO: safeString(data.dateISO),
    technique: safeString(data.technique),
    repertoire: safeString(data.repertoire),
    assignment: safeString(data.assignment),
    status: safeString(data.status, 'Present'),
    remarks: safeString(data.remarks),
    notes: safeString(data.notes),
    feeType: safeString(data.feeType, 'Monthly Fee'),
    monthPaidFor: safeString(data.monthPaidFor),
    mode: safeString(data.mode, 'UPI'),
    amountPaid: safeNumber(data.amountPaid, 0),
    balanceDue: safeNumber(data.balanceDue, 0),
    order: safeNumber(data.order, 999),
    timestamp: safeNumber(data.timestamp, 0),
    deletedAt: data.deletedAt ? safeNumber(data.deletedAt, Date.now()) : null,
    isDeleted: Boolean(data.isDeleted),
    priorityNote: Boolean(data.priorityNote),
  };
};

// Prevents Firestore writes from hanging indefinitely when device is offline
const withWriteTimeout = (promise, ms = 3500) => {
  let timerId;
  const timeoutPromise = new Promise((resolve) => {
    timerId = setTimeout(() => resolve({ timedOutOffline: true }), ms);
  });
  return Promise.race([
    promise.then((res) => { clearTimeout(timerId); return res; }).catch((err) => { clearTimeout(timerId); throw err; }),
    timeoutPromise,
  ]);
};

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
  const safeStr = safeString(isoDateStr).trim();
  if (!safeStr) return 'Unknown Date';
  const normalized = normalizeISODate(safeStr) || safeStr;
  const parts = normalized.split('-');
  if (parts.length !== 3) return safeStr;
  const [year, monthIndex, day] = [parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)];
  return isNaN(year) || isNaN(monthIndex) || isNaN(day) || !MONTHS_SHORT[monthIndex] ? safeStr : `${day} ${MONTHS_SHORT[monthIndex]} ${year}`;
};

const getMonthYearFromISO = (isoDateStr) => {
  const safeStr = safeString(isoDateStr).trim();
  if (!safeStr) return 'Unknown Month';
  const normalized = normalizeISODate(safeStr) || safeStr;
  const parts = normalized.split('-');
  if (parts.length < 2) return 'Unknown Month';
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  return isNaN(year) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11 ? 'Unknown Month' : `${MONTHS_FULL[monthIdx]} ${year}`;
};

const isWithinLastTwoLocalMonths = (isoDateStr) => {
  const safeStr = safeString(isoDateStr).trim();
  const normalized = normalizeISODate(safeStr) || safeStr;
  if (!normalized) return false;
  const parts = normalized.split('-');
  if (parts.length < 2) return false;
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  if (isNaN(year) || isNaN(monthIdx)) return false;
  const now = new Date();
  const diff = (now.getFullYear() * 12 + now.getMonth()) - (year * 12 + monthIdx);
  return diff >= -1 && diff <= 1;
};

const getDaysRemainingInTrash = (deletedAtMs) => {
  if (!deletedAtMs) return 30;
  return Math.max(0, 30 - Math.floor((Date.now() - safeNumber(deletedAtMs, Date.now())) / (1000 * 60 * 60 * 24)));
};

const escapeHtml = (unsafe) => safeString(unsafe).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#039;');
const sanitizeCurrency = (val) => {
  const cleaned = safeString(val).replace(/[^0-9.]/g, '');
  const parts = cleaned.split('.');
  return parts.length <= 1 ? cleaned : `${parts[0]}.${parts.slice(1).join('').slice(0, 2)}`;
};

const commitBatchDeletes = async (entries) => {
  const CHUNK_SIZE = 450;
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    entries.slice(i, i + CHUNK_SIZE).forEach((entry) => batch.delete(doc(db, entry.col, entry.id)));
    await withWriteTimeout(batch.commit());
  }
};

const commitBatchSoftDeletes = async (entries) => {
  const CHUNK_SIZE = 450;
  const now = Date.now();
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    entries.slice(i, i + CHUNK_SIZE).forEach((entry) => batch.update(doc(db, entry.col, entry.id), { isDeleted: true, deletedAt: now }));
    await withWriteTimeout(batch.commit());
  }
};

// ==========================================
// 4. ERROR BOUNDARY & SWIPE SCREEN WRAPPER
// ==========================================
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }
  static getDerivedStateFromError(error) {
    return { hasError: true, errorMessage: safeString(error?.message, 'Unexpected UI error') };
  }
  componentDidCatch() {}
  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={styles.errorBoundaryContainer}>
          <Ionicons name="shield-checkmark-outline" size={44} color={COLORS.gold} />
          <Text style={styles.errorBoundaryTitle}>JSM Safe Recovery</Text>
          <Text style={styles.errorBoundarySub}>{this.state.errorMessage}</Text>
          <TouchableOpacity
            style={styles.errorBoundaryBtn}
            onPress={() => this.setState({ hasError: false, errorMessage: '' })}
          >
            <Text style={styles.errorBoundaryBtnText}>Reload Interface</Text>
          </TouchableOpacity>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

const AnimatedScreen = ({ children, triggerKey, direction, onSwipe, swipeEnabled = true }) => {
  const fadeAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const onSwipeRef = useRef(onSwipe);

  useEffect(() => {
    onSwipeRef.current = onSwipe;
  }, [onSwipe]);

  const onGestureEvent = useMemo(
    () => Animated.event([{ nativeEvent: { translationX: dragX } }], { useNativeDriver: true }),
    [dragX]
  );

  const dragTranslateX = useMemo(
    () =>
      dragX.interpolate({
        inputRange: [-260, 0, 260],
        outputRange: [-42, 0, 42],
        extrapolate: 'clamp',
      }),
    [dragX]
  );

  const dragOpacity = useMemo(
    () =>
      dragX.interpolate({
        inputRange: [-220, 0, 220],
        outputRange: [0.68, 1, 0.68],
        extrapolate: 'clamp',
      }),
    [dragX]
  );

  useEffect(() => {
    dragX.stopAnimation(() => dragX.setValue(0));
    fadeAnim.setValue(0);
    slideAnim.setValue(direction * 36);

    const anim = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 280,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 280,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [triggerKey, direction, fadeAnim, slideAnim, dragX]);

  const handleGestureStateChange = useCallback((e) => {
    const { state } = e.nativeEvent;
    if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      let didNavigate = false;
      if (state === State.END && typeof onSwipeRef.current === 'function') {
        didNavigate = Boolean(onSwipeRef.current(e));
      }
      if (didNavigate) {
        dragX.stopAnimation(() => dragX.setValue(0));
      } else {
        Animated.timing(dragX, {
          toValue: 0,
          duration: 200,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }).start();
      }
    }
  }, [dragX]);

  if (!swipeEnabled) {
    return (
      <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
        {children}
      </Animated.View>
    );
  }

  return (
    <PanGestureHandler
      activeOffsetX={[-20, 20]}
      failOffsetY={[-15, 15]}
      onGestureEvent={onGestureEvent}
      onHandlerStateChange={handleGestureStateChange}
    >
      <Animated.View style={{ flex: 1, opacity: dragOpacity, transform: [{ translateX: dragTranslateX }] }}>
        <Animated.View style={{ flex: 1, opacity: fadeAnim, transform: [{ translateX: slideAnim }] }}>
          {children}
        </Animated.View>
      </Animated.View>
    </PanGestureHandler>
  );
};

const QuickDateRow = ({ currentDate, onSelectDate, onOpenCalendar }) => {
  const today = getTodayISO();
  const yesterday = getYesterdayISO();
  return (
    <View style={styles.quickDateRow}>
      <TouchableOpacity style={[styles.quickDateChip, currentDate === today && styles.quickDateChipActive]} onPress={() => { triggerHaptic(8); onSelectDate(today); }}>
        <Text style={[styles.quickDateChipText, currentDate === today && styles.quickDateChipTextActive]}>Today ({today})</Text>
      </TouchableOpacity>
      <TouchableOpacity style={[styles.quickDateChip, currentDate === yesterday && styles.quickDateChipActive]} onPress={() => { triggerHaptic(8); onSelectDate(yesterday); }}>
        <Text style={[styles.quickDateChipText, currentDate === yesterday && styles.quickDateChipTextActive]}>Yesterday</Text>
      </TouchableOpacity>
      {onOpenCalendar ? (
        <TouchableOpacity style={styles.quickDateChipCalendar} onPress={() => { Keyboard.dismiss(); triggerHaptic(8); onOpenCalendar(currentDate, onSelectDate); }}>
          <Ionicons name="calendar-outline" size={13} color={COLORS.gold} />
          <Text style={styles.quickDateChipCalendarText}>Pick Date</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

// ==========================================
// 5. MAIN APPLICATION COMPONENT
// ==========================================
function JSMAppContent() {
  const [activeTab, setActiveTab] = useState('Home');
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [profileTab, setProfileTab] = useState('Classes');
  const [navDirection, setNavDirection] = useState(1);
  const [subTabDirection, setSubTabDirection] = useState(1);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerSlideAnim = useRef(new Animated.Value(-290)).current;
  const drawerBackdropAnim = useRef(new Animated.Value(0)).current;
  const savingLockRef = useRef(false);
  const isMountedRef = useRef(true);
  const pendingTimeoutsRef = useRef([]);

  const scheduleTimeout = useCallback((fn, delayMs) => {
    const id = setTimeout(() => {
      pendingTimeoutsRef.current = pendingTimeoutsRef.current.filter((t) => t !== id);
      if (isMountedRef.current) fn();
    }, delayMs);
    pendingTimeoutsRef.current.push(id);
    return id;
  }, []);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      pendingTimeoutsRef.current.forEach((id) => clearTimeout(id));
      pendingTimeoutsRef.current = [];
    };
  }, []);

  const openDrawer = useCallback(() => {
    Keyboard.dismiss();
    triggerHaptic(10);
    setDrawerOpen(true);
    drawerSlideAnim.setValue(-290);
    drawerBackdropAnim.setValue(0);
    Animated.parallel([
      Animated.timing(drawerSlideAnim, { toValue: 0, duration: 260, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(drawerBackdropAnim, { toValue: 1, duration: 260, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  }, [drawerSlideAnim, drawerBackdropAnim]);

  const closeDrawer = useCallback((callback) => {
    Animated.parallel([
      Animated.timing(drawerSlideAnim, { toValue: -290, duration: 210, easing: Easing.in(Easing.cubic), useNativeDriver: true }),
      Animated.timing(drawerBackdropAnim, { toValue: 0, duration: 210, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]).start(() => {
      if (!isMountedRef.current) return;
      setDrawerOpen(false);
      if (typeof callback === 'function') callback();
    });
  }, [drawerSlideAnim, drawerBackdropAnim]);

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
  const [contextMenu, setContextMenu] = useState({ visible: false, entityType: null, item: null, title: '', reopenSubjectsModal: false, reopenTodayLogModal: false });
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
  const [calendarPicker, setCalendarPicker] = useState({ visible: false, selectedDate: getTodayISO(), viewYear: new Date().getFullYear(), viewMonth: new Date().getMonth(), onSelect: null });
  const initialLoadDone = useRef(false);

  // Drag-and-drop state and refs for Subject 6-dot handle reordering
  const [orderedSubjects, setOrderedSubjects] = useState([]);
  const [draggingSubjectId, setDraggingSubjectId] = useState(null);
  const [subjectScrollLocked, setSubjectScrollLocked] = useState(false);
  const dragSubjectY = useRef(new Animated.Value(0)).current;
  const dragInfoRef = useRef({ active: false, subjectId: null, startIdx: 0, currentIdx: 0, list: [] });

  // Refs to prevent stale closures in gesture handlers
  const activeTabRef = useRef(activeTab);
  const profileTabRef = useRef(profileTab);
  const orderedSubjectsRef = useRef(orderedSubjects);
  const activeSubjectsRef = useRef([]);

  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);
  useEffect(() => { profileTabRef.current = profileTab; }, [profileTab]);
  useEffect(() => { orderedSubjectsRef.current = orderedSubjects; }, [orderedSubjects]);

  const openCalendarPicker = useCallback((currentDateStr, onSelectCallback) => {
    const norm = normalizeISODate(currentDateStr) || getTodayISO();
    const parts = norm.split('-');
    const y = parseInt(parts[0], 10) || new Date().getFullYear();
    const m = (parseInt(parts[1], 10) || 1) - 1;
    setCalendarPicker({ visible: true, selectedDate: norm, viewYear: y, viewMonth: m, onSelect: onSelectCallback });
  }, []);

  // Android Hardware Back Button Handler
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (calendarPicker.visible) {
        setCalendarPicker((prev) => ({ ...prev, visible: false }));
        return true;
      }
      if (drawerOpen) {
        closeDrawer();
        return true;
      }
      if (activeTab === 'Students' && selectedStudentId) {
        setNavDirection(-1);
        setSelectedStudentId(null);
        return true;
      }
      if (activeTab !== 'Home') {
        setNavDirection(-1);
        setActiveTab('Home');
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [activeTab, selectedStudentId, calendarPicker.visible, drawerOpen, closeDrawer]);

  useEffect(() => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const timer = setTimeout(() => { initialLoadDone.current = true; }, 1200);
    const handleSnapshotWithAutoPurge = (colName, snapshot, setter) => {
      if (!isMountedRef.current) return;
      const records = [];
      snapshot.forEach((docSnap) => {
        const clean = sanitizeDocRecord(docSnap.id, docSnap.data());
        if (clean.isDeleted && clean.deletedAt && Date.now() - clean.deletedAt > THIRTY_DAYS_MS) {
          deleteDoc(doc(db, colName, clean.id)).catch(() => {});
        } else {
          records.push(clean);
        }
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
      if (!isMountedRef.current) return;
      const list = [];
      
      snap.forEach((d) => {
        const clean = sanitizeDocRecord(d.id, d.data());
        if (clean.isDeleted && clean.deletedAt && Date.now() - clean.deletedAt > THIRTY_DAYS_MS) {
          deleteDoc(doc(db, 'activities', clean.id)).catch(() => {});
        } else if (!clean.isDeleted && clean.timestamp && Date.now() - clean.timestamp > THIRTY_DAYS_MS) {
          deleteDoc(doc(db, 'activities', clean.id)).catch(() => {});
        } else {
          list.push(clean);
        }
      });
      list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
      if (initialLoadDone.current) triggerLayoutAnimation();
      setActivities(list);
    }, () => {});
    const unsubNotice = onSnapshot(doc(db, 'settings', 'noticeBoard'), (docSnap) => {
      if (!isMountedRef.current) return;
      if (docSnap.exists()) {
        const d = docSnap.data() || {};
        setNoticeText(safeString(d.text));
        setNoticeUpdatedAt(safeString(d.updatedDate));
      }
    }, () => {});

    return () => {
      clearTimeout(timer);
      unsubSubjects();
      unsubStudents();
      unsubLessons();
      unsubAttendance();
      unsubFees();
      unsubActivities();
      unsubNotice();
    };
  }, []);

  const logActivity = async (actionTitle, subtitle) => {
    try {
      await withWriteTimeout(
        addDoc(collection(db, 'activities'), {
          title: safeString(actionTitle),
          subtitle: safeString(subtitle),
          dateISO: getTodayISO(),
          timestamp: Date.now(),
          isDeleted: false,
          deletedAt: null,
        })
      );
    } catch (e) {}
  };

  const activeSubjects = useMemo(() => subjects.filter((s) => !s.isDeleted).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)), [subjects]);
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const activeStudents = useMemo(() => students.filter((st) => !st.isDeleted).sort((a, b) => safeString(a.name).localeCompare(safeString(b.name))), [students]);
  const studentMap = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const activeLessons = useMemo(() => lessons.filter((l) => !l.isDeleted && studentMap[l.studentId] && !studentMap[l.studentId].isDeleted).sort((a, b) => safeString(b.date).localeCompare(safeString(a.date))), [lessons, studentMap]);
  const activeAttendance = useMemo(() => attendance.filter((a) => !a.isDeleted && studentMap[a.studentId] && !studentMap[a.studentId].isDeleted).sort((a, b) => safeString(b.date).localeCompare(safeString(a.date))), [attendance, studentMap]);
  const activeFees = useMemo(() => fees.filter((f) => !f.isDeleted && studentMap[f.studentId] && !studentMap[f.studentId].isDeleted).sort((a, b) => safeString(b.date).localeCompare(safeString(a.date))), [fees, studentMap]);
  const activeActivities = useMemo(() => activities.filter((a) => !a.isDeleted), [activities]);

  useEffect(() => {
    activeSubjectsRef.current = activeSubjects;
    if (!dragInfoRef.current.active) {
      setOrderedSubjects(activeSubjects);
    }
  }, [activeSubjects]);

  const globalFeeTotals = useMemo(() => {
    let collected = 0, pending = 0;
    activeFees.forEach((f) => { collected += safeNumber(f.amountPaid, 0); pending += safeNumber(f.balanceDue, 0); });
    return { collected, pending };
  }, [activeFees]);

  const trashItems = useMemo(() => [
    ...subjects.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'subjects', _label: `Subject: ${safeString(x.name, 'Unnamed')}` })),
    ...students.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'students', _label: `Student: ${safeString(x.name, 'Unnamed')}` })),
    ...lessons.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'lessons', _label: `Lesson: ${safeString(studentMap[x.studentId]?.name, 'Student')} (${formatReadableLocalDate(x.date)})` })),
    ...attendance.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'attendance', _label: `Attendance: ${safeString(studentMap[x.studentId]?.name, 'Student')} - ${safeString(x.status)} (${formatReadableLocalDate(x.date)})` })),
    ...fees.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'fees', _label: `Fee: ${safeString(studentMap[x.studentId]?.name, 'Student')} - ₹${safeNumber(x.amountPaid, 0)} (${formatReadableLocalDate(x.date)})` })),
    ...activities.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'activities', _label: `Activity: ${safeString(x.title)}${x.subtitle ? ` (${x.subtitle})` : ''}` })),
  ].sort((a, b) => safeNumber(b.deletedAt, 0) - safeNumber(a.deletedAt, 0)), [subjects, students, lessons, attendance, fees, activities, studentMap]);

  const selectedStudent = useMemo(() => activeStudents.find((s) => s.id === selectedStudentId) || null, [activeStudents, selectedStudentId]);

  useEffect(() => {
    if (selectedStudent) {
      setNoteDraft(safeString(selectedStudent.notes));
      setPriorityDraft(Boolean(selectedStudent.priorityNote));
    }
  }, [selectedStudentId, selectedStudent?.notes, selectedStudent?.priorityNote]);

  useEffect(() => {
    setInlineLessonForm({ date: getTodayISO(), technique: '', repertoire: '', assignment: '' });
    setInlineAttendanceForm({ date: getTodayISO(), status: 'Present', remarks: '' });
  }, [selectedStudentId]);

  const getStudentMetrics = useCallback((studentId) => {
    const stLessons = activeLessons.filter((l) => l.studentId === studentId);
    const stAttendance = activeAttendance.filter((a) => a.studentId === studentId);
    const stFees = activeFees.filter((f) => f.studentId === studentId);
    let attendancePct = 'N/A';
    const gradedAttendance = stAttendance.filter((a) => a.status !== 'Rescheduled');
    if (gradedAttendance.length > 0) {
      attendancePct = `${Math.round((gradedAttendance.filter((a) => a.status === 'Present' || a.status === 'Tardy').length / gradedAttendance.length) * 100)}%`;
    }
    let feeStatus = 'No Records', totalDue = 0;
    if (stFees.length > 0) {
      stFees.forEach((f) => { totalDue += safeNumber(f.balanceDue, 0); });
      feeStatus = stFees.some((f) => f.status === 'Unpaid' || f.status === 'Partial' || safeNumber(f.balanceDue, 0) > 0) ? 'Due / Unpaid' : 'Paid';
    }
    return { classesTaken: stLessons.length, attendancePct, feeStatus, totalDue, stLessons, stAttendance, stFees };
  }, [activeLessons, activeAttendance, activeFees]);

  const handleCheckOTA = async () => {
    try {
      setCheckingOTA(true);
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert('Update Ready', 'Restarting JSM with the latest version.', [{ text: 'Restart Now', onPress: () => Updates.reloadAsync() }]);
      } else { Alert.alert('Up to Date', 'You are running the latest JSM build.'); }
    } catch (e) { Alert.alert('OTA Notice', 'OTA check requires a production/preview Expo Updates build.'); } finally {
      if (isMountedRef.current) setCheckingOTA(false);
    }
  };

  const handlePhoneCall = (phoneStr) => {
    const cleaned = safeString(phoneStr).replace(/[^\d+]/g, '');
    if (!cleaned) return;
    Linking.openURL(`tel:${cleaned}`).catch(() => Alert.alert('Action Unavailable', 'Could not open phone dialer.'));
  };

  const handleOpenWhatsApp = (phoneStr, studentName) => {
    const digits = safeString(phoneStr).replace(/[^\d]/g, '');
    if (!digits) return;
    Linking.openURL(`https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(`Hello from JSM regarding ${safeString(studentName, 'your music classes')}.`)}`).catch(() => Alert.alert('WhatsApp Unavailable', 'Could not open WhatsApp.'));
  };

  const generateAndShareReceiptPDF = async (feeRecord) => {
    if (!feeRecord) return;
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
        <div class="crest">★ EST. 2022 ★</div><div class="title">JSM</div><div class="subtitle">OFFICIAL TUITION &amp; FEE RECEIPT</div><div class="divider"></div>
        <div class="row"><span class="label">Student Name:</span><span class="val">${escapeHtml(st?.name || 'JSM Student')}</span></div>
        <div class="row"><span class="label">Instrument / Subject:</span><span class="val">${escapeHtml(subjectMap[st?.subjectId]?.name || 'Music Studies')}</span></div>
        <div class="row"><span class="label">Date of Transaction:</span><span class="val">${escapeHtml(formatReadableLocalDate(feeRecord.date))}</span></div>
        <div class="row"><span class="label">Fee Category:</span><span class="val">${escapeHtml(feeRecord.feeType || 'Tuition Fee')}</span></div>
        ${feeRecord.feeType === 'Monthly Fee' ? `<div class="row"><span class="label">Month Paid For:</span><span class="val">${escapeHtml(feeRecord.monthPaidFor || '-')}</span></div>` : ''}
        <div class="row"><span class="label">Payment Mode:</span><span class="val">${escapeHtml(feeRecord.mode || 'UPI')}</span></div>
        <div class="row"><span class="label">Payment Status:</span><span class="val">${escapeHtml(feeRecord.status || 'Paid')}</span></div>
        <div class="total-box">
          <div class="row"><span class="label">Amount Paid:</span><span class="val">₹${safeNumber(feeRecord.amountPaid, 0).toFixed(2)}</span></div>
          <div class="row"><span class="label">Balance Due:</span><span class="val">₹${safeNumber(feeRecord.balanceDue, 0).toFixed(2)}</span></div>
        </div>
        ${feeRecord.remarks ? `<div class="row" style="margin-top:16px;"><span class="label">Remarks:</span><span class="val">${escapeHtml(feeRecord.remarks)}</span></div>` : ''}
        <div class="footer">Generated by JSM Administration • Est. 2022</div>
      </div></body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: `Share Receipt - ${safeString(st?.name, 'Student')}`, UTI: 'com.adobe.pdf' });
      } else { Alert.alert('PDF Created', `Saved to: ${uri}`); }
    } catch (err) { Alert.alert('Receipt Error', 'Could not generate or share the PDF receipt.'); }
  };

  const openLongPressMenu = (entityType, item, title, reopenSubjectsModal = false, reopenTodayLogModal = false) => {
    Keyboard.dismiss();
    triggerHaptic(18);
    setContextMenu({ visible: true, entityType, item, title: safeString(title), reopenSubjectsModal, reopenTodayLogModal });
  };
  const closeContextMenu = () => setContextMenu({ visible: false, entityType: null, item: null, title: '', reopenSubjectsModal: false, reopenTodayLogModal: false });

  const handleSoftDelete = async (collectionName, item, label) => {
    if (!item?.id) return;
    try {
      triggerLayoutAnimation();
      triggerHaptic(15);
      if (collectionName === 'students' && selectedStudentId === item.id) setSelectedStudentId(null);
      if (collectionName === 'subjects' && subjectForm.id === item.id) setSubjectForm({ id: null, name: '' });
      await withWriteTimeout(updateDoc(doc(db, collectionName, item.id), { isDeleted: true, deletedAt: Date.now() }));
      if (collectionName !== 'activities') {
        await logActivity('Moved to Trash', label);
      }
    } catch (e) { Alert.alert('Error', 'Unable to move item to Trash.'); }
  };

  const handleClearAllActivities = (onlyToday = false) => {
    const targets = onlyToday ? activeActivities.filter((a) => a.dateISO === getTodayISO()) : activeActivities;
    if (targets.length === 0) return;
    triggerHaptic(15);
    Alert.alert(
      onlyToday ? "Clear Today's Activity Log?" : 'Clear All Recent Activities?',
      `Choose how to remove ${targets.length} activity record(s):`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Move All to Trash',
          onPress: async () => {
            try {
              triggerLayoutAnimation();
              await commitBatchSoftDeletes(targets.map((a) => ({ col: 'activities', id: a.id })));
            } catch (e) { Alert.alert('Error', 'Could not move activities to Trash.'); }
          },
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerLayoutAnimation();
              await commitBatchDeletes(targets.map((a) => ({ col: 'activities', id: a.id })));
            } catch (e) { Alert.alert('Error', 'Could not permanently delete activities.'); }
          },
        },
      ]
    );
  };

  const commitSubjectOrderList = async (reorderedList) => {
    try {
      const batch = writeBatch(db);
      reorderedList.forEach((subj, index) => batch.update(doc(db, 'subjects', subj.id), { order: index }));
      await withWriteTimeout(batch.commit());
      await logActivity('Reordered Subjects', 'Updated instrument display order');
    } catch (e) {
      Alert.alert('Error', 'Could not save new subject order.');
    }
  };

  // Stale-closure-free PanGestureHandler callbacks for 6-Dot Subject Grip
  const handleSubjectDragStart = useCallback((subj) => {
    Keyboard.dismiss();
    const currentOrdered = orderedSubjectsRef.current;
    const currentActive = activeSubjectsRef.current;
    const listSnapshot = currentOrdered.length > 0 ? [...currentOrdered] : [...currentActive];
    const idx = listSnapshot.findIndex((s) => s.id === subj.id);
    if (idx === -1) return;
    dragInfoRef.current = {
      active: true,
      subjectId: subj.id,
      startIdx: idx,
      currentIdx: idx,
      list: listSnapshot,
    };
    setSubjectScrollLocked(true);
    dragSubjectY.setValue(0);
    setDraggingSubjectId(subj.id);
    triggerHaptic(14);
  }, [dragSubjectY]);

  const handleSubjectDragMove = useCallback((subj, event) => {
    const { translationY } = event.nativeEvent;
    if (!dragInfoRef.current.active) {
      handleSubjectDragStart(subj);
    }
    const { startIdx, currentIdx, list } = dragInfoRef.current;
    if (!list || list.length === 0) return;

    const targetIdx = Math.max(0, Math.min(list.length - 1, Math.round(startIdx + translationY / SUBJECT_ROW_HEIGHT)));
    if (targetIdx !== currentIdx) {
      const updated = [...list];
      const [moved] = updated.splice(currentIdx, 1);
      updated.splice(targetIdx, 0, moved);
      dragInfoRef.current.currentIdx = targetIdx;
      dragInfoRef.current.list = updated;
      orderedSubjectsRef.current = updated;
      triggerHaptic(10);
      setOrderedSubjects(updated);
    }
    dragSubjectY.setValue(translationY - (dragInfoRef.current.currentIdx - startIdx) * SUBJECT_ROW_HEIGHT);
  }, [dragSubjectY, handleSubjectDragStart]);

  const handleSubjectDragStateChange = useCallback((subj, event) => {
    const { state } = event.nativeEvent;
    if (state === State.BEGAN) {
      handleSubjectDragStart(subj);
    } else if (state === State.END || state === State.CANCELLED || state === State.FAILED) {
      setSubjectScrollLocked(false);
      if (!dragInfoRef.current.active) return;
      const finalOrder = [...dragInfoRef.current.list];
      const currentActive = activeSubjectsRef.current;
      const didChange = finalOrder.some((s, i) => s.id !== currentActive[i]?.id);
      dragInfoRef.current.active = false;

      Animated.timing(dragSubjectY, {
        toValue: 0,
        duration: 150,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start(() => {
        if (!isMountedRef.current) return;
        setDraggingSubjectId(null);
        setOrderedSubjects(finalOrder);
        if (didChange) {
          commitSubjectOrderList(finalOrder);
        }
      });
    }
  }, [dragSubjectY, handleSubjectDragStart]);

  const handleContextAction = async (action) => {
    const { entityType, item, title, reopenSubjectsModal, reopenTodayLogModal } = contextMenu;
    closeContextMenu();
    if (!item) return;
    const colMap = { subject: 'subjects', student: 'students', lesson: 'lessons', attendance: 'attendance', fee: 'fees', activity: 'activities' };
    if (action === 'delete') {
      await handleSoftDelete(colMap[entityType], item, title);
      if (reopenSubjectsModal) scheduleTimeout(() => setSubjectsModal(true), 250);
      if (reopenTodayLogModal) scheduleTimeout(() => setTodayLogModal(true), 250);
      return;
    }
    if (action === 'edit') {
      scheduleTimeout(() => {
        if (entityType === 'subject') {
          setSubjectForm({ id: item.id, name: safeString(item.name) });
          setSubjectsModal(true);
        } else if (entityType === 'student') {
          const validSubjectId = activeSubjects.some((s) => s.id === item.subjectId) ? item.subjectId : (activeSubjects[0]?.id || '');
          setStudentForm({ id: item.id, name: safeString(item.name), subjectId: validSubjectId, phone: safeString(item.phone), guardian: safeString(item.guardian), joinedDate: safeString(item.joinedDate, getTodayISO()) });
          setStudentModal(true);
        } else if (entityType === 'lesson') {
          setLessonEditForm({ id: item.id, studentId: item.studentId, date: safeString(item.date, getTodayISO()), technique: safeString(item.technique), repertoire: safeString(item.repertoire), assignment: safeString(item.assignment) });
          setLessonEditModal(true);
        } else if (entityType === 'attendance') {
          setAttendanceModalForm({ id: item.id, studentId: item.studentId, date: safeString(item.date, getTodayISO()), status: safeString(item.status, 'Present'), remarks: safeString(item.remarks) });
          setAttendanceModal(true);
        } else if (entityType === 'fee') {
          setFeeForm({ id: item.id, studentId: item.studentId, feeType: safeString(item.feeType, 'Monthly Fee'), monthPaidFor: safeString(item.monthPaidFor, getLocalCurrentMonthLabel()), date: safeString(item.date, getTodayISO()), mode: safeString(item.mode, 'UPI'), status: safeString(item.status, 'Paid'), amountPaid: String(safeNumber(item.amountPaid, 0)), balanceDue: String(safeNumber(item.balanceDue, 0)), remarks: safeString(item.remarks) });
          setFeeModal(true);
        }
      }, 250);
    }
  };

  const handleSaveSubject = async () => {
    Keyboard.dismiss();
    const trimmed = safeString(subjectForm.name).trim();
    if (!trimmed) return Alert.alert('Validation', 'Please enter a subject/instrument name.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const editingId = subjectForm.id;
      setSubjectForm({ id: null, name: '' });
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'subjects', editingId), { name: trimmed }));
        await logActivity('Updated Subject', trimmed);
      } else {
        await withWriteTimeout(addDoc(collection(db, 'subjects'), { name: trimmed, order: activeSubjects.length, isDeleted: false, deletedAt: null }));
        await logActivity('Added Subject', trimmed);
      }
    } catch (e) { Alert.alert('Error', 'Could not save subject.'); } finally { savingLockRef.current = false; }
  };

  const handleSaveStudent = async () => {
    Keyboard.dismiss();
    if (!safeString(studentForm.name).trim() || !studentForm.subjectId) return Alert.alert('Validation', 'Student Name and Subject are required.');
    const validDate = normalizeISODate(studentForm.joinedDate);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid enrollment date in YYYY-MM-DD format.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const payload = { name: safeString(studentForm.name).trim(), subjectId: studentForm.subjectId, phone: safeString(studentForm.phone).trim(), guardian: safeString(studentForm.guardian).trim(), joinedDate: validDate };
      const editingId = studentForm.id;
      setStudentModal(false);
      setStudentForm({ id: null, name: '', subjectId: activeSubjects[0]?.id || '', phone: '', guardian: '', joinedDate: getTodayISO() });
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'students', editingId), payload));
        await logActivity('Updated Student', payload.name);
      } else {
        await withWriteTimeout(addDoc(collection(db, 'students'), { ...payload, notes: '', priorityNote: false, isDeleted: false, deletedAt: null }));
        await logActivity('Enrolled Student', `${payload.name} (${safeString(subjectMap[payload.subjectId]?.name)})`);
      }
    } catch (e) { Alert.alert('Error', 'Could not save student record.'); } finally { savingLockRef.current = false; }
  };

  const handleSaveInlineLesson = async () => {
    Keyboard.dismiss();
    if (!selectedStudentId) return;
    const validDate = normalizeISODate(inlineLessonForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    if (!safeString(inlineLessonForm.technique).trim() && !safeString(inlineLessonForm.repertoire).trim() && !safeString(inlineLessonForm.assignment).trim()) return Alert.alert('Validation', 'Enter at least one lesson detail.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const payload = { studentId: selectedStudentId, date: validDate, lesson: safeString(inlineLessonForm.lesson).trim(), technique: safeString(inlineLessonForm.technique).trim(), repertoire: safeString(inlineLessonForm.repertoire).trim(), assignment: safeString(inlineLessonForm.assignment).trim(), isDeleted: false, deletedAt: null };
      setInlineLessonForm({ date: getTodayISO(), technique: '', repertoire: '', assignment: '' });
      await withWriteTimeout(addDoc(collection(db, 'lessons'), payload));
      await logActivity('Logged Lesson', `${safeString(studentMap[selectedStudentId]?.name, 'Student')} (${formatReadableLocalDate(validDate)})`);
    } catch (e) { Alert.alert('Error', 'Could not log lesson.'); } finally { savingLockRef.current = false; }
  };

  const handleSaveEditedLesson = async () => {
    Keyboard.dismiss();
    if (!lessonEditForm.id || !lessonEditForm.studentId) return;
    const validDate = normalizeISODate(lessonEditForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    if (!safeString(lessonEditForm.technique).trim() && !safeString(lessonEditForm.repertoire).trim() && !safeString(lessonEditForm.assignment).trim()) return Alert.alert('Validation', 'Enter at least one lesson detail.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const editingId = lessonEditForm.id;
      const payload = { studentId: lessonEditForm.studentId, date: validDate, lesson: safeString(lessonEditForm.lesson).trim(), technique: safeString(lessonEditForm.technique).trim(), repertoire: safeString(lessonEditForm.repertoire).trim(), assignment: safeString(lessonEditForm.assignment).trim() };
      setLessonEditModal(false);
      await withWriteTimeout(updateDoc(doc(db, 'lessons', editingId), payload));
      await logActivity('Updated Lesson', `${safeString(studentMap[payload.studentId]?.name, 'Student')} (${formatReadableLocalDate(validDate)})`);
    } catch (e) { Alert.alert('Error', 'Could not update lesson.'); } finally { savingLockRef.current = false; }
  };

  const handleSaveInlineAttendance = async () => {
    Keyboard.dismiss();
    if (!selectedStudentId) return;
    const validDate = normalizeISODate(inlineAttendanceForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const statusVal = inlineAttendanceForm.status;
      const remarksVal = safeString(inlineAttendanceForm.remarks).trim();
      setInlineAttendanceForm({ date: getTodayISO(), status: 'Present', remarks: '' });
      const existingRecord = activeAttendance.find((a) => a.studentId === selectedStudentId && a.date === validDate);
      if (existingRecord) {
        await withWriteTimeout(updateDoc(doc(db, 'attendance', existingRecord.id), { status: statusVal, remarks: remarksVal }));
        await logActivity('Updated Attendance', `${safeString(studentMap[selectedStudentId]?.name, 'Student')} • ${statusVal}`);
      } else {
        await withWriteTimeout(addDoc(collection(db, 'attendance'), { studentId: selectedStudentId, date: validDate, status: statusVal, remarks: remarksVal, isDeleted: false, deletedAt: null }));
        await logActivity('Marked Attendance', `${safeString(studentMap[selectedStudentId]?.name, 'Student')} • ${statusVal}`);
      }
    } catch (e) { Alert.alert('Error', 'Could not save attendance.'); } finally { savingLockRef.current = false; }
  };

  const handleSaveModalAttendance = async () => {
    Keyboard.dismiss();
    if (!attendanceModalForm.studentId) return Alert.alert('Validation', 'Please select a Student.');
    const validDate = normalizeISODate(attendanceModalForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    const payload = { studentId: attendanceModalForm.studentId, date: validDate, status: attendanceModalForm.status, remarks: safeString(attendanceModalForm.remarks).trim() };
    const duplicateRecord = activeAttendance.find((a) => a.studentId === payload.studentId && a.date === validDate && a.id !== attendanceModalForm.id);
    if (attendanceModalForm.id && duplicateRecord) {
      return Alert.alert('Duplicate Date', 'An attendance entry already exists for this student on that date.');
    }
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const editingId = attendanceModalForm.id;
      setAttendanceModal(false);
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'attendance', editingId), payload));
        await logActivity('Updated Attendance', `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ${payload.status}`);
      } else if (duplicateRecord) {
        await withWriteTimeout(updateDoc(doc(db, 'attendance', duplicateRecord.id), payload));
        await logActivity('Updated Attendance', `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ${payload.status}`);
      } else {
        await withWriteTimeout(addDoc(collection(db, 'attendance'), { ...payload, isDeleted: false, deletedAt: null }));
        await logActivity('Marked Attendance', `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ${payload.status}`);
      }
    } catch (e) { Alert.alert('Error', 'Could not save attendance.'); } finally { savingLockRef.current = false; }
  };

  const handleSaveStudentNotes = async () => {
    Keyboard.dismiss();
    if (!selectedStudentId || savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerHaptic(12);
      await withWriteTimeout(updateDoc(doc(db, 'students', selectedStudentId), { notes: safeString(noteDraft), priorityNote: Boolean(priorityDraft) }));
      await logActivity('Updated Student Notes', safeString(studentMap[selectedStudentId]?.name));
      Alert.alert('Saved', 'Student notes updated.');
    } catch (e) { Alert.alert('Error', 'Could not update student notes.'); } finally { savingLockRef.current = false; }
  };

  const handleSaveFee = async (shouldSharePDF = false) => {
    Keyboard.dismiss();
    if (!feeForm.studentId) return Alert.alert('Validation', 'Please select a Student.');
    if (feeForm.feeType === 'Monthly Fee' && !safeString(feeForm.monthPaidFor).trim()) return Alert.alert('Validation', '"Month Paid For" is required for Monthly Fees.');
    const validDate = normalizeISODate(feeForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    const numericPaid = feeForm.status === 'Unpaid' ? 0 : parseFloat(sanitizeCurrency(feeForm.amountPaid)) || 0;
    const numericBalance = feeForm.status === 'Paid' ? 0 : parseFloat(sanitizeCurrency(feeForm.balanceDue)) || 0;
    if (feeForm.status === 'Unpaid' && numericBalance <= 0) return Alert.alert('Validation', 'Unpaid records require a Balance Due greater than ₹0.');
    if (feeForm.status === 'Paid' && numericPaid <= 0) return Alert.alert('Validation', 'Paid records require an Amount Paid greater than ₹0.');
    if (feeForm.status === 'Partial' && (numericPaid <= 0 || numericBalance <= 0)) return Alert.alert('Validation', 'Partial payments require both Amount Paid and Balance Due to be greater than ₹0.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;

    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const editingId = feeForm.id;
      const payload = { studentId: feeForm.studentId, feeType: feeForm.feeType, monthPaidFor: feeForm.feeType === 'Monthly Fee' ? safeString(feeForm.monthPaidFor).trim() : '', date: validDate, mode: feeForm.mode, status: feeForm.status, amountPaid: numericPaid, balanceDue: numericBalance, remarks: safeString(feeForm.remarks).trim() };
      setFeeModal(false);
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'fees', editingId), payload));
        await logActivity('Updated Fee Record', `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ₹${numericPaid}`);
      } else {
        await withWriteTimeout(addDoc(collection(db, 'fees'), { ...payload, isDeleted: false, deletedAt: null }));
        await logActivity('Recorded Fee', `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ₹${numericPaid} (${payload.status})`);
      }
      if (shouldSharePDF) {
        scheduleTimeout(() => { generateAndShareReceiptPDF(payload); }, 350);
      }
    } catch (e) { Alert.alert('Error', 'Could not save fee record.'); } finally { savingLockRef.current = false; }
  };

  const handleUpdateNotice = async () => {
    Keyboard.dismiss();
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerHaptic(12);
      const today = getTodayISO();
      const textVal = safeString(noticeInput).trim();
      setNoticeEditModal(false);
      await withWriteTimeout(setDoc(doc(db, 'settings', 'noticeBoard'), { text: textVal, updatedDate: today }));
      await logActivity('Updated Notice Board', formatReadableLocalDate(today));
    } catch (e) { Alert.alert('Error', 'Could not update notice board.'); } finally { savingLockRef.current = false; }
  };

  const handleRestoreTrashItem = async (item) => {
    if (!item?._col || !item?.id) return;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      await withWriteTimeout(updateDoc(doc(db, item._col, item.id), { isDeleted: false, deletedAt: null }));
      if (item._col !== 'activities') {
        await logActivity('Restored from Trash', item._label);
      }
    } catch (e) { Alert.alert('Error', 'Could not restore item.'); }
  };

  const handlePermanentDeleteItem = async (item) => {
    if (!item?._col || !item?.id) return;
    try {
      triggerLayoutAnimation();
      triggerHaptic(18);
      const docsToDelete = [{ col: item._col, id: item.id }];
      if (item._col === 'students') {
        lessons.filter((l) => l.studentId === item.id).forEach((l) => docsToDelete.push({ col: 'lessons', id: l.id }));
        attendance.filter((a) => a.studentId === item.id).forEach((a) => docsToDelete.push({ col: 'attendance', id: a.id }));
        fees.filter((f) => f.studentId === item.id).forEach((f) => docsToDelete.push({ col: 'fees', id: f.id }));
      }
      await commitBatchDeletes(docsToDelete);
      if (item._col !== 'activities') {
        await logActivity('Permanently Deleted from Firebase', item._label);
      }
    } catch (e) { Alert.alert('Error', 'Could not delete item from Firebase.'); }
  };

  const handleEmptyTrash = () => {
    if (trashItems.length === 0) return;
    triggerHaptic(18);
    Alert.alert('Empty Trash Permanently?', `This will permanently erase ${trashItems.length} item(s) and any linked records directly from the Firebase database.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Empty Trash', style: 'destructive', onPress: async () => {
          try {
            triggerLayoutAnimation();
            const deletedStudentIds = new Set(trashItems.filter((i) => i._col === 'students').map((i) => i.id));
            const docsToDelete = new Map();
            trashItems.forEach((item) => docsToDelete.set(`${item._col}/${item.id}`, { col: item._col, id: item.id }));
            if (deletedStudentIds.size > 0) {
              lessons.filter((l) => deletedStudentIds.has(l.studentId)).forEach((l) => docsToDelete.set(`lessons/${l.id}`, { col: 'lessons', id: l.id }));
              attendance.filter((a) => deletedStudentIds.has(a.studentId)).forEach((a) => docsToDelete.set(`attendance/${a.id}`, { col: 'attendance', id: a.id }));
              fees.filter((f) => deletedStudentIds.has(f.studentId)).forEach((f) => docsToDelete.set(`fees/${f.id}`, { col: 'fees', id: f.id }));
            }
            await commitBatchDeletes(Array.from(docsToDelete.values()));
          } catch (e) { Alert.alert('Error', 'Failed to empty trash from Firebase.'); }
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

  const handleMainTabSwipe = useCallback((event) => {
    const { translationX } = event.nativeEvent;
    if (Math.abs(translationX) < 35) return false;

    const currentIndex = MAIN_TABS.indexOf(activeTabRef.current);
    if (translationX < -35 && currentIndex < MAIN_TABS.length - 1) {
      Keyboard.dismiss();
      setNavDirection(1);
      setActiveTab(MAIN_TABS[currentIndex + 1]);
      return true;
    } else if (translationX > 35 && currentIndex > 0) {
      Keyboard.dismiss();
      setNavDirection(-1);
      setActiveTab(MAIN_TABS[currentIndex - 1]);
      return true;
    }
    return false;
  }, []);

  const handleProfileSubTabSwipe = useCallback((event) => {
    const { translationX } = event.nativeEvent;
    if (Math.abs(translationX) < 35) return false;

    const currentIndex = PROFILE_TABS.indexOf(profileTabRef.current);
    if (translationX < -35 && currentIndex < PROFILE_TABS.length - 1) {
      Keyboard.dismiss();
      setSubTabDirection(1);
      setProfileTab(PROFILE_TABS[currentIndex + 1]);
      return true;
    } else if (translationX > 35 && currentIndex > 0) {
      Keyboard.dismiss();
      setSubTabDirection(-1);
      setProfileTab(PROFILE_TABS[currentIndex - 1]);
      return true;
    }
    return false;
  }, []);

  const renderCalendarDays = () => {
    const { viewYear, viewMonth, selectedDate, onSelect } = calendarPicker;
    const firstDay = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const cells = [];
    for (let i = 0; i < firstDay; i++) cells.push(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(d);

    return (
      <View style={styles.calendarGrid}>
        {cells.map((dayNum, index) => {
          if (!dayNum) return <View key={`empty-${index}`} style={styles.calendarDayCell} />;
          const isoStr = `${viewYear}-${String(viewMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
          const isSelected = isoStr === selectedDate;
          const isToday = isoStr === getTodayISO();
          return (
            <TouchableOpacity
              key={isoStr}
              style={[styles.calendarDayCell, isToday && styles.calendarDayToday, isSelected && styles.calendarDaySelected]}
              onPress={() => {
                triggerHaptic(10);
                if (typeof onSelect === 'function') onSelect(isoStr);
                setCalendarPicker((prev) => ({ ...prev, visible: false }));
              }}
            >
              <Text style={[styles.calendarDayText, isToday && styles.calendarDayTextToday, isSelected && styles.calendarDayTextSelected]}>{dayNum}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  const renderCalendarOverlay = () => {
    if (!calendarPicker.visible) return null;
    return (
      <Pressable
        style={styles.calendarPortalOverlay}
        onPress={() => setCalendarPicker((prev) => ({ ...prev, visible: false }))}
      >
        <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.calendarHeaderRow}>
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => {
                const prevM = calendarPicker.viewMonth === 0 ? 11 : calendarPicker.viewMonth - 1;
                const prevY = calendarPicker.viewMonth === 0 ? calendarPicker.viewYear - 1 : calendarPicker.viewYear;
                setCalendarPicker({ ...calendarPicker, viewMonth: prevM, viewYear: prevY });
              }}
            >
              <Ionicons name="chevron-back" size={18} color={COLORS.navy} />
            </TouchableOpacity>
            <Text style={styles.calendarMonthTitle}>{MONTHS_FULL[calendarPicker.viewMonth]} {calendarPicker.viewYear}</Text>
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => {
                const nextM = calendarPicker.viewMonth === 11 ? 0 : calendarPicker.viewMonth + 1;
                const nextY = calendarPicker.viewMonth === 11 ? calendarPicker.viewYear + 1 : calendarPicker.viewYear;
                setCalendarPicker({ ...calendarPicker, viewMonth: nextM, viewYear: nextY });
              }}
            >
              <Ionicons name="chevron-forward" size={18} color={COLORS.navy} />
            </TouchableOpacity>
          </View>
          <View style={styles.calendarWeekRow}>
            {WEEKDAYS_SHORT.map((w) => <Text key={w} style={styles.calendarWeekText}>{w}</Text>)}
          </View>
          {renderCalendarDays()}
          <View style={[styles.modalBtnRow, { justifyContent: 'space-between', marginTop: 14 }]}>
            <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => {
              const today = getTodayISO();
              if (typeof calendarPicker.onSelect === 'function') calendarPicker.onSelect(today);
              setCalendarPicker((prev) => ({ ...prev, visible: false }));
            }}>Select Today</PaperButton>
            <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => setCalendarPicker((prev) => ({ ...prev, visible: false }))}>Close</PaperButton>
          </View>
        </Pressable>
      </Pressable>
    );
  };

  const renderHomeTab = () => {
    const recentFourActivities = activeActivities.slice(0, 4);
    const todayISO = getTodayISO();
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Surface style={styles.heroCard} elevation={4}>
          <View style={styles.crestBadge}><Text style={styles.crestBadgeText}>★ JSM • EST. 2022 ★</Text></View>
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
              <Text style={styles.sectionTitle}>JSM NOTICE BOARD</Text>
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
          <View style={[styles.cardHeaderRow, { flexWrap: 'wrap', gap: 8 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.sectionTitle}>RECENT ACTIVITY AUDIT</Text>
              <Text style={styles.silverMeta}>Hold any activity to move to Trash</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {activeActivities.length > 0 ? (
                <TouchableOpacity style={styles.dangerOutlineBtnSmall} onPress={() => handleClearAllActivities(false)}>
                  <Ionicons name="trash-outline" size={13} color={COLORS.danger} />
                  <Text style={styles.dangerOutlineBtnSmallText}>Delete All</Text>
                </TouchableOpacity>
              ) : null}
              <PaperButton mode="outlined" buttonColor={COLORS.navy} textColor={COLORS.gold} style={{ borderColor: COLORS.gold }} labelStyle={{ fontSize: 11 }} onPress={() => setTodayLogModal(true)}>Today's Log</PaperButton>
            </View>
          </View>
          {recentFourActivities.length === 0 ? <Text style={styles.emptyText}>No recent actions recorded yet.</Text> : recentFourActivities.map((act) => (
            <Pressable
              key={act.id}
              style={({ pressed }) => [styles.activityItem, pressed && styles.cardPressed]}
              onLongPress={() => openLongPressMenu('activity', act, `${act.title}${act.subtitle ? ` • ${act.subtitle}` : ''}`)}
              delayLongPress={280}
            >
              <View style={styles.activityDot} />
              <View style={{ flex: 1 }}><Text style={styles.activityTitle}>{act.title}</Text>{act.subtitle ? <Text style={styles.activitySub}>{act.subtitle}</Text> : null}</View>
              <Text style={styles.silverMeta}>{formatReadableLocalDate(act.dateISO)}</Text>
            </Pressable>
          ))}
        </Surface>
      </ScrollView>
    );
  };

  const renderStudentCard = (st) => {
    const metrics = getStudentMetrics(st.id);
    return (
      <Pressable key={st.id} style={({ pressed }) => pressed && styles.cardPressed} onPress={() => {
          Keyboard.dismiss();
          setNavDirection(1);
          setSubTabDirection(1);
          setSelectedStudentId(st.id);
          setProfileTab('Classes');
        }} onLongPress={() => openLongPressMenu('student', st, st.name)} delayLongPress={280}>
        <Surface style={styles.cleanRecordCard} elevation={2}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.recordPrimaryTitle}>{safeString(st.name, 'Unnamed Student')}</Text>
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
    const query = safeString(studentSearch).trim().toLowerCase();
    const filteredStudents = activeStudents.filter((st) => {
      const matchesQuery = !query || safeString(st.name).toLowerCase().includes(query) || safeString(st.phone).toLowerCase().includes(query) || safeString(subjectMap[st.subjectId]?.name).toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (studentFilter === 'Priority') return Boolean(st.priorityNote);
      if (studentFilter === 'Due') return getStudentMetrics(st.id).feeStatus === 'Due / Unpaid';
      return true;
    });
    const activeSubjectIdSet = new Set(activeSubjects.map((s) => s.id));
    const unassignedStudents = filteredStudents.filter((st) => !activeSubjectIdSet.has(st.subjectId));

    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}><Text style={styles.pageHeading}>Student Directory</Text><Text style={styles.silverMeta}>Tap to open profile • Hold card to edit/delete</Text></View>
          <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => {
            Keyboard.dismiss();
            if (activeSubjects.length === 0) return Alert.alert('Subject Required', 'Add an instrument in Manage Subjects first.');
            setStudentForm({ id: null, name: '', subjectId: activeSubjects[0]?.id || '', phone: '', guardian: '', joinedDate: getTodayISO() });
            setStudentModal(true);
          }}>+ Student</PaperButton>
        </View>

        <PaperInput mode="outlined" placeholder="Search student, instrument, or phone..." value={studentSearch} onChangeText={setStudentSearch} left={<PaperInput.Icon icon="magnify" />} right={studentSearch.length > 0 ? <PaperInput.Icon icon="close-circle" onPress={() => setStudentSearch('')} /> : null} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 14 }} />

        <View style={[styles.chipRow, { marginBottom: 14 }]}>
          {[{ key: 'All', label: `All (${activeStudents.length})` }, { key: 'Due', label: 'Due / Unpaid' }, { key: 'Priority', label: '★ Priority Notes' }].map((f) => (
            <TouchableOpacity key={f.key} style={[styles.choiceChip, studentFilter === f.key && styles.choiceChipSelected]} onPress={() => { Keyboard.dismiss(); setStudentFilter(f.key); }}>
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
                  <View style={styles.groupHeaderBar}><Text style={styles.groupHeaderTitle}>{safeString(subj.name, 'Instrument').toUpperCase()}</Text><Text style={styles.groupHeaderCount}>{subjStudents.length}</Text></View>
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.cardHeaderRow}>
          <TouchableOpacity style={styles.backButtonRow} onPress={() => { Keyboard.dismiss(); setNavDirection(-1); setSelectedStudentId(null); }}>
            <Ionicons name="arrow-back" size={18} color={COLORS.navy} /><Text style={styles.backButtonText}>Back to Directory</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.secondaryButtonSmall} onPress={() => openLongPressMenu('student', student, student.name)}>
            <Ionicons name="create-outline" size={15} color={COLORS.navy} /><Text style={styles.secondaryButtonSmallText}>Edit Student</Text>
          </TouchableOpacity>
        </View>

        <Surface style={styles.heroCard} elevation={3}>
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.crestBadgeText}>{safeString(subjectMap[student.subjectId]?.name, 'Unassigned').toUpperCase()} DEPARTMENT</Text>
              <Text style={styles.heroGreeting}>{safeString(student.name, 'Student')}</Text>
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
          {PROFILE_TABS.map((tab) => (
            <TouchableOpacity key={tab} style={[styles.pillNavItem, profileTab === tab && styles.pillNavItemActive]} onPress={() => {
                if (tab === profileTab) return;
                Keyboard.dismiss();
                const newIdx = PROFILE_TABS.indexOf(tab);
                const oldIdx = PROFILE_TABS.indexOf(profileTab);
                setSubTabDirection(newIdx > oldIdx ? 1 : -1);
                setProfileTab(tab);
              }}>
              <Text style={[styles.pillNavText, profileTab === tab && styles.pillNavTextActive]}>{tab}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <AnimatedScreen
          direction={subTabDirection}
          triggerKey={`${student.id}-${profileTab}`}
          onSwipe={handleProfileSubTabSwipe}
          swipeEnabled={true}
        >
          {profileTab === 'Classes' && (
            <View>
              <Surface style={styles.whiteCard} elevation={1}>
                <Text style={styles.sectionTitle}>LOG NEW LESSON</Text>
                <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
                <QuickDateRow currentDate={inlineLessonForm.date} onSelectDate={(d) => setInlineLessonForm({ ...inlineLessonForm, date: d })} onOpenCalendar={openCalendarPicker} />
                <PaperInput mode="outlined" value={inlineLessonForm.date} onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, date: t })} placeholder="YYYY-MM-DD" right={<PaperInput.Icon icon="calendar" onPress={() => openCalendarPicker(inlineLessonForm.date, (d) => setInlineLessonForm({ ...inlineLessonForm, date: d }))} />} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <Text style={styles.inputLabel}>Technique</Text>
                <PaperInput mode="outlined" value={inlineLessonForm.technique} onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, technique: t })} placeholder="Scales, arpeggios, posture..." outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <Text style={styles.inputLabel}>Lesson</Text>
                <PaperInput mode="outlined" value={inlineLessonForm.lesson} onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, lesson: t })} placeholder="Main lesson topic..." outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <Text style={styles.inputLabel}>Repertoire</Text>
                <PaperInput mode="outlined" value={inlineLessonForm.repertoire} onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, repertoire: t })} placeholder="Sonatina in C, Etude Op. 10..." outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <Text style={styles.inputLabel}>Assignment</Text>
                <PaperInput mode="outlined" value={inlineLessonForm.assignment} onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, assignment: t })} placeholder="Practice measures 16-32 at 80 BPM" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveInlineLesson} style={{ marginTop: 10, borderRadius: 8 }}>Save Lesson Entry</PaperButton>
              </Surface>
              <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>LESSON HISTORY (HOLD CARD TO EDIT/DELETE)</Text>
              {metrics.stLessons.length === 0 ? <Text style={styles.emptyText}>No lessons logged for this student yet.</Text> : metrics.stLessons.map((les) => (
                <Pressable key={les.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('lesson', les, `Lesson on ${formatReadableLocalDate(les.date)}`)} delayLongPress={280}>
                  <Surface style={styles.cleanRecordCard} elevation={2}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.recordPrimaryTitle}>{formatReadableLocalDate(les.date)}</Text>
                      {les.technique ? <Text style={styles.recordDetailLine}><Text style={styles.boldLabel}>Technique: </Text>{les.technique}</Text> : null}
                      {les.lesson ? <Text style={styles.recordDetailLine}><Text style={styles.boldLabel}>Lesson: </Text>{les.lesson}</Text> : null}
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
                <QuickDateRow currentDate={inlineAttendanceForm.date} onSelectDate={(d) => setInlineAttendanceForm({ ...inlineAttendanceForm, date: d })} onOpenCalendar={openCalendarPicker} />
                <PaperInput mode="outlined" value={inlineAttendanceForm.date} onChangeText={(t) => setInlineAttendanceForm({ ...inlineAttendanceForm, date: t })} right={<PaperInput.Icon icon="calendar" onPress={() => openCalendarPicker(inlineAttendanceForm.date, (d) => setInlineAttendanceForm({ ...inlineAttendanceForm, date: d }))} />} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
                <Text style={styles.inputLabel}>Status</Text>
                <View style={styles.chipRow}>
                  {ATTENDANCE_STATUSES.map((st) => (
                    <TouchableOpacity key={st} style={[styles.choiceChip, inlineAttendanceForm.status === st && styles.choiceChipSelected]} onPress={() => { Keyboard.dismiss(); setInlineAttendanceForm({ ...inlineAttendanceForm, status: st }); }}>
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
                <Pressable key={att.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('attendance', att, `${att.status} (${formatReadableLocalDate(att.date)})`)} delayLongPress={280}>
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
                  Keyboard.dismiss();
                  setFeeForm({ id: null, studentId: student.id, feeType: 'Monthly Fee', monthPaidFor: getLocalCurrentMonthLabel(), date: getTodayISO(), mode: 'UPI', status: 'Paid', amountPaid: '', balanceDue: '0', remarks: '' });
                  setFeeModal(true);
                }}>+ Record Fee</PaperButton>
              </View>
              {metrics.stFees.length === 0 ? <Surface style={styles.whiteCard} elevation={1}><Text style={styles.emptyText}>No fee records logged for this student.</Text></Surface> : metrics.stFees.map((fee) => (
                <Pressable key={fee.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('fee', fee, `${fee.feeType} - ₹${fee.amountPaid} (${formatReadableLocalDate(fee.date)})`)} delayLongPress={280}>
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
        </AnimatedScreen>
      </ScrollView>
    );
  };

  const renderAttendanceTab = () => {
    const filteredRecords = attendanceFilterAllMonths ? activeAttendance : activeAttendance.filter((a) => isWithinLastTwoLocalMonths(a.date));
    const groupedAttendance = groupRecordsBySubjectAndMonth(filteredRecords);
    return (
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}><Text style={styles.pageHeading}>Attendance Register</Text><Text style={styles.silverMeta}>{attendanceFilterAllMonths ? 'Showing complete history' : 'Showing last 2 months'} • Hold card to edit/delete</Text></View>
          <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => {
            Keyboard.dismiss();
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
            <View style={styles.groupHeaderBar}><Text style={styles.groupHeaderTitle}>{safeString(group.subject.name, 'Instrument').toUpperCase()}</Text></View>
            {group.months.map((mGroup) => (
              <View key={mGroup.monthName} style={{ marginTop: 8 }}>
                <Text style={styles.monthSubHeader}>{mGroup.monthName}</Text>
                {mGroup.items.map((att) => {
                  const st = studentMap[att.studentId];
                  return (
                    <Pressable key={att.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('attendance', att, `${safeString(st?.name, 'Student')} - ${att.status} (${formatReadableLocalDate(att.date)})`)} delayLongPress={280}>
                      <Surface style={styles.cleanRecordCard} elevation={2}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordPrimaryTitle}>{safeString(st?.name, 'Unknown')}</Text>
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}><Text style={styles.pageHeading}>Global Fee Ledger</Text><Text style={styles.silverMeta}>Grouped by Subject & Month • Hold card to edit/delete</Text></View>
          <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => {
            Keyboard.dismiss();
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
            <View style={styles.groupHeaderBar}><Text style={styles.groupHeaderTitle}>{safeString(group.subject.name, 'Instrument').toUpperCase()}</Text></View>
            {group.months.map((mGroup) => (
              <View key={mGroup.monthName} style={{ marginTop: 8 }}>
                <Text style={styles.monthSubHeader}>{mGroup.monthName}</Text>
                {mGroup.items.map((fee) => {
                  const st = studentMap[fee.studentId];
                  const isFullyPaid = fee.status === 'Paid' && safeNumber(fee.balanceDue, 0) === 0;
                  return (
                    <Pressable key={fee.id} style={({ pressed }) => pressed && styles.cardPressed} onLongPress={() => openLongPressMenu('fee', fee, `${safeString(st?.name, 'Student')} - ₹${fee.amountPaid}`)} delayLongPress={280}>
                      <Surface style={styles.cleanRecordCard} elevation={2}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordPrimaryTitle}>{safeString(st?.name, 'Unknown')} • {fee.feeType}</Text>
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
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <View style={styles.tabTopBar}>
          <View style={{ flex: 1 }}><Text style={styles.pageHeading}>Trash Archive</Text><Text style={styles.silverMeta}>Items are auto-purged after 30 days. Tap any item to Restore or Delete Permanently from Firebase.</Text></View>
          {trashItems.length > 0 && <PaperButton mode="contained" buttonColor={COLORS.danger} textColor={COLORS.white} onPress={handleEmptyTrash}>Empty Trash</PaperButton>}
        </View>

        {trashItems.length === 0 ? <Surface style={styles.whiteCard} elevation={1}><Text style={styles.emptyText}>Trash archive is completely clean.</Text></Surface> : trashItems.map((item) => {
          const daysLeft = getDaysRemainingInTrash(item.deletedAt);
          return (
            <TouchableOpacity key={`${item._col}-${item.id}`} onPress={() => {
              triggerHaptic(10);
              Alert.alert(item._label, `${daysLeft} days remaining before permanent purge from Firebase.`, [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Restore', onPress: () => handleRestoreTrashItem(item) },
                { text: 'Delete Permanently', style: 'destructive', onPress: () => handlePermanentDeleteItem(item) },
              ]);
            }}>
              <Surface style={styles.cleanRecordCard} elevation={2}>
                <View style={{ flex: 1 }}><Text style={styles.recordPrimaryTitle}>{item._label}</Text><Text style={styles.recordSecondarySub}>Collection: {safeString(item._col).toUpperCase()}</Text></View>
                <View style={styles.daysRemainingBadge}><Text style={styles.daysRemainingText}>{daysLeft}d left</Text></View>
              </Surface>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    );
  };

  const todayActivities = activeActivities.filter((a) => a.dateISO === getTodayISO());
  const isInsideStudentProfile = activeTab === 'Students' && Boolean(selectedStudent);
  const anyFormModalOpen = studentModal || lessonEditModal || attendanceModal || feeModal;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      <Appbar.Header style={{ backgroundColor: COLORS.navy, borderBottomWidth: 2, borderBottomColor: COLORS.gold }}>
        <Appbar.Action icon="menu" color={COLORS.gold} onPress={openDrawer} />
        <Appbar.Content title="JSM" subtitle="EST. 2022" titleStyle={{ color: COLORS.white, fontSize: 18, fontWeight: '700', letterSpacing: 2 }} subtitleStyle={{ color: COLORS.gold, fontSize: 10, letterSpacing: 3, fontWeight: '600' }} style={{ alignItems: 'center' }} />
        <View style={{ width: 48 }} />
      </Appbar.Header>

      <View style={{ flex: 1 }}>
        {/* Strict Very-Edge Swipe Strip (16px wide at left: 0) */}
        <PanGestureHandler
          activeOffsetX={10}
          failOffsetY={[-18, 18]}
          onEnded={(e) => {
            if (e.nativeEvent.translationX > 24) openDrawer();
          }}
        >
          <View style={styles.leftEdgeSwipeZone} />
        </PanGestureHandler>

        <AnimatedScreen
          direction={navDirection}
          onSwipe={handleMainTabSwipe}
          swipeEnabled={!isInsideStudentProfile}
          triggerKey={`${activeTab}-${selectedStudentId || 'list'}`}
        >
          {activeTab === 'Home' && renderHomeTab()}
          {activeTab === 'Students' && renderStudentsTab()}
          {activeTab === 'Attendance' && renderAttendanceTab()}
          {activeTab === 'Fees' && renderFeesTab()}
          {activeTab === 'Trash' && renderTrashTab()}
        </AnimatedScreen>

        {!anyFormModalOpen && renderCalendarOverlay()}
      </View>

      <View style={styles.bottomTabBar}>
        {[{ key: 'Home', icon: 'grid-outline', label: 'Home' }, { key: 'Students', icon: 'people-outline', label: 'Students' }, { key: 'Attendance', icon: 'calendar-check-outline', label: 'Attendance', mci: true }, { key: 'Fees', icon: 'card-outline', label: 'Fees' }, { key: 'Trash', icon: 'trash-outline', label: 'Trash' }].map((tab) => {
          const isFocused = activeTab === tab.key;
          return (
            <TouchableOpacity key={tab.key} style={styles.bottomTabItem} onPress={() => {
                Keyboard.dismiss();
                if (tab.key === 'Students' && activeTab === 'Students' && selectedStudentId) {
                  setNavDirection(-1);
                  setSelectedStudentId(null);
                  return;
                }
                if (tab.key === activeTab) return;
                const newIdx = MAIN_TABS.indexOf(tab.key);
                const oldIdx = MAIN_TABS.indexOf(activeTab);
                setNavDirection(newIdx > oldIdx ? 1 : -1);
                if (tab.key !== 'Students') setSelectedStudentId(null);
                setActiveTab(tab.key);
              }}>
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
        <GestureHandlerRootView style={{ flex: 1 }}>
          <Animated.View style={[styles.drawerOverlay, { opacity: drawerBackdropAnim }]}>
            <PanGestureHandler
              activeOffsetX={[-15, 15]}
              onEnded={(e) => {
                if (e.nativeEvent.translationX < -30) closeDrawer();
              }}
            >
              <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: drawerSlideAnim }] }]}>
                <View style={styles.drawerHeader}><Text style={styles.crestBadgeText}>★ JSM ★</Text><Text style={styles.drawerTitle}>Music School Portal</Text><Text style={styles.drawerSub}>Est. 2022 • Official Edition</Text></View>
                <ScrollView contentContainerStyle={{ padding: 16, gap: 10 }} keyboardShouldPersistTaps="handled">
                  {[{ label: 'Home Dashboard', tab: 'Home', icon: 'grid-outline' }, { label: 'Student Directory', tab: 'Students', icon: 'people-outline' }, { label: 'Global Attendance', tab: 'Attendance', icon: 'calendar-outline' }, { label: 'Global Fee Register', tab: 'Fees', icon: 'card-outline' }, { label: `Trash Archive (${trashItems.length})`, tab: 'Trash', icon: 'trash-outline' }].map((nav) => (
                    <TouchableOpacity key={nav.tab} style={[styles.drawerNavItem, activeTab === nav.tab && styles.drawerNavItemActive]} onPress={() => {
                        closeDrawer(() => {
                          const newIdx = MAIN_TABS.indexOf(nav.tab);
                          const oldIdx = MAIN_TABS.indexOf(activeTabRef.current);
                          setNavDirection(newIdx >= oldIdx ? 1 : -1);
                          setSelectedStudentId(null);
                          setActiveTab(nav.tab);
                        });
                      }}>
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
                </ScrollView>
              </Animated.View>
            </PanGestureHandler>
            <Pressable style={{ flex: 1 }} onPress={() => closeDrawer()} />
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>

      {/* LONG-PRESS CONTEXT MENU */}
      <Modal visible={contextMenu.visible} transparent animationType="fade" onRequestClose={closeContextMenu}>
        <Pressable style={styles.modalBackdrop} onPress={closeContextMenu}>
          <Pressable style={styles.contextSheet} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.contextSheetHeader}>{contextMenu.title}</Text>
            <View style={styles.contextDivider} />
            {contextMenu.entityType !== 'activity' && (
              <TouchableOpacity style={styles.contextOptionBtn} onPress={() => handleContextAction('edit')}><Text style={styles.contextOptionText}>Edit Record</Text></TouchableOpacity>
            )}
            <TouchableOpacity style={styles.contextOptionBtn} onPress={() => handleContextAction('delete')}><Text style={[styles.contextOptionText, { color: COLORS.danger }]}>Delete (Move to Trash)</Text></TouchableOpacity>
            <PaperButton mode="outlined" textColor={COLORS.navy} style={{ marginTop: 10, width: '100%', borderColor: COLORS.silver }} onPress={() => {
              const shouldReopenSubj = contextMenu.reopenSubjectsModal;
              const shouldReopenLog = contextMenu.reopenTodayLogModal;
              closeContextMenu();
              if (shouldReopenSubj) scheduleTimeout(() => setSubjectsModal(true), 250);
              if (shouldReopenLog) scheduleTimeout(() => setTodayLogModal(true), 250);
            }}>Cancel</PaperButton>
          </Pressable>
        </Pressable>
      </Modal>

      {/* NOTICE READ MODAL */}
      <Modal visible={noticeReadModal} transparent animationType="fade" onRequestClose={() => setNoticeReadModal(false)}>
        <View style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>JSM OFFICIAL NOTICE</Text>
            {noticeUpdatedAt ? <Text style={styles.silverMeta}>Posted {formatReadableLocalDate(noticeUpdatedAt)}</Text> : null}
            <ScrollView style={{ maxHeight: 260, marginVertical: 14 }} keyboardShouldPersistTaps="handled"><Text style={styles.noticeFullText}>{noticeText || 'No active notice has been posted.'}</Text></ScrollView>
            <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => setNoticeReadModal(false)}>Close</PaperButton>
          </Surface>
        </View>
      </Modal>

      {/* NOTICE EDIT MODAL */}
      <Modal visible={noticeEditModal} transparent animationType="fade" onRequestClose={() => setNoticeEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>UPDATE NOTICE BOARD</Text>
            <PaperInput mode="outlined" multiline numberOfLines={5} value={noticeInput} onChangeText={setNoticeInput} placeholder="Type new JSM announcement..." outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginTop: 10, marginBottom: 14 }} />
            <View style={styles.modalBtnRow}>
              <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => { Keyboard.dismiss(); setNoticeEditModal(false); }}>Cancel</PaperButton>
              <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleUpdateNotice}>Publish</PaperButton>
            </View>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>

      {/* TODAY'S AUDIT LOG MODAL */}
      <Modal visible={todayLogModal} transparent animationType="fade" onRequestClose={() => setTodayLogModal(false)}>
        <View style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <View style={[styles.cardHeaderRow, { gap: 8 }]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.sectionTitle}>TODAY'S AUDIT LOG ({formatReadableLocalDate(getTodayISO())})</Text>
                <Text style={styles.silverMeta}>Hold any entry to move to Trash</Text>
              </View>
              {todayActivities.length > 0 ? (
                <TouchableOpacity style={styles.dangerOutlineBtnSmall} onPress={() => handleClearAllActivities(true)}>
                  <Ionicons name="trash-outline" size={13} color={COLORS.danger} />
                  <Text style={styles.dangerOutlineBtnSmallText}>Delete All</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            <ScrollView style={{ maxHeight: 320, marginVertical: 12 }} keyboardShouldPersistTaps="handled">
              {todayActivities.length === 0 ? <Text style={styles.emptyText}>No actions logged today.</Text> : todayActivities.map((act) => (
                <Pressable
                  key={act.id}
                  style={({ pressed }) => [styles.activityItem, pressed && styles.cardPressed]}
                  onLongPress={() => {
                    setTodayLogModal(false);
                    scheduleTimeout(() => openLongPressMenu('activity', act, `${act.title}${act.subtitle ? ` • ${act.subtitle}` : ''}`, false, true), 250);
                  }}
                  delayLongPress={280}
                >
                  <View style={styles.activityDot} /><View style={{ flex: 1 }}><Text style={styles.activityTitle}>{act.title}</Text>{act.subtitle ? <Text style={styles.activitySub}>{act.subtitle}</Text> : null}</View>
                </Pressable>
              ))}
            </ScrollView>
            <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => setTodayLogModal(false)}>Close</PaperButton>
          </Surface>
        </View>
      </Modal>

      {/* MANAGE SUBJECTS MODAL (WITH 6-DOT DRAG HANDLE REORDERING) */}
      <Modal visible={subjectsModal} transparent animationType="fade" onRequestClose={() => setSubjectsModal(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
            <Surface style={styles.modalCard} elevation={5}>
              <Text style={styles.sectionTitle}>MANAGE INSTRUMENTS & SUBJECTS</Text>
              <Text style={styles.silverMeta}>Touch & slide the 6-dot handle to reorder, or use edit/delete.</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <PaperInput mode="outlined" value={subjectForm.name} onChangeText={(t) => setSubjectForm({ ...subjectForm, name: t })} placeholder="e.g., Piano, Violin, Guitar" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ flex: 1, backgroundColor: COLORS.white, height: 50 }} />
                <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveSubject}>{subjectForm.id ? 'Update' : 'Add'}</PaperButton>
              </View>
              <ScrollView
                style={{ maxHeight: 290, marginVertical: 14 }}
                scrollEnabled={!subjectScrollLocked && !draggingSubjectId}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {orderedSubjects.length === 0 ? (
                  <Text style={styles.emptyText}>No subjects added yet.</Text>
                ) : (
                  orderedSubjects.map((subj, idx) => {
                    const isDragging = draggingSubjectId === subj.id;
                    return (
                      <Animated.View
                        key={subj.id}
                        style={[
                          isDragging && {
                            zIndex: 50,
                            elevation: 8,
                            transform: [{ translateY: dragSubjectY }, { scale: 1.02 }],
                          },
                        ]}
                      >
                        <Surface
                          style={[
                            styles.cleanRecordCard,
                            { minHeight: 52, paddingVertical: 8, paddingHorizontal: 10 },
                            isDragging && styles.draggingSubjectCard,
                          ]}
                          elevation={isDragging ? 5 : 2}
                        >
                          <PanGestureHandler
                            activeOffsetY={[-2, 2]}
                            onGestureEvent={(e) => handleSubjectDragMove(subj, e)}
                            onHandlerStateChange={(e) => handleSubjectDragStateChange(subj, e)}
                          >
                            <View
                              style={styles.dragHandleBtn}
                              onTouchStart={() => setSubjectScrollLocked(true)}
                              onTouchEnd={() => { if (!dragInfoRef.current.active) setSubjectScrollLocked(false); }}
                              onTouchCancel={() => { if (!dragInfoRef.current.active) setSubjectScrollLocked(false); }}
                            >
                              <MaterialCommunityIcons
                                name="drag-vertical"
                                size={24}
                                color={isDragging ? COLORS.navy : COLORS.silver}
                              />
                            </View>
                          </PanGestureHandler>

                          <Pressable
                            style={{ flex: 1, paddingVertical: 6 }}
                            onLongPress={() => {
                              if (draggingSubjectId) return;
                              setSubjectsModal(false);
                              scheduleTimeout(() => openLongPressMenu('subject', subj, subj.name, true), 250);
                            }}
                            delayLongPress={320}
                          >
                            <Text style={styles.recordPrimaryTitle}>
                              {idx + 1}. {subj.name}
                            </Text>
                          </Pressable>

                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <TouchableOpacity style={styles.iconActionBtn} onPress={() => setSubjectForm({ id: subj.id, name: subj.name })}>
                              <Ionicons name="pencil" size={15} color={COLORS.navy} />
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.iconActionBtn} onPress={() => handleSoftDelete('subjects', subj, `Subject: ${subj.name}`)}>
                              <Ionicons name="trash-outline" size={15} color={COLORS.danger} />
                            </TouchableOpacity>
                          </View>
                        </Surface>
                      </Animated.View>
                    );
                  })
                )}
              </ScrollView>
              <PaperButton mode="outlined" textColor={COLORS.navy} style={{ alignSelf: 'flex-end', borderColor: COLORS.silver }} onPress={() => { Keyboard.dismiss(); setSubjectForm({ id: null, name: '' }); setSubjectsModal(false); }}>Done</PaperButton>
            </Surface>
          </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Modal>

      {/* REGISTER / EDIT STUDENT MODAL */}
      <Modal visible={studentModal} transparent animationType="fade" onRequestClose={() => setStudentModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>{studentForm.id ? 'EDIT STUDENT DETAILS' : 'REGISTER NEW STUDENT'}</Text>
            <ScrollView style={{ maxHeight: 380 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Full Name *</Text>
              <PaperInput mode="outlined" value={studentForm.name} onChangeText={(t) => setStudentForm({ ...studentForm, name: t })} placeholder="Student Full Name" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Select Subject / Instrument *</Text>
              <View style={styles.chipRow}>
                {activeSubjects.map((s) => (
                  <TouchableOpacity key={s.id} style={[styles.choiceChip, studentForm.subjectId === s.id && styles.choiceChipSelected]} onPress={() => { Keyboard.dismiss(); setStudentForm({ ...studentForm, subjectId: s.id }); }}>
                    <Text style={[styles.choiceChipText, studentForm.subjectId === s.id && styles.choiceChipTextSelected]}>{s.name}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Phone / WhatsApp</Text>
              <PaperInput mode="outlined" value={studentForm.phone} onChangeText={(t) => setStudentForm({ ...studentForm, phone: t })} keyboardType="phone-pad" placeholder="+91 98765 43210" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Parent / Guardian Name</Text>
              <PaperInput mode="outlined" value={studentForm.guardian} onChangeText={(t) => setStudentForm({ ...studentForm, guardian: t })} placeholder="Optional" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Enrollment Date (YYYY-MM-DD)</Text>
              <QuickDateRow currentDate={studentForm.joinedDate} onSelectDate={(d) => setStudentForm({ ...studentForm, joinedDate: d })} onOpenCalendar={openCalendarPicker} />
              <PaperInput mode="outlined" value={studentForm.joinedDate} onChangeText={(t) => setStudentForm({ ...studentForm, joinedDate: t })} right={<PaperInput.Icon icon="calendar" onPress={() => openCalendarPicker(studentForm.joinedDate, (d) => setStudentForm({ ...studentForm, joinedDate: d }))} />} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => { Keyboard.dismiss(); setStudentModal(false); }}>Cancel</PaperButton>
              <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveStudent}>Save Student</PaperButton>
            </View>
          </Surface>
          {renderCalendarOverlay()}
        </KeyboardAvoidingView>
      </Modal>

      {/* EDIT LESSON MODAL */}
      <Modal visible={lessonEditModal} transparent animationType="fade" onRequestClose={() => setLessonEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>EDIT LESSON RECORD</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <QuickDateRow currentDate={lessonEditForm.date} onSelectDate={(d) => setLessonEditForm({ ...lessonEditForm, date: d })} onOpenCalendar={openCalendarPicker} />
              <PaperInput mode="outlined" value={lessonEditForm.date} onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, date: t })} right={<PaperInput.Icon icon="calendar" onPress={() => openCalendarPicker(lessonEditForm.date, (d) => setLessonEditForm({ ...lessonEditForm, date: d }))} />} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Technique</Text>
              <PaperInput mode="outlined" value={lessonEditForm.technique} onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, technique: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Lesson</Text>
              <PaperInput mode="outlined" value={lessonEditForm.lesson} onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, lesson: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Repertoire</Text>
              <PaperInput mode="outlined" value={lessonEditForm.repertoire} onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, repertoire: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Assignment</Text>
              <PaperInput mode="outlined" value={lessonEditForm.assignment} onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, assignment: t })} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => { Keyboard.dismiss(); setLessonEditModal(false); }}>Cancel</PaperButton>
              <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveEditedLesson}>Update</PaperButton>
            </View>
          </Surface>
          {renderCalendarOverlay()}
        </KeyboardAvoidingView>
      </Modal>

      {/* MARK / EDIT ATTENDANCE MODAL */}
      <Modal visible={attendanceModal} transparent animationType="fade" onRequestClose={() => setAttendanceModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>{attendanceModalForm.id ? 'EDIT ATTENDANCE' : 'MARK GLOBAL ATTENDANCE'}</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Select Student *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {activeStudents.map((st) => (
                    <TouchableOpacity key={st.id} style={[styles.choiceChip, attendanceModalForm.studentId === st.id && styles.choiceChipSelected]} onPress={() => { Keyboard.dismiss(); setAttendanceModalForm({ ...attendanceModalForm, studentId: st.id }); }}>
                      <Text style={[styles.choiceChipText, attendanceModalForm.studentId === st.id && styles.choiceChipTextSelected]}>{st.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <QuickDateRow currentDate={attendanceModalForm.date} onSelectDate={(d) => setAttendanceModalForm({ ...attendanceModalForm, date: d })} onOpenCalendar={openCalendarPicker} />
              <PaperInput mode="outlined" value={attendanceModalForm.date} onChangeText={(t) => setAttendanceModalForm({ ...attendanceModalForm, date: t })} right={<PaperInput.Icon icon="calendar" onPress={() => openCalendarPicker(attendanceModalForm.date, (d) => setAttendanceModalForm({ ...attendanceModalForm, date: d }))} />} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Attendance Status</Text>
              <View style={styles.chipRow}>
                {ATTENDANCE_STATUSES.map((st) => (
                  <TouchableOpacity key={st} style={[styles.choiceChip, attendanceModalForm.status === st && styles.choiceChipSelected]} onPress={() => { Keyboard.dismiss(); setAttendanceModalForm({ ...attendanceModalForm, status: st }); }}>
                    <Text style={[styles.choiceChipText, attendanceModalForm.status === st && styles.choiceChipTextSelected]}>{st}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Remarks</Text>
              <PaperInput mode="outlined" value={attendanceModalForm.remarks} onChangeText={(t) => setAttendanceModalForm({ ...attendanceModalForm, remarks: t })} placeholder="Optional remarks" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => { Keyboard.dismiss(); setAttendanceModal(false); }}>Cancel</PaperButton>
              <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={handleSaveModalAttendance}>Save</PaperButton>
            </View>
          </Surface>
          {renderCalendarOverlay()}
        </KeyboardAvoidingView>
      </Modal>

      {/* RECORD / EDIT FEE MODAL */}
      <Modal visible={feeModal} transparent animationType="fade" onRequestClose={() => setFeeModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>{feeForm.id ? 'EDIT FEE TRANSACTION' : 'RECORD FEE'}</Text>
            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              <Text style={styles.inputLabel}>Select Student *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 8 }} keyboardShouldPersistTaps="handled">
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {activeStudents.map((st) => (
                    <TouchableOpacity key={st.id} style={[styles.choiceChip, feeForm.studentId === st.id && styles.choiceChipSelected]} onPress={() => { Keyboard.dismiss(); setFeeForm({ ...feeForm, studentId: st.id }); }}>
                      <Text style={[styles.choiceChipText, feeForm.studentId === st.id && styles.choiceChipTextSelected]}>{st.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <Text style={styles.inputLabel}>Fee Type</Text>
              <View style={styles.chipRow}>
                {FEE_TYPES.map((ft) => (
                  <TouchableOpacity key={ft} style={[styles.choiceChip, feeForm.feeType === ft && styles.choiceChipSelected]} onPress={() => { Keyboard.dismiss(); setFeeForm({ ...feeForm, feeType: ft }); }}>
                    <Text style={[styles.choiceChipText, feeForm.feeType === ft && styles.choiceChipTextSelected]}>{ft}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {feeForm.feeType === 'Monthly Fee' && (
                <><Text style={styles.inputLabel}>Month Paid For * (Required for Monthly Fee)</Text>
                <PaperInput mode="outlined" value={feeForm.monthPaidFor} onChangeText={(t) => setFeeForm({ ...feeForm, monthPaidFor: t })} placeholder="e.g., October 2026" outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} /></>
              )}
              <Text style={styles.inputLabel}>Date (YYYY-MM-DD)</Text>
              <QuickDateRow currentDate={feeForm.date} onSelectDate={(d) => setFeeForm({ ...feeForm, date: d })} onOpenCalendar={openCalendarPicker} />
              <PaperInput mode="outlined" value={feeForm.date} onChangeText={(t) => setFeeForm({ ...feeForm, date: t })} right={<PaperInput.Icon icon="calendar" onPress={() => openCalendarPicker(feeForm.date, (d) => setFeeForm({ ...feeForm, date: d }))} />} outlineColor={COLORS.border} activeOutlineColor={COLORS.navy} style={{ backgroundColor: COLORS.white, marginBottom: 8 }} />
              <Text style={styles.inputLabel}>Payment Mode</Text>
              <View style={styles.chipRow}>
                {PAYMENT_MODES.map((m) => (
                  <TouchableOpacity key={m} style={[styles.choiceChip, feeForm.mode === m && styles.choiceChipSelected]} onPress={() => { Keyboard.dismiss(); setFeeForm({ ...feeForm, mode: m }); }}>
                    <Text style={[styles.choiceChipText, feeForm.mode === m && styles.choiceChipTextSelected]}>{m}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Fee Status</Text>
              <View style={styles.chipRow}>
                {FEE_STATUSES.map((st) => (
                  <TouchableOpacity key={st} style={[styles.choiceChip, feeForm.status === st && styles.choiceChipSelected]} onPress={() => {
                    Keyboard.dismiss();
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
              <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => { Keyboard.dismiss(); setFeeModal(false); }}>Cancel</PaperButton>
              <PaperButton mode="contained" buttonColor={COLORS.navy} textColor={COLORS.gold} onPress={() => handleSaveFee(false)}>Save</PaperButton>
              <PaperButton mode="contained" buttonColor={COLORS.gold} textColor={COLORS.navy} onPress={() => handleSaveFee(true)}>Save & Share</PaperButton>
            </View>
          </Surface>
          {renderCalendarOverlay()}
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

export default function App() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <PaperProvider theme={jsmTheme}>
          <ErrorBoundary>
            <JSMAppContent />
          </ErrorBoundary>
        </PaperProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: COLORS.ivory },
  errorBoundaryContainer: { flex: 1, backgroundColor: COLORS.navy, justifyContent: 'center', alignItems: 'center', padding: 24 },
  errorBoundaryTitle: { color: COLORS.gold, fontSize: 20, fontWeight: '800', marginTop: 12 },
  errorBoundarySub: { color: COLORS.cream, fontSize: 13, textAlign: 'center', marginVertical: 12 },
  errorBoundaryBtn: { backgroundColor: COLORS.gold, paddingHorizontal: 20, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  errorBoundaryBtnText: { color: COLORS.navy, fontSize: 14, fontWeight: '800' },
  leftEdgeSwipeZone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, zIndex: 50 },
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
  activityItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderBottomWidth: 1, borderBottomColor: '#F0ECE1', gap: 10, borderRadius: 6 },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  activityTitle: { color: COLORS.navy, fontSize: 14, fontWeight: '600' },
  activitySub: { color: COLORS.silver, fontSize: 12 },
  dangerOutlineBtnSmall: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.dangerBg, borderColor: COLORS.danger, borderWidth: 1, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  dangerOutlineBtnSmallText: { color: COLORS.danger, fontSize: 11, fontWeight: '700' },
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
  draggingSubjectCard: { backgroundColor: COLORS.cream, borderColor: COLORS.gold, borderWidth: 1.5 },
  dragHandleBtn: { paddingVertical: 10, paddingHorizontal: 8, marginRight: 2, justifyContent: 'center', alignItems: 'center', borderRadius: 6, backgroundColor: COLORS.ivory },
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
  quickDateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  quickDateChip: { backgroundColor: COLORS.cream, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: '#D8D2C5' },
  quickDateChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.gold },
  quickDateChipText: { fontSize: 11, fontWeight: '600', color: COLORS.navy },
  quickDateChipTextActive: { color: COLORS.gold },
  quickDateChipCalendar: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: COLORS.navy, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 6, borderWidth: 1, borderColor: COLORS.gold },
  quickDateChipCalendarText: { fontSize: 11, fontWeight: '700', color: COLORS.gold },
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
  calendarPortalOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(12, 45, 87, 0.65)', justifyContent: 'center', padding: 18, zIndex: 9999, elevation: 20 },
  modalCard: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 2, borderColor: COLORS.gold },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  contextSheet: { backgroundColor: COLORS.white, borderRadius: 16, padding: 20, borderWidth: 2, borderColor: COLORS.gold, alignItems: 'center', width: '100%' },
  contextSheetHeader: { color: COLORS.navy, fontSize: 15, fontWeight: '800', textAlign: 'center' },
  contextDivider: { height: 1, backgroundColor: COLORS.cream, width: '100%', marginVertical: 12 },
  contextOptionBtn: { width: '100%', paddingVertical: 12, alignItems: 'center', borderBottomWidth: 1, borderBottomColor: '#F2EFE9' },
  contextOptionText: { color: COLORS.navy, fontSize: 15, fontWeight: '700' },
  calendarHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  calendarMonthTitle: { color: COLORS.navy, fontSize: 16, fontWeight: '800' },
  calendarWeekRow: { flexDirection: 'row', justifyContent: 'space-around', marginBottom: 6, borderBottomWidth: 1, borderBottomColor: COLORS.border, paddingBottom: 6 },
  calendarWeekText: { width: '14.28%', textAlign: 'center', color: COLORS.silver, fontSize: 12, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calendarDayToday: { borderWidth: 1, borderColor: COLORS.gold, backgroundColor: COLORS.cream },
  calendarDaySelected: { backgroundColor: COLORS.navy },
  calendarDayText: { color: COLORS.charcoal, fontSize: 14, fontWeight: '600' },
  calendarDayTextToday: { color: COLORS.navy, fontWeight: '800' },
  calendarDayTextSelected: { color: COLORS.gold, fontWeight: '800' },
});
