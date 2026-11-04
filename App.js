import React, { Component, useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Modal,
  Alert,
  Animated,
  Easing,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar,
  Switch,
  ActivityIndicator,
  KeyboardAvoidingView,
  Linking,
  Keyboard,
  Vibration,
  BackHandler,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  setDoc,
  onSnapshot,
  writeBatch,
} from 'firebase/firestore';
import {
  Provider as PaperProvider,
  Appbar,
  TextInput as PaperInput,
  Button as PaperButton,
  Surface,
  MD3LightTheme,
} from 'react-native-paper';
import { PanGestureHandler, GestureHandlerRootView, State } from 'react-native-gesture-handler';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const triggerLayoutAnimation = () => {
  try {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
  } catch (e) {}
};

const triggerHaptic = (ms = 12) => {
  try {
    Vibration.vibrate(ms);
  } catch (e) {}
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
  appId: "1:78588387738:web:f07509bb2e37a751b0da23",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

// ==========================================
// 2. THEME, TYPOGRAPHY & PALETTE
// ==========================================
const SERIF_FONT = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });

const COLORS = {
  midnight: '#071B36',
  navyDark: '#092244',
  navy: '#0C2D57',
  navyLight: '#163E73',
  gold: '#D4B978',
  goldLight: 'rgba(212, 185, 120, 0.18)',
  cream: '#EFE7D3',
  inputTint: '#F3EFE6',
  silver: '#8E9399',
  ivory: '#FAF8F5',
  white: '#FFFFFF',
  danger: '#9E2A2B',
  dangerBg: '#FDE8E8',
  success: '#2D6A4F',
  successBg: '#E6F4EA',
  liveGreen: '#22C55E',
  offlineRed: '#EF4444',
  syncAmber: '#F59E0B',
  warning: '#B45309',
  warningBg: '#FEF3C7',
  charcoal: '#1D242B',
  border: '#E6E1D6',
};

const jsmTheme = {
  ...MD3LightTheme,
  colors: {
    ...MD3LightTheme.colors,
    primary: COLORS.navy,
    secondary: COLORS.gold,
    background: COLORS.ivory,
    surface: COLORS.white,
    error: COLORS.danger,
    elevation: { level1: COLORS.white, level2: COLORS.cream },
  },
};

const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
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

const sanitizeDocRecord = (id, raw = {}, hasPendingWrites = false) => {
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
    lesson: safeString(data.lesson),
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
    _pendingSync: Boolean(hasPendingWrites),
  };
};

const withWriteTimeout = (promise, ms = 2500) => {
  let timerId;
  const timeoutPromise = new Promise((resolve) => {
    timerId = setTimeout(() => resolve({ timedOutOffline: true }), ms);
  });
  return Promise.race([
    promise
      .then((res) => {
        clearTimeout(timerId);
        return res;
      })
      .catch((err) => {
        clearTimeout(timerId);
        throw err;
      }),
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
  if (!safeStr) return '—';
  const normalized = normalizeISODate(safeStr) || safeStr;
  const parts = normalized.split('-');
  if (parts.length !== 3) return safeStr;
  const [year, monthIndex, day] = [parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10)];
  return isNaN(year) || isNaN(monthIndex) || isNaN(day) || !MONTHS_SHORT[monthIndex]
    ? safeStr
    : `${day} ${MONTHS_SHORT[monthIndex]} ${year}`;
};

const getMonthYearFromISO = (isoDateStr) => {
  const safeStr = safeString(isoDateStr).trim();
  if (!safeStr) return 'Unknown Month';
  const normalized = normalizeISODate(safeStr) || safeStr;
  const parts = normalized.split('-');
  if (parts.length < 2) return 'Unknown Month';
  const year = parseInt(parts[0], 10);
  const monthIdx = parseInt(parts[1], 10) - 1;
  return isNaN(year) || isNaN(monthIdx) || monthIdx < 0 || monthIdx > 11
    ? 'Unknown Month'
    : `${MONTHS_FULL[monthIdx]} ${year}`;
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
  const diff = now.getFullYear() * 12 + now.getMonth() - (year * 12 + monthIdx);
  return diff >= -1 && diff <= 1;
};

const getDaysRemainingInTrash = (deletedAtMs) => {
  if (!deletedAtMs) return 30;
  return Math.max(0, 30 - Math.floor((Date.now() - safeNumber(deletedAtMs, Date.now())) / (1000 * 60 * 60 * 24)));
};

const escapeHtml = (unsafe) =>
  safeString(unsafe)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

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
    entries
      .slice(i, i + CHUNK_SIZE)
      .forEach((entry) => batch.update(doc(db, entry.col, entry.id), { isDeleted: true, deletedAt: now }));
    await withWriteTimeout(batch.commit());
  }
};

// ==========================================
// 4. REUSABLE AESTHETIC & MICRO-INTERACTION COMPONENTS
// ==========================================
// Band-free, zero-stripe rich surface (eliminates Android sub-pixel flex slicing lines)
const SmoothNavyGradient = ({ style }) => (
  <View
    style={[
      StyleSheet.absoluteFill,
      { backgroundColor: COLORS.navy, overflow: 'hidden' },
      style,
    ]}
    pointerEvents="none"
  />
);

// Subtle tactile scale-down micro-interaction wrapper (scale: 0.96)
const ScalePressable = ({ children, onPress, onLongPress, delayLongPress = 280, style, disabled = false }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
      speed: 40,
      bounciness: 4,
    }).start();
  }, [scaleAnim]);

  const handlePressOut = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
      speed: 35,
      bounciness: 5,
    }).start();
  }, [scaleAnim]);

  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      onLongPress={onLongPress}
      delayLongPress={delayLongPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </Pressable>
  );
};

const EmptyStateWatermark = ({ message, compact = false, actionLabel, onAction }) => (
  <View style={[styles.emptyWatermarkContainer, compact && { paddingVertical: 14 }]}>
    <MaterialCommunityIcons
      name="music-clef-treble"
      size={compact ? 44 : 72}
      color="rgba(12, 45, 87, 0.055)"
      style={styles.watermarkIcon}
    />
    <Text style={styles.emptyText}>{message}</Text>
    {actionLabel && onAction ? (
      <TouchableOpacity
        style={styles.emptyStateActionBtn}
        onPress={() => {
          triggerHaptic(10);
          onAction();
        }}
      >
        <Text style={styles.emptyStateActionText}>{actionLabel}</Text>
      </TouchableOpacity>
    ) : null}
  </View>
);

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
        outputRange: [-38, 0, 38],
        extrapolate: 'clamp',
      }),
    [dragX]
  );

  const dragOpacity = useMemo(
    () =>
      dragX.interpolate({
        inputRange: [-220, 0, 220],
        outputRange: [0.74, 1, 0.74],
        extrapolate: 'clamp',
      }),
    [dragX]
  );

  useEffect(() => {
    dragX.stopAnimation(() => dragX.setValue(0));
    fadeAnim.setValue(0);
    slideAnim.setValue(direction * 28);

    const anim = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 240,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 240,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]);
    anim.start();
    return () => anim.stop();
  }, [triggerKey, direction, fadeAnim, slideAnim, dragX]);

  const handleGestureStateChange = useCallback(
    (e) => {
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
            duration: 180,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
          }).start();
        }
      }
    },
    [dragX]
  );

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
      <TouchableOpacity
        style={[styles.quickDateChip, currentDate === today && styles.quickDateChipActive]}
        onPress={() => {
          triggerHaptic(8);
          onSelectDate(today);
        }}
      >
        <Text style={[styles.quickDateChipText, currentDate === today && styles.quickDateChipTextActive]}>
          Today
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.quickDateChip, currentDate === yesterday && styles.quickDateChipActive]}
        onPress={() => {
          triggerHaptic(8);
          onSelectDate(yesterday);
        }}
      >
        <Text style={[styles.quickDateChipText, currentDate === yesterday && styles.quickDateChipTextActive]}>
          Yesterday
        </Text>
      </TouchableOpacity>
      {onOpenCalendar ? (
        <TouchableOpacity
          style={styles.quickDateChipCalendar}
          onPress={() => {
            Keyboard.dismiss();
            triggerHaptic(8);
            onOpenCalendar(currentDate, onSelectDate);
          }}
        >
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
  const liveDotPulseAnim = useRef(new Animated.Value(1)).current;
  const savingLockRef = useRef(false);
  const isMountedRef = useRef(true);
  const pendingTimeoutsRef = useRef([]);

  // Network & Offline Sync States
  const [isNetworkOnline, setIsNetworkOnline] = useState(true);
  const [pendingSyncByCol, setPendingSyncByCol] = useState({});

  // Master List / Report Generator Modal States
  const [masterListModal, setMasterListModal] = useState(false);
  const [masterStudentFilter, setMasterStudentFilter] = useState('ALL');
  const [masterMonthFilter, setMasterMonthFilter] = useState('ALL');
  const [masterDateFilter, setMasterDateFilter] = useState('');

  // Floating Search Toggle in Student Directory
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('All');

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

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(liveDotPulseAnim, { toValue: 0.35, duration: 900, useNativeDriver: true }),
        Animated.timing(liveDotPulseAnim, { toValue: 1, duration: 900, useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [liveDotPulseAnim]);

  useEffect(() => {
    let active = true;
    const verifyConnection = async () => {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        if (active && isMountedRef.current) setIsNetworkOnline(true);
      } catch (e) {
        if (active && isMountedRef.current) setIsNetworkOnline(false);
      }
    };
    verifyConnection();
    const intervalId = setInterval(verifyConnection, 7000);
    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, []);

  const openDrawer = useCallback(() => {
    Keyboard.dismiss();
    triggerHaptic(10);
    setDrawerOpen(true);
    drawerSlideAnim.setValue(-290);
    drawerBackdropAnim.setValue(0);
    Animated.parallel([
      Animated.timing(drawerSlideAnim, {
        toValue: 0,
        duration: 250,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(drawerBackdropAnim, {
        toValue: 1,
        duration: 250,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
    ]).start();
  }, [drawerSlideAnim, drawerBackdropAnim]);

  const closeDrawer = useCallback(
    (callback) => {
      Animated.parallel([
        Animated.timing(drawerSlideAnim, {
          toValue: -290,
          duration: 200,
          easing: Easing.in(Easing.cubic),
          useNativeDriver: true,
        }),
        Animated.timing(drawerBackdropAnim, {
          toValue: 0,
          duration: 200,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
      ]).start(() => {
        if (!isMountedRef.current) return;
        setDrawerOpen(false);
        if (typeof callback === 'function') callback();
      });
    },
    [drawerSlideAnim, drawerBackdropAnim]
  );

  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [lessons, setLessons] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [fees, setFees] = useState([]);
  const [activities, setActivities] = useState([]);
  const [noticeText, setNoticeText] = useState('');
  const [noticeUpdatedAt, setNoticeUpdatedAt] = useState('');

  const [contextMenu, setContextMenu] = useState({
    visible: false,
    entityType: null,
    item: null,
    title: '',
    reopenSubjectsModal: false,
    reopenTodayLogModal: false,
  });
  const [noticeEditModal, setNoticeEditModal] = useState(false);
  const [noticeInput, setNoticeInput] = useState('');
  const [todayLogModal, setTodayLogModal] = useState(false);
  const [activityFilterTodayOnly, setActivityFilterTodayOnly] = useState(false);
  const [subjectsModal, setSubjectsModal] = useState(false);
  const [subjectForm, setSubjectForm] = useState({ id: null, name: '' });
  const [studentModal, setStudentModal] = useState(false);
  const [studentForm, setStudentForm] = useState({
    id: null,
    name: '',
    subjectId: '',
    phone: '',
    guardian: '',
    joinedDate: getTodayISO(),
  });
  const [inlineLessonForm, setInlineLessonForm] = useState({
    date: getTodayISO(),
    technique: '',
    lesson: '',
    repertoire: '',
    assignment: '',
  });
  const [lessonEditModal, setLessonEditModal] = useState(false);
  const [lessonEditForm, setLessonEditForm] = useState({
    id: null,
    studentId: '',
    date: getTodayISO(),
    technique: '',
    lesson: '',
    repertoire: '',
    assignment: '',
  });
  const [inlineAttendanceForm, setInlineAttendanceForm] = useState({
    date: getTodayISO(),
    status: 'Present',
    remarks: '',
  });
  const [attendanceModal, setAttendanceModal] = useState(false);
  const [attendanceFilterAllMonths, setAttendanceFilterAllMonths] = useState(false);
  const [attendanceModalForm, setAttendanceModalForm] = useState({
    id: null,
    studentId: '',
    date: getTodayISO(),
    status: 'Present',
    remarks: '',
  });
  const [feeModal, setFeeModal] = useState(false);
  const [feeForm, setFeeForm] = useState({
    id: null,
    studentId: '',
    feeType: 'Monthly Fee',
    monthPaidFor: getLocalCurrentMonthLabel(),
    date: getTodayISO(),
    mode: 'UPI',
    status: 'Paid',
    amountPaid: '',
    balanceDue: '0',
    remarks: '',
  });
  const [noteDraft, setNoteDraft] = useState('');
  const [priorityDraft, setPriorityDraft] = useState(false);
  const [checkingOTA, setCheckingOTA] = useState(false);
  const [calendarPicker, setCalendarPicker] = useState({
    visible: false,
    selectedDate: getTodayISO(),
    viewYear: new Date().getFullYear(),
    viewMonth: new Date().getMonth(),
    onSelect: null,
  });
  const initialLoadDone = useRef(false);

  // Drag-and-drop state and refs for Subject 6-dot handle reordering
  const [orderedSubjects, setOrderedSubjects] = useState([]);
  const [draggingSubjectId, setDraggingSubjectId] = useState(null);
  const [subjectScrollLocked, setSubjectScrollLocked] = useState(false);
  const dragSubjectY = useRef(new Animated.Value(0)).current;
  const dragInfoRef = useRef({ active: false, subjectId: null, startIdx: 0, currentIdx: 0, list: [] });

  const activeTabRef = useRef(activeTab);
  const profileTabRef = useRef(profileTab);
  const orderedSubjectsRef = useRef(orderedSubjects);
  const activeSubjectsRef = useRef([]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  useEffect(() => {
    profileTabRef.current = profileTab;
  }, [profileTab]);
  useEffect(() => {
    orderedSubjectsRef.current = orderedSubjects;
  }, [orderedSubjects]);

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
      if (masterListModal) {
        setMasterListModal(false);
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
  }, [activeTab, selectedStudentId, calendarPicker.visible, masterListModal, drawerOpen, closeDrawer]);

  // Real-Time Firestore Listeners with Metadata Tracking for Offline Caching
  useEffect(() => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;
    const timer = setTimeout(() => {
      initialLoadDone.current = true;
    }, 1000);

    const handleSnapshotWithAutoPurge = (colName, snapshot, setter) => {
      if (!isMountedRef.current) return;
      const records = [];
      const hasPending = Boolean(snapshot.metadata?.hasPendingWrites);
      setPendingSyncByCol((prev) =>
        prev[colName] === hasPending ? prev : { ...prev, [colName]: hasPending }
      );

      snapshot.forEach((docSnap) => {
        const clean = sanitizeDocRecord(docSnap.id, docSnap.data(), docSnap.metadata?.hasPendingWrites);
        if (clean.isDeleted && clean.deletedAt && Date.now() - clean.deletedAt > THIRTY_DAYS_MS) {
          deleteDoc(doc(db, colName, clean.id)).catch(() => {});
        } else {
          records.push(clean);
        }
      });
      if (initialLoadDone.current) triggerLayoutAnimation();
      setter(records);
    };

    const unsubSubjects = onSnapshot(
      collection(db, 'subjects'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshotWithAutoPurge('subjects', snap, setSubjects),
      () => {}
    );
    const unsubStudents = onSnapshot(
      collection(db, 'students'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshotWithAutoPurge('students', snap, setStudents),
      () => {}
    );
    const unsubLessons = onSnapshot(
      collection(db, 'lessons'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshotWithAutoPurge('lessons', snap, setLessons),
      () => {}
    );
    const unsubAttendance = onSnapshot(
      collection(db, 'attendance'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshotWithAutoPurge('attendance', snap, setAttendance),
      () => {}
    );
    const unsubFees = onSnapshot(
      collection(db, 'fees'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshotWithAutoPurge('fees', snap, setFees),
      () => {}
    );
    const unsubActivities = onSnapshot(
      collection(db, 'activities'),
      { includeMetadataChanges: true },
      (snap) => {
        if (!isMountedRef.current) return;
        const list = [];
        snap.forEach((d) => {
          const clean = sanitizeDocRecord(d.id, d.data(), d.metadata?.hasPendingWrites);
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
      },
      () => {}
    );
    const unsubNotice = onSnapshot(
      doc(db, 'settings', 'noticeBoard'),
      { includeMetadataChanges: true },
      (docSnap) => {
        if (!isMountedRef.current) return;
        if (docSnap.exists()) {
          const d = docSnap.data() || {};
          setNoticeText(safeString(d.text));
          setNoticeUpdatedAt(safeString(d.updatedDate));
        }
      },
      () => {}
    );

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

  const hasAnyPendingWrites = useMemo(
    () => Object.values(pendingSyncByCol).some(Boolean),
    [pendingSyncByCol]
  );

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

  const activeSubjects = useMemo(
    () => subjects.filter((s) => !s.isDeleted).sort((a, b) => (a.order ?? 999) - (b.order ?? 999)),
    [subjects]
  );
  const subjectMap = useMemo(() => Object.fromEntries(subjects.map((s) => [s.id, s])), [subjects]);
  const activeStudents = useMemo(
    () => students.filter((st) => !st.isDeleted).sort((a, b) => safeString(a.name).localeCompare(safeString(b.name))),
    [students]
  );
  const studentMap = useMemo(() => Object.fromEntries(students.map((s) => [s.id, s])), [students]);
  const activeLessons = useMemo(
    () =>
      lessons
        .filter((l) => !l.isDeleted && studentMap[l.studentId] && !studentMap[l.studentId].isDeleted)
        .sort((a, b) => safeString(b.date).localeCompare(safeString(a.date))),
    [lessons, studentMap]
  );
  const activeAttendance = useMemo(
    () =>
      attendance
        .filter((a) => !a.isDeleted && studentMap[a.studentId] && !studentMap[a.studentId].isDeleted)
        .sort((a, b) => safeString(b.date).localeCompare(safeString(a.date))),
    [attendance, studentMap]
  );
  const activeFees = useMemo(
    () =>
      fees
        .filter((f) => !f.isDeleted && studentMap[f.studentId] && !studentMap[f.studentId].isDeleted)
        .sort((a, b) => safeString(b.date).localeCompare(safeString(a.date))),
    [fees, studentMap]
  );
  const activeActivities = useMemo(() => activities.filter((a) => !a.isDeleted), [activities]);

  useEffect(() => {
    activeSubjectsRef.current = activeSubjects;
    if (!dragInfoRef.current.active) {
      setOrderedSubjects(activeSubjects);
    }
  }, [activeSubjects]);

  const globalFeeTotals = useMemo(() => {
    let collected = 0,
      pending = 0;
    activeFees.forEach((f) => {
      collected += safeNumber(f.amountPaid, 0);
      pending += safeNumber(f.balanceDue, 0);
    });
    return { collected, pending };
  }, [activeFees]);

  // Distinct available months across all records for the Master List Filter
  const availableMasterMonths = useMemo(() => {
    const monthSet = new Set([getLocalCurrentMonthLabel()]);
    activeLessons.forEach((l) => {
      if (l.date) monthSet.add(getMonthYearFromISO(l.date));
    });
    activeAttendance.forEach((a) => {
      if (a.date) monthSet.add(getMonthYearFromISO(a.date));
    });
    activeFees.forEach((f) => {
      if (f.date) monthSet.add(getMonthYearFromISO(f.date));
    });
    return Array.from(monthSet).filter((m) => m && m !== 'Unknown Month');
  }, [activeLessons, activeAttendance, activeFees]);

  const trashItems = useMemo(
    () =>
      [
        ...subjects.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'subjects', _label: `Subject: ${safeString(x.name, 'Unnamed')}` })),
        ...students.filter((x) => x.isDeleted).map((x) => ({ ...x, _col: 'students', _label: `Student: ${safeString(x.name, 'Unnamed')}` })),
        ...lessons
          .filter((x) => x.isDeleted)
          .map((x) => ({ ...x, _col: 'lessons', _label: `Lesson: ${safeString(studentMap[x.studentId]?.name, 'Student')} (${formatReadableLocalDate(x.date)})` })),
        ...attendance
          .filter((x) => x.isDeleted)
          .map((x) => ({
            ...x,
            _col: 'attendance',
            _label: `Attendance: ${safeString(studentMap[x.studentId]?.name, 'Student')} - ${safeString(x.status)} (${formatReadableLocalDate(x.date)})`,
          })),
        ...fees
          .filter((x) => x.isDeleted)
          .map((x) => ({
            ...x,
            _col: 'fees',
            _label: `Fee: ${safeString(studentMap[x.studentId]?.name, 'Student')} - ₹${safeNumber(x.amountPaid, 0)} (${formatReadableLocalDate(x.date)})`,
          })),
        ...activities
          .filter((x) => x.isDeleted)
          .map((x) => ({ ...x, _col: 'activities', _label: `Activity: ${safeString(x.title)}${x.subtitle ? ` (${x.subtitle})` : ''}` })),
      ].sort((a, b) => safeNumber(b.deletedAt, 0) - safeNumber(a.deletedAt, 0)),
    [subjects, students, lessons, attendance, fees, activities, studentMap]
  );

  const selectedStudent = useMemo(
    () => activeStudents.find((s) => s.id === selectedStudentId) || null,
    [activeStudents, selectedStudentId]
  );

  useEffect(() => {
    if (selectedStudent) {
      setNoteDraft(safeString(selectedStudent.notes));
      setPriorityDraft(Boolean(selectedStudent.priorityNote));
    }
  }, [selectedStudentId, selectedStudent?.notes, selectedStudent?.priorityNote]);

  useEffect(() => {
    setInlineLessonForm({ date: getTodayISO(), technique: '', lesson: '', repertoire: '', assignment: '' });
    setInlineAttendanceForm({ date: getTodayISO(), status: 'Present', remarks: '' });
  }, [selectedStudentId]);

  const getStudentMetrics = useCallback(
    (studentId) => {
      const stLessons = activeLessons.filter((l) => l.studentId === studentId);
      const stAttendance = activeAttendance.filter((a) => a.studentId === studentId);
      const stFees = activeFees.filter((f) => f.studentId === studentId);
      let attendancePct = 'N/A';
      const gradedAttendance = stAttendance.filter((a) => a.status !== 'Rescheduled');
      if (gradedAttendance.length > 0) {
        attendancePct = `${Math.round(
          (gradedAttendance.filter((a) => a.status === 'Present' || a.status === 'Tardy').length /
            gradedAttendance.length) *
            100
        )}%`;
      }
      let feeStatus = 'No Records',
        totalDue = 0;
      if (stFees.length > 0) {
        stFees.forEach((f) => {
          totalDue += safeNumber(f.balanceDue, 0);
        });
        feeStatus = stFees.some(
          (f) => f.status === 'Unpaid' || f.status === 'Partial' || safeNumber(f.balanceDue, 0) > 0
        )
          ? 'Due / Unpaid'
          : 'Paid';
      }
      return { classesTaken: stLessons.length, attendancePct, feeStatus, totalDue, stLessons, stAttendance, stFees };
    },
    [activeLessons, activeAttendance, activeFees]
  );

  // Filtered Master List data computation
  const masterListData = useMemo(() => {
    const targetStudents =
      masterStudentFilter === 'ALL'
        ? activeStudents
        : activeStudents.filter((s) => s.id === masterStudentFilter);

    const matchesTimeframe = (isoDate) => {
      if (masterDateFilter && isoDate !== masterDateFilter) return false;
      if (masterMonthFilter !== 'ALL' && getMonthYearFromISO(isoDate) !== masterMonthFilter) return false;
      return true;
    };

    return targetStudents.map((st) => {
      const stLessons = activeLessons.filter((l) => l.studentId === st.id && matchesTimeframe(l.date));
      const stAtt = activeAttendance.filter((a) => a.studentId === st.id && matchesTimeframe(a.date));
      const stFees = activeFees.filter((f) => f.studentId === st.id && matchesTimeframe(f.date));
      const totalPaid = stFees.reduce((acc, f) => acc + safeNumber(f.amountPaid, 0), 0);
      const totalDue = stFees.reduce((acc, f) => acc + safeNumber(f.balanceDue, 0), 0);
      const presentCount = stAtt.filter((a) => a.status === 'Present' || a.status === 'Tardy').length;
      const absentCount = stAtt.filter((a) => a.status === 'Absent').length;
      const reschedCount = stAtt.filter((a) => a.status === 'Rescheduled').length;

      return {
        student: st,
        subjectName: safeString(subjectMap[st.subjectId]?.name, 'Unassigned'),
        stLessons,
        stAtt,
        stFees,
        totalPaid,
        totalDue,
        presentCount,
        absentCount,
        reschedCount,
      };
    });
  }, [
    activeStudents,
    activeLessons,
    activeAttendance,
    activeFees,
    masterStudentFilter,
    masterMonthFilter,
    masterDateFilter,
    subjectMap,
  ]);

  const exportMasterListPDF = async () => {
    triggerHaptic(12);
    const periodLabel = masterDateFilter
      ? formatReadableLocalDate(masterDateFilter)
      : masterMonthFilter === 'ALL'
      ? 'All Time'
      : masterMonthFilter;

    const rowsHtml = masterListData
      .map(
        (row) => `
        <tr>
          <td><strong>${escapeHtml(row.student.name)}</strong><br/><span style="color:#666;font-size:11px;">${escapeHtml(row.subjectName)}</span></td>
          <td>${row.stLessons.length} Classes<br/><span style="color:#555;font-size:11px;">${
          row.stLessons[0]
            ? `${escapeHtml(formatReadableLocalDate(row.stLessons[0].date))}: ${escapeHtml(
                [row.stLessons[0].lesson, row.stLessons[0].technique, row.stLessons[0].repertoire]
                  .filter(Boolean)
                  .join(', ') || 'Logged'
              )}`
            : '—'
        }</span></td>
          <td>P: ${row.presentCount} | A: ${row.absentCount} | R: ${row.reschedCount}</td>
          <td>Paid: ₹${row.totalPaid.toFixed(0)}<br/><span style="color:${
          row.totalDue > 0 ? '#9E2A2B' : '#2D6A4F'
        };font-size:11px;">Due: ₹${row.totalDue.toFixed(0)}</span></td>
        </tr>`
      )
      .join('');

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8" />
      <style>
        body { font-family: 'Georgia', serif; padding: 28px; color: #0C2D57; background: #FFFFFF; }
        h1 { margin: 0 0 4px; font-size: 22px; letter-spacing: 1px; }
        .sub { color: #666; font-size: 12px; margin-bottom: 18px; }
        table { width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 13px; }
        th { background: #0C2D57; color: #D4B978; text-align: left; padding: 10px; font-size: 11px; letter-spacing: 1px; }
        td { border-bottom: 1px solid #E6E1D6; padding: 10px; vertical-align: top; }
      </style></head>
      <body>
        <h1>JSM MASTER STUDENT REPORT</h1>
        <div class="sub">Period: ${escapeHtml(periodLabel)} • Generated ${escapeHtml(
      formatReadableLocalDate(getTodayISO())
    )}</div>
        <table>
          <thead>
            <tr>
              <th>STUDENT</th>
              <th>CLASSES</th>
              <th>ATTENDANCE</th>
              <th>FEES</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </body></html>
    `;
    try {
      const { uri } = await Print.printToFileAsync({ html });
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: 'JSM Master Report',
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Created', `Saved to: ${uri}`);
      }
    } catch (e) {
      Alert.alert('Export Error', 'Could not generate the Master List PDF.');
    }
  };

  const handleCheckOTA = async () => {
    try {
      setCheckingOTA(true);
      const update = await Updates.checkForUpdateAsync();
      if (update.isAvailable) {
        await Updates.fetchUpdateAsync();
        Alert.alert('Update Ready', 'Restarting JSM with the latest version.', [
          { text: 'Restart Now', onPress: () => Updates.reloadAsync() },
        ]);
      } else {
        Alert.alert('Up to Date', 'You are running the latest JSM build.');
      }
    } catch (e) {
      Alert.alert('OTA Notice', 'OTA check requires a production/preview Expo Updates build.');
    } finally {
      if (isMountedRef.current) setCheckingOTA(false);
    }
  };

  const handlePhoneCall = (phoneStr) => {
    const cleaned = safeString(phoneStr).replace(/[^\d+]/g, '');
    if (!cleaned) return;
    Linking.openURL(`tel:${cleaned}`).catch(() =>
      Alert.alert('Action Unavailable', 'Could not open phone dialer.')
    );
  };

  const handleOpenWhatsApp = (phoneStr, studentName) => {
    const digits = safeString(phoneStr).replace(/[^\d]/g, '');
    if (!digits) return;
    Linking.openURL(
      `https://wa.me/${digits.length === 10 ? `91${digits}` : digits}?text=${encodeURIComponent(
        `Hello from JSM regarding ${safeString(studentName, 'your music classes')}.`
      )}`
    ).catch(() => Alert.alert('WhatsApp Unavailable', 'Could not open WhatsApp.'));
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
        await Sharing.shareAsync(uri, {
          mimeType: 'application/pdf',
          dialogTitle: `Share Receipt - ${safeString(st?.name, 'Student')}`,
          UTI: 'com.adobe.pdf',
        });
      } else {
        Alert.alert('PDF Created', `Saved to: ${uri}`);
      }
    } catch (err) {
      Alert.alert('Receipt Error', 'Could not generate or share the PDF receipt.');
    }
  };

  const openLongPressMenu = (entityType, item, title, reopenSubjectsModal = false, reopenTodayLogModal = false) => {
    Keyboard.dismiss();
    triggerHaptic(16);
    setContextMenu({
      visible: true,
      entityType,
      item,
      title: safeString(title),
      reopenSubjectsModal,
      reopenTodayLogModal,
    });
  };
  const closeContextMenu = () =>
    setContextMenu({
      visible: false,
      entityType: null,
      item: null,
      title: '',
      reopenSubjectsModal: false,
      reopenTodayLogModal: false,
    });

  const handleSoftDelete = async (collectionName, item, label) => {
    if (!item?.id) return;
    try {
      triggerLayoutAnimation();
      triggerHaptic(15);
      if (collectionName === 'students' && selectedStudentId === item.id) setSelectedStudentId(null);
      if (collectionName === 'subjects' && subjectForm.id === item.id) setSubjectForm({ id: null, name: '' });
      await withWriteTimeout(
        updateDoc(doc(db, collectionName, item.id), { isDeleted: true, deletedAt: Date.now() })
      );
      if (collectionName !== 'activities') {
        await logActivity('Moved to Trash', label);
      }
    } catch (e) {
      Alert.alert('Error', 'Unable to move item to Trash.');
    }
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
            } catch (e) {
              Alert.alert('Error', 'Could not move activities to Trash.');
            }
          },
        },
        {
          text: 'Delete Permanently',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerLayoutAnimation();
              await commitBatchDeletes(targets.map((a) => ({ col: 'activities', id: a.id })));
            } catch (e) {
              Alert.alert('Error', 'Could not permanently delete activities.');
            }
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

  const handleSubjectDragStart = useCallback(
    (subj) => {
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
    },
    [dragSubjectY]
  );

  const handleSubjectDragMove = useCallback(
    (subj, event) => {
      const { translationY } = event.nativeEvent;
      if (!dragInfoRef.current.active) {
        handleSubjectDragStart(subj);
      }
      const { startIdx, currentIdx, list } = dragInfoRef.current;
      if (!list || list.length === 0) return;

      const targetIdx = Math.max(
        0,
        Math.min(list.length - 1, Math.round(startIdx + translationY / SUBJECT_ROW_HEIGHT))
      );
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
    },
    [dragSubjectY, handleSubjectDragStart]
  );

  const handleSubjectDragStateChange = useCallback(
    (subj, event) => {
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
    },
    [dragSubjectY, handleSubjectDragStart]
  );

  const handleContextAction = async (action) => {
    const { entityType, item, title, reopenSubjectsModal, reopenTodayLogModal } = contextMenu;
    closeContextMenu();
    if (!item) return;
    const colMap = {
      subject: 'subjects',
      student: 'students',
      lesson: 'lessons',
      attendance: 'attendance',
      fee: 'fees',
      activity: 'activities',
    };
    if (action === 'delete') {
      await handleSoftDelete(colMap[entityType], item, title);
      if (reopenSubjectsModal) scheduleTimeout(() => setSubjectsModal(true), 220);
      if (reopenTodayLogModal) scheduleTimeout(() => setTodayLogModal(true), 220);
      return;
    }
    if (action === 'edit') {
      scheduleTimeout(() => {
        if (entityType === 'subject') {
          setSubjectForm({ id: item.id, name: safeString(item.name) });
          setSubjectsModal(true);
        } else if (entityType === 'student') {
          const validSubjectId = activeSubjects.some((s) => s.id === item.subjectId)
            ? item.subjectId
            : activeSubjects[0]?.id || '';
          setStudentForm({
            id: item.id,
            name: safeString(item.name),
            subjectId: validSubjectId,
            phone: safeString(item.phone),
            guardian: safeString(item.guardian),
            joinedDate: safeString(item.joinedDate, getTodayISO()),
          });
          setStudentModal(true);
        } else if (entityType === 'lesson') {
          setLessonEditForm({
            id: item.id,
            studentId: item.studentId,
            date: safeString(item.date, getTodayISO()),
            technique: safeString(item.technique),
            lesson: safeString(item.lesson),
            repertoire: safeString(item.repertoire),
            assignment: safeString(item.assignment),
          });
          setLessonEditModal(true);
        } else if (entityType === 'attendance') {
          setAttendanceModalForm({
            id: item.id,
            studentId: item.studentId,
            date: safeString(item.date, getTodayISO()),
            status: safeString(item.status, 'Present'),
            remarks: safeString(item.remarks),
          });
          setAttendanceModal(true);
        } else if (entityType === 'fee') {
          setFeeForm({
            id: item.id,
            studentId: item.studentId,
            feeType: safeString(item.feeType, 'Monthly Fee'),
            monthPaidFor: safeString(item.monthPaidFor, getLocalCurrentMonthLabel()),
            date: safeString(item.date, getTodayISO()),
            mode: safeString(item.mode, 'UPI'),
            status: safeString(item.status, 'Paid'),
            amountPaid: String(safeNumber(item.amountPaid, 0)),
            balanceDue: String(safeNumber(item.balanceDue, 0)),
            remarks: safeString(item.remarks),
          });
          setFeeModal(true);
        }
      }, 220);
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
        await withWriteTimeout(
          addDoc(collection(db, 'subjects'), {
            name: trimmed,
            order: activeSubjects.length,
            isDeleted: false,
            deletedAt: null,
          })
        );
        await logActivity('Added Subject', trimmed);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save subject.');
    } finally {
      savingLockRef.current = false;
    }
  };

  const handleSaveStudent = async () => {
    Keyboard.dismiss();
    if (!safeString(studentForm.name).trim() || !studentForm.subjectId)
      return Alert.alert('Validation', 'Student Name and Subject are required.');
    const validDate = normalizeISODate(studentForm.joinedDate);
    if (!validDate)
      return Alert.alert('Validation', 'Please enter a valid enrollment date in YYYY-MM-DD format.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const payload = {
        name: safeString(studentForm.name).trim(),
        subjectId: studentForm.subjectId,
        phone: safeString(studentForm.phone).trim(),
        guardian: safeString(studentForm.guardian).trim(),
        joinedDate: validDate,
      };
      const editingId = studentForm.id;
      setStudentModal(false);
      setStudentForm({
        id: null,
        name: '',
        subjectId: activeSubjects[0]?.id || '',
        phone: '',
        guardian: '',
        joinedDate: getTodayISO(),
      });
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'students', editingId), payload));
        await logActivity('Updated Student', payload.name);
      } else {
        await withWriteTimeout(
          addDoc(collection(db, 'students'), {
            ...payload,
            notes: '',
            priorityNote: false,
            isDeleted: false,
            deletedAt: null,
          })
        );
        await logActivity('Enrolled Student', `${payload.name} (${safeString(subjectMap[payload.subjectId]?.name)})`);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save student record.');
    } finally {
      savingLockRef.current = false;
    }
  };

  const handleSaveInlineLesson = async () => {
    Keyboard.dismiss();
    if (!selectedStudentId) return;
    const validDate = normalizeISODate(inlineLessonForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    if (
      !safeString(inlineLessonForm.technique).trim() &&
      !safeString(inlineLessonForm.lesson).trim() &&
      !safeString(inlineLessonForm.repertoire).trim() &&
      !safeString(inlineLessonForm.assignment).trim()
    )
      return Alert.alert('Validation', 'Enter at least one lesson detail.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(14);
      const payload = {
        studentId: selectedStudentId,
        date: validDate,
        lesson: safeString(inlineLessonForm.lesson).trim(),
        technique: safeString(inlineLessonForm.technique).trim(),
        repertoire: safeString(inlineLessonForm.repertoire).trim(),
        assignment: safeString(inlineLessonForm.assignment).trim(),
        isDeleted: false,
        deletedAt: null,
      };
      setInlineLessonForm({ date: getTodayISO(), technique: '', lesson: '', repertoire: '', assignment: '' });
      await withWriteTimeout(addDoc(collection(db, 'lessons'), payload));
      await logActivity(
        'Logged Lesson',
        `${safeString(studentMap[selectedStudentId]?.name, 'Student')} (${formatReadableLocalDate(validDate)})`
      );
    } catch (e) {
      Alert.alert('Error', 'Could not log lesson.');
    } finally {
      savingLockRef.current = false;
    }
  };

  const handleSaveEditedLesson = async () => {
    Keyboard.dismiss();
    if (!lessonEditForm.id || !lessonEditForm.studentId) return;
    const validDate = normalizeISODate(lessonEditForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    if (
      !safeString(lessonEditForm.technique).trim() &&
      !safeString(lessonEditForm.lesson).trim() &&
      !safeString(lessonEditForm.repertoire).trim() &&
      !safeString(lessonEditForm.assignment).trim()
    )
      return Alert.alert('Validation', 'Enter at least one lesson detail.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const editingId = lessonEditForm.id;
      const payload = {
        studentId: lessonEditForm.studentId,
        date: validDate,
        lesson: safeString(lessonEditForm.lesson).trim(),
        technique: safeString(lessonEditForm.technique).trim(),
        repertoire: safeString(lessonEditForm.repertoire).trim(),
        assignment: safeString(lessonEditForm.assignment).trim(),
      };
      setLessonEditModal(false);
      await withWriteTimeout(updateDoc(doc(db, 'lessons', editingId), payload));
      await logActivity(
        'Updated Lesson',
        `${safeString(studentMap[payload.studentId]?.name, 'Student')} (${formatReadableLocalDate(validDate)})`
      );
    } catch (e) {
      Alert.alert('Error', 'Could not update lesson.');
    } finally {
      savingLockRef.current = false;
    }
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
      triggerHaptic(14);
      const statusVal = inlineAttendanceForm.status;
      const remarksVal = safeString(inlineAttendanceForm.remarks).trim();
      setInlineAttendanceForm({ date: getTodayISO(), status: 'Present', remarks: '' });
      const existingRecord = activeAttendance.find(
        (a) => a.studentId === selectedStudentId && a.date === validDate
      );
      if (existingRecord) {
        await withWriteTimeout(
          updateDoc(doc(db, 'attendance', existingRecord.id), { status: statusVal, remarks: remarksVal })
        );
        await logActivity(
          'Updated Attendance',
          `${safeString(studentMap[selectedStudentId]?.name, 'Student')} • ${statusVal}`
        );
      } else {
        await withWriteTimeout(
          addDoc(collection(db, 'attendance'), {
            studentId: selectedStudentId,
            date: validDate,
            status: statusVal,
            remarks: remarksVal,
            isDeleted: false,
            deletedAt: null,
          })
        );
        await logActivity(
          'Marked Attendance',
          `${safeString(studentMap[selectedStudentId]?.name, 'Student')} • ${statusVal}`
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save attendance.');
    } finally {
      savingLockRef.current = false;
    }
  };

  const handleSaveModalAttendance = async () => {
    Keyboard.dismiss();
    if (!attendanceModalForm.studentId) return Alert.alert('Validation', 'Please select a Student.');
    const validDate = normalizeISODate(attendanceModalForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    const payload = {
      studentId: attendanceModalForm.studentId,
      date: validDate,
      status: attendanceModalForm.status,
      remarks: safeString(attendanceModalForm.remarks).trim(),
    };
    const duplicateRecord = activeAttendance.find(
      (a) => a.studentId === payload.studentId && a.date === validDate && a.id !== attendanceModalForm.id
    );
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
        await logActivity(
          'Updated Attendance',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ${payload.status}`
        );
      } else if (duplicateRecord) {
        await withWriteTimeout(updateDoc(doc(db, 'attendance', duplicateRecord.id), payload));
        await logActivity(
          'Updated Attendance',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ${payload.status}`
        );
      } else {
        await withWriteTimeout(
          addDoc(collection(db, 'attendance'), { ...payload, isDeleted: false, deletedAt: null })
        );
        await logActivity(
          'Marked Attendance',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ${payload.status}`
        );
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save attendance.');
    } finally {
      savingLockRef.current = false;
    }
  };

  // Frictionless instantaneous note saving (no blocking alert popup)
  const handleSaveStudentNotes = async () => {
    Keyboard.dismiss();
    if (!selectedStudentId || savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(14);
      await withWriteTimeout(
        updateDoc(doc(db, 'students', selectedStudentId), {
          notes: safeString(noteDraft),
          priorityNote: Boolean(priorityDraft),
        })
      );
      await logActivity('Updated Student Notes', safeString(studentMap[selectedStudentId]?.name));
    } catch (e) {
      Alert.alert('Error', 'Could not update student notes.');
    } finally {
      savingLockRef.current = false;
    }
  };

  const handleSaveFee = async (shouldSharePDF = false) => {
    Keyboard.dismiss();
    if (!feeForm.studentId) return Alert.alert('Validation', 'Please select a Student.');
    if (feeForm.feeType === 'Monthly Fee' && !safeString(feeForm.monthPaidFor).trim())
      return Alert.alert('Validation', '"Month Paid For" is required for Monthly Fees.');
    const validDate = normalizeISODate(feeForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    const numericPaid = feeForm.status === 'Unpaid' ? 0 : parseFloat(sanitizeCurrency(feeForm.amountPaid)) || 0;
    const numericBalance = feeForm.status === 'Paid' ? 0 : parseFloat(sanitizeCurrency(feeForm.balanceDue)) || 0;
    if (feeForm.status === 'Unpaid' && numericBalance <= 0)
      return Alert.alert('Validation', 'Unpaid records require a Balance Due greater than ₹0.');
    if (feeForm.status === 'Paid' && numericPaid <= 0)
      return Alert.alert('Validation', 'Paid records require an Amount Paid greater than ₹0.');
    if (feeForm.status === 'Partial' && (numericPaid <= 0 || numericBalance <= 0))
      return Alert.alert('Validation', 'Partial payments require both Amount Paid and Balance Due to be greater than ₹0.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;

    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      const editingId = feeForm.id;
      const payload = {
        studentId: feeForm.studentId,
        feeType: feeForm.feeType,
        monthPaidFor: feeForm.feeType === 'Monthly Fee' ? safeString(feeForm.monthPaidFor).trim() : '',
        date: validDate,
        mode: feeForm.mode,
        status: feeForm.status,
        amountPaid: numericPaid,
        balanceDue: numericBalance,
        remarks: safeString(feeForm.remarks).trim(),
      };
      setFeeModal(false);
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'fees', editingId), payload));
        await logActivity(
          'Updated Fee Record',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ₹${numericPaid}`
        );
      } else {
        await withWriteTimeout(
          addDoc(collection(db, 'fees'), { ...payload, isDeleted: false, deletedAt: null })
        );
        await logActivity(
          'Recorded Fee',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ₹${numericPaid} (${payload.status})`
        );
      }
      if (shouldSharePDF) {
        scheduleTimeout(() => {
          generateAndShareReceiptPDF(payload);
        }, 350);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save fee record.');
    } finally {
      savingLockRef.current = false;
    }
  };

  const handleUpdateNotice = async (overrideText = null) => {
    Keyboard.dismiss();
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerHaptic(12);
      const today = getTodayISO();
      const textVal = overrideText !== null ? safeString(overrideText).trim() : safeString(noticeInput).trim();
      setNoticeEditModal(false);
      await withWriteTimeout(setDoc(doc(db, 'settings', 'noticeBoard'), { text: textVal, updatedDate: today }));
      await logActivity(
        textVal ? 'Updated Notice Board' : 'Cleared Notice Board',
        formatReadableLocalDate(today)
      );
    } catch (e) {
      Alert.alert('Error', 'Could not update notice board.');
    } finally {
      savingLockRef.current = false;
    }
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
    } catch (e) {
      Alert.alert('Error', 'Could not restore item.');
    }
  };

  const handlePermanentDeleteItem = async (item) => {
    if (!item?._col || !item?.id) return;
    try {
      triggerLayoutAnimation();
      triggerHaptic(18);
      const docsToDelete = [{ col: item._col, id: item.id }];
      if (item._col === 'students') {
        lessons.filter((l) => l.studentId === item.id).forEach((l) => docsToDelete.push({ col: 'lessons', id: l.id }));
        attendance
          .filter((a) => a.studentId === item.id)
          .forEach((a) => docsToDelete.push({ col: 'attendance', id: a.id }));
        fees.filter((f) => f.studentId === item.id).forEach((f) => docsToDelete.push({ col: 'fees', id: f.id }));
      }
      await commitBatchDeletes(docsToDelete);
      if (item._col !== 'activities') {
        await logActivity('Permanently Deleted from Firebase', item._label);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not delete item from Firebase.');
    }
  };

  const handleEmptyTrash = () => {
    if (trashItems.length === 0) return;
    triggerHaptic(18);
    Alert.alert(
      'Empty Trash Permanently?',
      `This will permanently erase ${trashItems.length} item(s) and any linked records from Firebase.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Empty Trash',
          style: 'destructive',
          onPress: async () => {
            try {
              triggerLayoutAnimation();
              const deletedStudentIds = new Set(trashItems.filter((i) => i._col === 'students').map((i) => i.id));
              const docsToDelete = new Map();
              trashItems.forEach((item) =>
                docsToDelete.set(`${item._col}/${item.id}`, { col: item._col, id: item.id })
              );
              if (deletedStudentIds.size > 0) {
                lessons
                  .filter((l) => deletedStudentIds.has(l.studentId))
                  .forEach((l) => docsToDelete.set(`lessons/${l.id}`, { col: 'lessons', id: l.id }));
                attendance
                  .filter((a) => deletedStudentIds.has(a.studentId))
                  .forEach((a) => docsToDelete.set(`attendance/${a.id}`, { col: 'attendance', id: a.id }));
                fees
                  .filter((f) => deletedStudentIds.has(f.studentId))
                  .forEach((f) => docsToDelete.set(`fees/${f.id}`, { col: 'fees', id: f.id }));
              }
              await commitBatchDeletes(Array.from(docsToDelete.values()));
            } catch (e) {
              Alert.alert('Error', 'Failed to empty trash from Firebase.');
            }
          },
        },
      ]
    );
  };

  const groupRecordsBySubjectAndMonth = useCallback(
    (records) => {
      const grouped = [];
      const activeSubjectIds = new Set(activeSubjects.map((s) => s.id));
      activeSubjects.forEach((subj) => {
        const subjectRecords = records.filter((r) => studentMap[r.studentId]?.subjectId === subj.id);
        if (subjectRecords.length > 0) {
          const monthsMap = {};
          subjectRecords.forEach((rec) => {
            const mLabel = getMonthYearFromISO(rec.date);
            if (!monthsMap[mLabel]) monthsMap[mLabel] = [];
            monthsMap[mLabel].push(rec);
          });
          grouped.push({
            subject: subj,
            months: Object.entries(monthsMap).map(([monthName, items]) => ({ monthName, items })),
          });
        }
      });
      const unassignedRecords = records.filter((r) => !activeSubjectIds.has(studentMap[r.studentId]?.subjectId));
      if (unassignedRecords.length > 0) {
        const monthsMap = {};
        unassignedRecords.forEach((rec) => {
          const mLabel = getMonthYearFromISO(rec.date);
          if (!monthsMap[mLabel]) monthsMap[mLabel] = [];
          monthsMap[mLabel].push(rec);
        });
        grouped.push({
          subject: { id: '_unassigned', name: 'Unassigned / Other' },
          months: Object.entries(monthsMap).map(([monthName, items]) => ({ monthName, items })),
        });
      }
      return grouped;
    },
    [activeSubjects, studentMap]
  );

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
              style={[
                styles.calendarDayCell,
                isToday && styles.calendarDayToday,
                isSelected && styles.calendarDaySelected,
              ]}
              onPress={() => {
                triggerHaptic(10);
                if (typeof onSelect === 'function') onSelect(isoStr);
                setCalendarPicker((prev) => ({ ...prev, visible: false }));
              }}
            >
              <Text
                style={[
                  styles.calendarDayText,
                  isToday && styles.calendarDayTextToday,
                  isSelected && styles.calendarDayTextSelected,
                ]}
              >
                {dayNum}
              </Text>
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
                const prevY =
                  calendarPicker.viewMonth === 0 ? calendarPicker.viewYear - 1 : calendarPicker.viewYear;
                setCalendarPicker({ ...calendarPicker, viewMonth: prevM, viewYear: prevY });
              }}
            >
              <Ionicons name="chevron-back-outline" size={18} color={COLORS.navy} />
            </TouchableOpacity>
            <Text style={styles.calendarMonthTitle}>
              {MONTHS_FULL[calendarPicker.viewMonth]} {calendarPicker.viewYear}
            </Text>
            <TouchableOpacity
              style={styles.iconActionBtn}
              onPress={() => {
                const nextM = calendarPicker.viewMonth === 11 ? 0 : calendarPicker.viewMonth + 1;
                const nextY =
                  calendarPicker.viewMonth === 11 ? calendarPicker.viewYear + 1 : calendarPicker.viewYear;
                setCalendarPicker({ ...calendarPicker, viewMonth: nextM, viewYear: nextY });
              }}
            >
              <Ionicons name="chevron-forward-outline" size={18} color={COLORS.navy} />
            </TouchableOpacity>
          </View>
          <View style={styles.calendarWeekRow}>
            {WEEKDAYS_SHORT.map((w) => (
              <Text key={w} style={styles.calendarWeekText}>
                {w}
              </Text>
            ))}
          </View>
          {renderCalendarDays()}
          <View style={[styles.modalBtnRow, { justifyContent: 'space-between', marginTop: 14 }]}>
            <PaperButton
              mode="outlined"
              textColor={COLORS.navy}
              onPress={() => {
                const today = getTodayISO();
                if (typeof calendarPicker.onSelect === 'function') calendarPicker.onSelect(today);
                setCalendarPicker((prev) => ({ ...prev, visible: false }));
              }}
            >
              Today
            </PaperButton>
            <PaperButton
              mode="contained"
              buttonColor={COLORS.navy}
              textColor={COLORS.gold}
              onPress={() => setCalendarPicker((prev) => ({ ...prev, visible: false }))}
            >
              Close
            </PaperButton>
          </View>
        </Pressable>
      </Pressable>
    );
  };

  // ==========================================
  // 6. HOMEPAGE: COMPACT 4 CARDS & HORIZONTAL MATRIX LIVE WIDGET
  // ==========================================
  const renderHomeTab = () => {
    const todayISO = getTodayISO();
    const liveStatusColor = !isNetworkOnline
      ? COLORS.offlineRed
      : hasAnyPendingWrites
      ? COLORS.syncAmber
      : COLORS.liveGreen;
    const liveStatusLabel = !isNetworkOnline
      ? 'OFFLINE'
      : hasAnyPendingWrites
      ? 'SYNCING'
      : 'LIVE';

    return (
      <View style={styles.homeNoScrollContainer}>
        {/* 1. Compact Greeting & Stats Banner (Zero Striping) */}
        <View style={styles.compactGreetingStrip}>
          <SmoothNavyGradient />
          <View style={{ flex: 1 }}>
            <Text style={styles.compactGreetingTitle}>{getGreetingByLocalTime()}, Maestro</Text>
            <Text style={styles.compactGreetingDate}>{formatReadableLocalDate(todayISO)}</Text>
          </View>
          <View style={styles.compactMetricsRow}>
            <View style={styles.compactMetricPill}>
              <Text style={styles.compactMetricValue}>{activeStudents.length}</Text>
              <Text style={styles.compactMetricLabel}>STUDENTS</Text>
            </View>
            <View style={styles.compactMetricPill}>
              <Text style={styles.compactMetricValue}>{activeSubjects.length}</Text>
              <Text style={styles.compactMetricLabel}>SUBJECTS</Text>
            </View>
          </View>
        </View>

        {/* 2. Top Half: Slightly Larger Notice Board + 3 Smaller Action Cards */}
        <View style={styles.compactActionSection}>
          {/* Slightly Larger Full-Width Notice Board Card */}
          <ScalePressable
            onPress={() => {
              triggerHaptic(10);
              setNoticeInput(noticeText);
              setNoticeEditModal(true);
            }}
          >
            <View style={styles.compactNoticeCard}>
              <MaterialCommunityIcons
                name="music-clef-treble"
                size={50}
                color="rgba(12, 45, 87, 0.045)"
                style={styles.noticeWatermark}
              />
              <View style={styles.compactNoticeHeaderRow}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7 }}>
                  <View style={styles.compactNoticeIconWrap}>
                    <Ionicons name="megaphone-outline" size={14} color={COLORS.navy} />
                  </View>
                  <Text style={styles.compactNoticeTitle}>Notice Board</Text>
                </View>
                {noticeUpdatedAt ? (
                  <Text style={styles.compactNoticeDate}>{formatReadableLocalDate(noticeUpdatedAt)}</Text>
                ) : null}
              </View>
              <Text
                style={[
                  styles.compactNoticeBody,
                  !noticeText && { color: COLORS.silver, fontStyle: 'italic' },
                ]}
                numberOfLines={2}
              >
                {noticeText ? noticeText : 'No active announcements.'}
              </Text>
            </View>
          </ScalePressable>

          {/* 3 Compact Equal-Width Cards in 1 Row */}
          <View style={styles.threeSmallCardsRow}>
            <View style={{ flex: 1 }}>
              <ScalePressable
                onPress={() => {
                  triggerHaptic(10);
                  if (activeSubjects.length === 0)
                    return Alert.alert(
                      'Create Subject First',
                      'Please add at least one instrument in Add Subjects first.'
                    );
                  setStudentForm({
                    id: null,
                    name: '',
                    subjectId: activeSubjects[0]?.id || '',
                    phone: '',
                    guardian: '',
                    joinedDate: getTodayISO(),
                  });
                  setStudentModal(true);
                }}
              >
                <View style={[styles.smallActionCard, styles.smallActionCardNavy]}>
                  <SmoothNavyGradient />
                  <View style={styles.smallCardTopRow}>
                    <View style={styles.smallIconCircleGold}>
                      <Ionicons name="person-add-outline" size={16} color={COLORS.gold} />
                    </View>
                  </View>
                  <Text style={styles.smallCardTitleGold} numberOfLines={1}>
                    Add Student
                  </Text>
                </View>
              </ScalePressable>
            </View>

            <View style={{ flex: 1 }}>
              <ScalePressable
                onPress={() => {
                  triggerHaptic(10);
                  setSubjectForm({ id: null, name: '' });
                  setSubjectsModal(true);
                }}
              >
                <View style={[styles.smallActionCard, styles.smallActionCardCream]}>
                  <View style={styles.smallCardTopRow}>
                    <View style={styles.smallIconCircleNavy}>
                      <Ionicons name="musical-notes-outline" size={16} color={COLORS.navy} />
                    </View>
                    <View style={styles.smallCountBadge}>
                      <Text style={styles.smallCountBadgeText}>{activeSubjects.length}</Text>
                    </View>
                  </View>
                  <Text style={styles.smallCardTitleNavy} numberOfLines={1}>
                    Add Subjects
                  </Text>
                </View>
              </ScalePressable>
            </View>

            <View style={{ flex: 1 }}>
              <ScalePressable
                onPress={() => {
                  triggerHaptic(10);
                  setActivityFilterTodayOnly(false);
                  setTodayLogModal(true);
                }}
              >
                <View style={[styles.smallActionCard, styles.smallActionCardWhite]}>
                  <View style={styles.smallCardTopRow}>
                    <View style={styles.smallIconCircleNavy}>
                      <Ionicons name="pulse-outline" size={16} color={COLORS.navy} />
                    </View>
                    <View style={styles.smallCountBadge}>
                      <Text style={styles.smallCountBadgeText}>{activeActivities.length}</Text>
                    </View>
                  </View>
                  <Text style={styles.smallCardTitleNavy} numberOfLines={1}>
                    Activity Log
                  </Text>
                </View>
              </ScalePressable>
            </View>
          </View>
        </View>

        {/* 3. Bottom Half: Horizontal Matrix Live Firebase Widget */}
        <Surface style={styles.liveFirebaseWidget} elevation={3}>
          {/* Status Header + Master List Button */}
          <View style={styles.liveWidgetHeader}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <Animated.View
                style={[
                  styles.liveStatusDot,
                  {
                    backgroundColor: liveStatusColor,
                    opacity: isNetworkOnline ? liveDotPulseAnim : 1,
                  },
                ]}
              />
              <Text style={styles.liveWidgetTitle}>FIREBASE LIVE MATRIX</Text>
              <View
                style={[
                  styles.liveStatusPill,
                  {
                    backgroundColor: !isNetworkOnline
                      ? COLORS.dangerBg
                      : hasAnyPendingWrites
                      ? COLORS.warningBg
                      : COLORS.successBg,
                  },
                ]}
              >
                <Text style={[styles.liveStatusPillText, { color: liveStatusColor }]}>
                  {liveStatusLabel}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.masterListBtn}
              onPress={() => {
                triggerHaptic(10);
                setMasterListModal(true);
              }}
            >
              <Ionicons name="grid-outline" size={13} color={COLORS.gold} />
              <Text style={styles.masterListBtnText}>Master List</Text>
            </TouchableOpacity>
          </View>

          {/* Horizontal Matrix Content */}
          {activeStudents.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <EmptyStateWatermark compact message="No students enrolled yet." />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <View style={styles.matrixWrapper}>
                {/* Sticky Left Column: Student Names */}
                <View style={styles.matrixStickyLeftCol}>
                  <View style={[styles.matrixHeaderCell, styles.matrixStickyHeaderCell]}>
                    <Text style={styles.matrixHeaderText}>STUDENT</Text>
                  </View>
                  {activeStudents.map((st, idx) => {
                    const m = getStudentMetrics(st.id);
                    const hasCachedWrite =
                      st._pendingSync ||
                      m.stLessons[0]?._pendingSync ||
                      m.stAttendance[0]?._pendingSync ||
                      m.stFees[0]?._pendingSync;
                    return (
                      <TouchableOpacity
                        key={st.id}
                        activeOpacity={0.75}
                        style={[
                          styles.matrixRowCell,
                          styles.matrixStickyCell,
                          idx % 2 === 1 && styles.matrixRowAlt,
                        ]}
                        onPress={() => {
                          triggerHaptic(8);
                          setNavDirection(1);
                          setSelectedStudentId(st.id);
                          setProfileTab('Classes');
                          setActiveTab('Students');
                        }}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.matrixStudentName} numberOfLines={1}>
                            {st.name}
                          </Text>
                          {hasCachedWrite ? (
                            <View style={styles.cachedTag}>
                              <Text style={styles.cachedTagText}>CACHED</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.matrixStudentSub} numberOfLines={1}>
                          {safeString(subjectMap[st.subjectId]?.name, 'Music')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                {/* Horizontally Scrollable Right Columns: Attendance, Latest Class, Fees */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <View>
                    {/* Header Row */}
                    <View style={styles.matrixScrollHeaderRow}>
                      <View style={[styles.matrixHeaderCell, { width: 148 }]}>
                        <Text style={styles.matrixHeaderText}>ATTENDANCE</Text>
                      </View>
                      <View style={[styles.matrixHeaderCell, { width: 175 }]}>
                        <Text style={styles.matrixHeaderText}>LATEST CLASS</Text>
                      </View>
                      <View style={[styles.matrixHeaderCell, { width: 155 }]}>
                        <Text style={styles.matrixHeaderText}>FEES</Text>
                      </View>
                    </View>

                    {/* Data Rows */}
                    {activeStudents.map((st, idx) => {
                      const m = getStudentMetrics(st.id);
                      const latestLesson = m.stLessons[0];
                      const latestAtt = m.stAttendance[0];
                      const latestFee = m.stFees[0];

                      const attBg = !latestAtt
                        ? COLORS.inputTint
                        : latestAtt.status === 'Present'
                        ? COLORS.successBg
                        : latestAtt.status === 'Absent'
                        ? COLORS.dangerBg
                        : COLORS.warningBg;

                      const attColor = !latestAtt
                        ? COLORS.silver
                        : latestAtt.status === 'Present'
                        ? COLORS.success
                        : latestAtt.status === 'Absent'
                        ? COLORS.danger
                        : COLORS.warning;

                      const feeBg =
                        m.feeStatus === 'Paid'
                          ? COLORS.successBg
                          : m.feeStatus === 'Due / Unpaid'
                          ? COLORS.dangerBg
                          : COLORS.inputTint;

                      const feeColor =
                        m.feeStatus === 'Paid'
                          ? COLORS.success
                          : m.feeStatus === 'Due / Unpaid'
                          ? COLORS.danger
                          : COLORS.silver;

                      return (
                        <View
                          key={st.id}
                          style={[styles.matrixScrollDataRow, idx % 2 === 1 && styles.matrixRowAlt]}
                        >
                          {/* Attendance Cell (Fixed-width status badge prevents shifting) */}
                          <TouchableOpacity
                            activeOpacity={0.75}
                            style={[styles.matrixRowCell, { width: 148 }]}
                            onPress={() => {
                              triggerHaptic(8);
                              setNavDirection(1);
                              setSelectedStudentId(st.id);
                              setProfileTab('Attendance');
                              setActiveTab('Students');
                            }}
                          >
                            <View style={[styles.matrixStatusBadge, { backgroundColor: attBg }]}>
                              <Text
                                style={[styles.matrixStatusBadgeText, { color: attColor }]}
                                numberOfLines={1}
                              >
                                {latestAtt ? latestAtt.status.toUpperCase() : 'NO RECORD'}
                              </Text>
                            </View>
                            <Text style={styles.matrixCellMeta} numberOfLines={1}>
                              {latestAtt ? `${formatReadableLocalDate(latestAtt.date)} (${m.attendancePct})` : '—'}
                            </Text>
                          </TouchableOpacity>

                          {/* Latest Class Cell */}
                          <TouchableOpacity
                            activeOpacity={0.75}
                            style={[styles.matrixRowCell, { width: 175 }]}
                            onPress={() => {
                              triggerHaptic(8);
                              setNavDirection(1);
                              setSelectedStudentId(st.id);
                              setProfileTab('Classes');
                              setActiveTab('Students');
                            }}
                          >
                            <Text style={styles.matrixCellPrimary} numberOfLines={1}>
                              {latestLesson
                                ? [
                                    latestLesson.lesson,
                                    latestLesson.technique,
                                    latestLesson.repertoire,
                                    latestLesson.assignment,
                                  ]
                                    .filter(Boolean)
                                    .join(' • ') || 'Lesson Logged'
                                : 'No classes'}
                            </Text>
                            <Text style={styles.matrixCellMeta} numberOfLines={1}>
                              {latestLesson
                                ? `${formatReadableLocalDate(latestLesson.date)} • ${m.classesTaken} total`
                                : '—'}
                            </Text>
                          </TouchableOpacity>

                          {/* Fees Cell */}
                          <TouchableOpacity
                            activeOpacity={0.75}
                            style={[styles.matrixRowCell, { width: 155 }]}
                            onPress={() => {
                              triggerHaptic(8);
                              setNavDirection(1);
                              setSelectedStudentId(st.id);
                              setProfileTab('Fees');
                              setActiveTab('Students');
                            }}
                          >
                            <View style={[styles.matrixStatusBadge, { backgroundColor: feeBg }]}>
                              <Text
                                style={[styles.matrixStatusBadgeText, { color: feeColor }]}
                                numberOfLines={1}
                              >
                                {latestFee ? `₹${latestFee.amountPaid} • ${latestFee.status.toUpperCase()}` : 'NO RECORDS'}
                              </Text>
                            </View>
                            <Text style={styles.matrixCellMeta} numberOfLines={1}>
                              {latestFee
                                ? m.totalDue > 0
                                  ? `Due: ₹${m.totalDue}`
                                  : formatReadableLocalDate(latestFee.date)
                                : '—'}
                            </Text>
                          </TouchableOpacity>
                        </View>
                      );
                    })}
                  </View>
                </ScrollView>
              </View>
            </ScrollView>
          )}
        </Surface>
      </View>
    );
  };

  const renderStudentCard = (st) => {
    const metrics = getStudentMetrics(st.id);
    return (
      <ScalePressable
        key={st.id}
        onPress={() => {
          Keyboard.dismiss();
          triggerHaptic(8);
          setNavDirection(1);
          setSubTabDirection(1);
          setSelectedStudentId(st.id);
          setProfileTab('Classes');
        }}
        onLongPress={() => openLongPressMenu('student', st, st.name)}
      >
        <Surface style={styles.cleanRecordCard} elevation={2}>
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Text style={styles.recordPrimaryTitle}>{safeString(st.name, 'Unnamed Student')}</Text>
              {st.priorityNote ? (
                <View style={styles.priorityBadge}>
                  <Text style={styles.priorityBadgeText}>☆ NOTE</Text>
                </View>
              ) : null}
              {st._pendingSync ? (
                <View style={styles.cachedTag}>
                  <Text style={styles.cachedTagText}>CACHED</Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.recordSecondarySub}>
              Joined {formatReadableLocalDate(st.joinedDate)} • Attendance {metrics.attendancePct}
            </Text>
          </View>
          <View
            style={[
              styles.feeBadge,
              metrics.feeStatus === 'Paid'
                ? styles.feeBadgePaid
                : metrics.feeStatus === 'Due / Unpaid'
                ? styles.feeBadgeDue
                : styles.feeBadgeNeutral,
            ]}
          >
            <Text style={styles.feeBadgeText}>{metrics.feeStatus}</Text>
          </View>
        </Surface>
      </ScalePressable>
    );
  };

  const renderStudentsTab = () => {
    if (selectedStudent) return renderStudentProfile(selectedStudent);
    const query = safeString(studentSearch).trim().toLowerCase();
    const filteredStudents = activeStudents.filter((st) => {
      const matchesQuery =
        !query ||
        safeString(st.name).toLowerCase().includes(query) ||
        safeString(st.phone).toLowerCase().includes(query) ||
        safeString(subjectMap[st.subjectId]?.name).toLowerCase().includes(query);
      if (!matchesQuery) return false;
      if (studentFilter === 'Priority') return Boolean(st.priorityNote);
      if (studentFilter === 'Due') return getStudentMetrics(st.id).feeStatus === 'Due / Unpaid';
      return true;
    });
    const activeSubjectIdSet = new Set(activeSubjects.map((s) => s.id));
    const unassignedStudents = filteredStudents.filter((st) => !activeSubjectIdSet.has(st.subjectId));

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContentWithFab}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.tabTopBar}>
          <Text style={styles.pageHeading}>Students</Text>
          <TouchableOpacity
            style={[
              styles.floatingSearchToggleBtn,
              (searchBarVisible || studentSearch.length > 0) && styles.floatingSearchToggleBtnActive,
            ]}
            onPress={() => {
              triggerHaptic(8);
              triggerLayoutAnimation();
              if (searchBarVisible && studentSearch) {
                setStudentSearch('');
              }
              setSearchBarVisible(!searchBarVisible);
            }}
          >
            <Ionicons
              name={searchBarVisible ? 'close-outline' : 'search-outline'}
              size={20}
              color={searchBarVisible || studentSearch.length > 0 ? COLORS.gold : COLORS.navy}
            />
          </TouchableOpacity>
        </View>

        {searchBarVisible && (
          <PaperInput
            mode="outlined"
            placeholder="Search name, instrument, phone..."
            value={studentSearch}
            onChangeText={setStudentSearch}
            autoFocus
            left={<PaperInput.Icon icon="magnify" />}
            right={
              studentSearch.length > 0 ? (
                <PaperInput.Icon icon="close-circle-outline" onPress={() => setStudentSearch('')} />
              ) : null
            }
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.navy}
            style={[styles.tintedInput, { marginBottom: 14 }]}
          />
        )}

        <View style={[styles.chipRow, { marginBottom: 16 }]}>
          {[
            { key: 'All', label: `All (${activeStudents.length})` },
            { key: 'Due', label: 'Due / Unpaid' },
            { key: 'Priority', label: '☆ Notes' },
          ].map((f) => (
            <TouchableOpacity
              key={f.key}
              style={[styles.choiceChip, studentFilter === f.key && styles.choiceChipSelected]}
              onPress={() => {
                Keyboard.dismiss();
                triggerHaptic(6);
                setStudentFilter(f.key);
              }}
            >
              <Text style={[styles.choiceChipText, studentFilter === f.key && styles.choiceChipTextSelected]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeSubjects.length === 0 && unassignedStudents.length === 0 ? (
          <Surface style={styles.whiteCard} elevation={2}>
            <EmptyStateWatermark
              message="No subjects configured yet."
              actionLabel="Add Subjects"
              onAction={() => {
                setSubjectForm({ id: null, name: '' });
                setSubjectsModal(true);
              }}
            />
          </Surface>
        ) : (
          <>
            {activeSubjects.map((subj) => {
              const subjStudents = filteredStudents.filter((s) => s.subjectId === subj.id);
              if ((query || studentFilter !== 'All') && subjStudents.length === 0) return null;
              return (
                <View key={subj.id} style={styles.groupBlock}>
                  <View style={styles.groupHeaderBar}>
                    <Text style={styles.groupHeaderTitle}>
                      {safeString(subj.name, 'Instrument').toUpperCase()}
                    </Text>
                    <Text style={styles.groupHeaderCount}>{subjStudents.length}</Text>
                  </View>
                  {subjStudents.length === 0 ? (
                    <EmptyStateWatermark compact message={`No students in ${subj.name}`} />
                  ) : (
                    subjStudents.map(renderStudentCard)
                  )}
                </View>
              );
            })}
            {unassignedStudents.length > 0 && (
              <View style={styles.groupBlock}>
                <View style={styles.groupHeaderBar}>
                  <Text style={styles.groupHeaderTitle}>UNASSIGNED</Text>
                  <Text style={styles.groupHeaderCount}>{unassignedStudents.length}</Text>
                </View>
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
      <ScrollView
        contentContainerStyle={styles.scrollContentWithFab}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={[styles.cardHeaderRow, { marginBottom: 14 }]}>
          <TouchableOpacity
            style={styles.backButtonRow}
            onPress={() => {
              Keyboard.dismiss();
              triggerHaptic(8);
              setNavDirection(-1);
              setSelectedStudentId(null);
            }}
          >
            <Ionicons name="arrow-back-outline" size={18} color={COLORS.navy} />
            <Text style={styles.backButtonText}>Students</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondaryButtonSmall}
            onPress={() => openLongPressMenu('student', student, student.name)}
          >
            <Ionicons name="ellipsis-horizontal" size={16} color={COLORS.navy} />
          </TouchableOpacity>
        </View>

        <Surface style={styles.heroCard} elevation={3}>
          <SmoothNavyGradient style={{ borderRadius: 18 }} />
          <View style={styles.cardHeaderRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.crestBadgeText}>
                {safeString(subjectMap[student.subjectId]?.name, 'Unassigned').toUpperCase()}
              </Text>
              <Text style={styles.heroGreeting}>{safeString(student.name, 'Student')}</Text>
              {student.guardian ? <Text style={styles.heroDate}>Guardian: {student.guardian}</Text> : null}
              {student.phone ? <Text style={styles.heroDate}>{student.phone}</Text> : null}
            </View>
            {student.priorityNote ? (
              <View style={styles.priorityBadge}>
                <Text style={styles.priorityBadgeText}>☆ NOTE</Text>
              </View>
            ) : null}
          </View>
          {student.phone ? (
            <View style={styles.contactActionRow}>
              <TouchableOpacity style={styles.contactActionBtn} onPress={() => handlePhoneCall(student.phone)}>
                <Ionicons name="call-outline" size={15} color={COLORS.gold} />
                <Text style={styles.contactActionText}>Call</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.contactActionBtn}
                onPress={() => handleOpenWhatsApp(student.phone, student.name)}
              >
                <Ionicons name="logo-whatsapp" size={15} color={COLORS.gold} />
                <Text style={styles.contactActionText}>WhatsApp</Text>
              </TouchableOpacity>
            </View>
          ) : null}
          <View style={styles.profileStatsGrid}>
            <View style={styles.profileStatBox}>
              <Text style={styles.profileStatLabel}>ATTENDANCE</Text>
              <Text style={styles.profileStatVal}>{metrics.attendancePct}</Text>
            </View>
            <View style={styles.profileStatBox}>
              <Text style={styles.profileStatLabel}>CLASSES</Text>
              <Text style={styles.profileStatVal}>{metrics.classesTaken}</Text>
            </View>
            <View style={styles.profileStatBox}>
              <Text style={styles.profileStatLabel}>FEES</Text>
              <Text
                style={[
                  styles.profileStatVal,
                  { fontSize: 13, color: metrics.feeStatus === 'Due / Unpaid' ? '#FFB4A2' : COLORS.gold },
                ]}
              >
                {metrics.feeStatus}
              </Text>
            </View>
          </View>
        </Surface>

        <View style={styles.pillNavContainer}>
          {PROFILE_TABS.map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[styles.pillNavItem, profileTab === tab && styles.pillNavItemActive]}
              onPress={() => {
                if (tab === profileTab) return;
                Keyboard.dismiss();
                triggerHaptic(6);
                const newIdx = PROFILE_TABS.indexOf(tab);
                const oldIdx = PROFILE_TABS.indexOf(profileTab);
                setSubTabDirection(newIdx > oldIdx ? 1 : -1);
                setProfileTab(tab);
              }}
            >
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
              <Surface style={styles.whiteCard} elevation={2}>
                <Text style={styles.sectionTitle}>LOG LESSON</Text>
                <QuickDateRow
                  currentDate={inlineLessonForm.date}
                  onSelectDate={(d) => setInlineLessonForm({ ...inlineLessonForm, date: d })}
                  onOpenCalendar={openCalendarPicker}
                />
                <PaperInput
                  mode="outlined"
                  value={inlineLessonForm.date}
                  onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, date: t })}
                  placeholder="YYYY-MM-DD"
                  right={
                    <PaperInput.Icon
                      icon="calendar-outline"
                      onPress={() =>
                        openCalendarPicker(inlineLessonForm.date, (d) =>
                          setInlineLessonForm({ ...inlineLessonForm, date: d })
                        )
                      }
                    />
                  }
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperInput
                  mode="outlined"
                  value={inlineLessonForm.technique}
                  onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, technique: t })}
                  placeholder="Technique (Scales, posture...)"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperInput
                  mode="outlined"
                  value={inlineLessonForm.lesson}
                  onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, lesson: t })}
                  placeholder="Lesson topic..."
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperInput
                  mode="outlined"
                  value={inlineLessonForm.repertoire}
                  onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, repertoire: t })}
                  placeholder="Repertoire..."
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperInput
                  mode="outlined"
                  value={inlineLessonForm.assignment}
                  onChangeText={(t) => setInlineLessonForm({ ...inlineLessonForm, assignment: t })}
                  placeholder="Assignment..."
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperButton
                  mode="contained"
                  buttonColor={COLORS.navy}
                  textColor={COLORS.gold}
                  onPress={handleSaveInlineLesson}
                  style={{ marginTop: 8, borderRadius: 10 }}
                >
                  Save Lesson
                </PaperButton>
              </Surface>

              <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>LESSON HISTORY</Text>
              {metrics.stLessons.length === 0 ? (
                <Surface style={styles.whiteCard} elevation={2}>
                  <EmptyStateWatermark message="No lessons logged yet." />
                </Surface>
              ) : (
                metrics.stLessons.map((les) => (
                  <ScalePressable
                    key={les.id}
                    onLongPress={() =>
                      openLongPressMenu('lesson', les, `Lesson on ${formatReadableLocalDate(les.date)}`)
                    }
                  >
                    <Surface style={styles.cleanRecordCard} elevation={2}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.recordPrimaryTitle}>{formatReadableLocalDate(les.date)}</Text>
                          {les._pendingSync ? (
                            <View style={styles.cachedTag}>
                              <Text style={styles.cachedTagText}>CACHED</Text>
                            </View>
                          ) : null}
                        </View>
                        {les.technique ? (
                          <Text style={styles.recordDetailLine}>
                            <Text style={styles.boldLabel}>Technique: </Text>
                            {les.technique}
                          </Text>
                        ) : null}
                        {les.lesson ? (
                          <Text style={styles.recordDetailLine}>
                            <Text style={styles.boldLabel}>Lesson: </Text>
                            {les.lesson}
                          </Text>
                        ) : null}
                        {les.repertoire ? (
                          <Text style={styles.recordDetailLine}>
                            <Text style={styles.boldLabel}>Repertoire: </Text>
                            {les.repertoire}
                          </Text>
                        ) : null}
                        {les.assignment ? (
                          <Text style={styles.recordDetailLine}>
                            <Text style={styles.boldLabel}>Assignment: </Text>
                            {les.assignment}
                          </Text>
                        ) : null}
                      </View>
                    </Surface>
                  </ScalePressable>
                ))
              )}
            </View>
          )}

          {profileTab === 'Attendance' && (
            <View>
              <Surface style={styles.whiteCard} elevation={2}>
                <Text style={styles.sectionTitle}>MARK ATTENDANCE</Text>
                <QuickDateRow
                  currentDate={inlineAttendanceForm.date}
                  onSelectDate={(d) => setInlineAttendanceForm({ ...inlineAttendanceForm, date: d })}
                  onOpenCalendar={openCalendarPicker}
                />
                <PaperInput
                  mode="outlined"
                  value={inlineAttendanceForm.date}
                  onChangeText={(t) => setInlineAttendanceForm({ ...inlineAttendanceForm, date: t })}
                  right={
                    <PaperInput.Icon
                      icon="calendar-outline"
                      onPress={() =>
                        openCalendarPicker(inlineAttendanceForm.date, (d) =>
                          setInlineAttendanceForm({ ...inlineAttendanceForm, date: d })
                        )
                      }
                    />
                  }
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <View style={styles.chipRow}>
                  {ATTENDANCE_STATUSES.map((st) => (
                    <TouchableOpacity
                      key={st}
                      style={[
                        styles.choiceChip,
                        inlineAttendanceForm.status === st && styles.choiceChipSelected,
                      ]}
                      onPress={() => {
                        Keyboard.dismiss();
                        triggerHaptic(6);
                        setInlineAttendanceForm({ ...inlineAttendanceForm, status: st });
                      }}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          inlineAttendanceForm.status === st && styles.choiceChipTextSelected,
                        ]}
                      >
                        {st}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <PaperInput
                  mode="outlined"
                  value={inlineAttendanceForm.remarks}
                  onChangeText={(t) => setInlineAttendanceForm({ ...inlineAttendanceForm, remarks: t })}
                  placeholder="Optional remarks..."
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperButton
                  mode="contained"
                  buttonColor={COLORS.navy}
                  textColor={COLORS.gold}
                  onPress={handleSaveInlineAttendance}
                  style={{ marginTop: 8, borderRadius: 10 }}
                >
                  Save Attendance
                </PaperButton>
              </Surface>

              <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>ATTENDANCE LOG</Text>
              {metrics.stAttendance.length === 0 ? (
                <Surface style={styles.whiteCard} elevation={2}>
                  <EmptyStateWatermark message="No attendance records found." />
                </Surface>
              ) : (
                metrics.stAttendance.map((att) => (
                  <ScalePressable
                    key={att.id}
                    onLongPress={() =>
                      openLongPressMenu('attendance', att, `${att.status} (${formatReadableLocalDate(att.date)})`)
                    }
                  >
                    <Surface style={styles.cleanRecordCard} elevation={2}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.recordPrimaryTitle}>{formatReadableLocalDate(att.date)}</Text>
                          {att._pendingSync ? (
                            <View style={styles.cachedTag}>
                              <Text style={styles.cachedTagText}>CACHED</Text>
                            </View>
                          ) : null}
                        </View>
                        {att.remarks ? <Text style={styles.recordSecondarySub}>{att.remarks}</Text> : null}
                      </View>
                      <View style={styles.statusPill}>
                        <Text style={styles.statusPillText}>{att.status}</Text>
                      </View>
                    </Surface>
                  </ScalePressable>
                ))
              )}
            </View>
          )}

          {profileTab === 'Notes' && (
            <Surface style={styles.whiteCard} elevation={2}>
              <Text style={styles.sectionTitle}>FACULTY NOTES</Text>
              <View style={styles.prioritySwitchRow}>
                <Text style={styles.recordPrimaryTitle}>Priority "☆ NOTE" Badge</Text>
                <Switch
                  value={priorityDraft}
                  onValueChange={setPriorityDraft}
                  trackColor={{ false: COLORS.silver, true: COLORS.navy }}
                  thumbColor={priorityDraft ? COLORS.gold : COLORS.white}
                />
              </View>
              <PaperInput
                mode="outlined"
                multiline
                numberOfLines={5}
                value={noteDraft}
                onChangeText={setNoteDraft}
                placeholder="Examination goals, recital readiness, or faculty notes..."
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={[styles.tintedInput, { marginTop: 12 }]}
              />
              <PaperButton
                mode="contained"
                buttonColor={COLORS.navy}
                textColor={COLORS.gold}
                onPress={handleSaveStudentNotes}
                style={{ marginTop: 10, borderRadius: 10 }}
              >
                Save Notes
              </PaperButton>
            </Surface>
          )}

          {profileTab === 'Fees' && (
            <View>
              <Text style={[styles.sectionTitle, { marginBottom: 10 }]}>FEE LEDGER</Text>
              {metrics.stFees.length === 0 ? (
                <Surface style={styles.whiteCard} elevation={2}>
                  <EmptyStateWatermark message="No fee records logged for this student." />
                </Surface>
              ) : (
                metrics.stFees.map((fee) => (
                  <ScalePressable
                    key={fee.id}
                    onLongPress={() =>
                      openLongPressMenu(
                        'fee',
                        fee,
                        `${fee.feeType} - ₹${fee.amountPaid} (${formatReadableLocalDate(fee.date)})`
                      )
                    }
                  >
                    <Surface style={styles.cleanRecordCard} elevation={2}>
                      <View style={{ flex: 1 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <Text style={styles.recordPrimaryTitle}>
                            {fee.feeType}{' '}
                            {fee.feeType === 'Monthly Fee' && fee.monthPaidFor ? `• ${fee.monthPaidFor}` : ''}
                          </Text>
                          {fee._pendingSync ? (
                            <View style={styles.cachedTag}>
                              <Text style={styles.cachedTagText}>CACHED</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.recordSecondarySub}>
                          {formatReadableLocalDate(fee.date)} • {fee.mode} • {fee.status}
                        </Text>
                        <Text style={styles.recordDetailLine}>
                          Paid: ₹{fee.amountPaid} | Balance: ₹{fee.balanceDue}
                        </Text>
                        {fee.remarks ? <Text style={styles.silverMeta}>{fee.remarks}</Text> : null}
                      </View>
                      <TouchableOpacity
                        style={styles.pdfExportTouchBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => generateAndShareReceiptPDF(fee)}
                      >
                        <Ionicons name="share-social-outline" size={16} color={COLORS.gold} />
                        <Text style={styles.pdfExportTouchBtnText}>Receipt</Text>
                      </TouchableOpacity>
                    </Surface>
                  </ScalePressable>
                ))
              )}
            </View>
          )}
        </AnimatedScreen>
      </ScrollView>
    );
  };

  const renderAttendanceTab = () => {
    const filteredRecords = attendanceFilterAllMonths
      ? activeAttendance
      : activeAttendance.filter((a) => isWithinLastTwoLocalMonths(a.date));
    const groupedAttendance = groupRecordsBySubjectAndMonth(filteredRecords);
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContentWithFab}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.tabTopBar}>
          <Text style={styles.pageHeading}>Attendance</Text>
          <PaperButton
            mode="outlined"
            textColor={COLORS.navy}
            style={{ borderColor: COLORS.silver }}
            onPress={() => {
              triggerLayoutAnimation();
              setAttendanceFilterAllMonths(!attendanceFilterAllMonths);
            }}
          >
            {attendanceFilterAllMonths ? 'Last 2 Months' : 'All Months'}
          </PaperButton>
        </View>

        {groupedAttendance.length === 0 ? (
          <Surface style={styles.whiteCard} elevation={2}>
            <EmptyStateWatermark message="No attendance records in this timeframe." />
          </Surface>
        ) : (
          groupedAttendance.map((group) => (
            <View key={group.subject.id} style={styles.groupBlock}>
              <View style={styles.groupHeaderBar}>
                <Text style={styles.groupHeaderTitle}>
                  {safeString(group.subject.name, 'Instrument').toUpperCase()}
                </Text>
              </View>
              {group.months.map((mGroup) => (
                <View key={mGroup.monthName} style={{ marginTop: 8 }}>
                  <Text style={styles.monthSubHeader}>{mGroup.monthName}</Text>
                  {mGroup.items.map((att) => {
                    const st = studentMap[att.studentId];
                    return (
                      <ScalePressable
                        key={att.id}
                        onLongPress={() =>
                          openLongPressMenu(
                            'attendance',
                            att,
                            `${safeString(st?.name, 'Student')} - ${att.status} (${formatReadableLocalDate(
                              att.date
                            )})`
                          )
                        }
                      >
                        <Surface style={styles.cleanRecordCard} elevation={2}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.recordPrimaryTitle}>{safeString(st?.name, 'Unknown')}</Text>
                              {att._pendingSync ? (
                                <View style={styles.cachedTag}>
                                  <Text style={styles.cachedTagText}>CACHED</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.recordSecondarySub}>
                              {formatReadableLocalDate(att.date)}
                              {att.remarks ? ` • ${att.remarks}` : ''}
                            </Text>
                          </View>
                          <View style={styles.statusPill}>
                            <Text style={styles.statusPillText}>{att.status}</Text>
                          </View>
                        </Surface>
                      </ScalePressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderFeesTab = () => {
    const groupedFees = groupRecordsBySubjectAndMonth(activeFees);
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContentWithFab}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.tabTopBar}>
          <Text style={styles.pageHeading}>Fee Ledger</Text>
        </View>

        <View style={styles.ledgerSummaryRow}>
          <View style={[styles.ledgerSummaryBox, { backgroundColor: COLORS.navy, overflow: 'hidden' }]}>
            <SmoothNavyGradient />
            <Text style={styles.ledgerSummaryLabel}>TOTAL COLLECTED</Text>
            <Text style={styles.ledgerSummaryValGold}>₹{globalFeeTotals.collected.toFixed(0)}</Text>
          </View>
          <View
            style={[
              styles.ledgerSummaryBox,
              { backgroundColor: COLORS.cream, borderColor: COLORS.gold, borderWidth: 1 },
            ]}
          >
            <Text style={[styles.ledgerSummaryLabel, { color: COLORS.navy }]}>PENDING BALANCE</Text>
            <Text style={[styles.ledgerSummaryValGold, { color: COLORS.danger }]}>
              ₹{globalFeeTotals.pending.toFixed(0)}
            </Text>
          </View>
        </View>

        {groupedFees.length === 0 ? (
          <Surface style={styles.whiteCard} elevation={2}>
            <EmptyStateWatermark message="No fee transactions recorded yet." />
          </Surface>
        ) : (
          groupedFees.map((group) => (
            <View key={group.subject.id} style={styles.groupBlock}>
              <View style={styles.groupHeaderBar}>
                <Text style={styles.groupHeaderTitle}>
                  {safeString(group.subject.name, 'Instrument').toUpperCase()}
                </Text>
              </View>
              {group.months.map((mGroup) => (
                <View key={mGroup.monthName} style={{ marginTop: 8 }}>
                  <Text style={styles.monthSubHeader}>{mGroup.monthName}</Text>
                  {mGroup.items.map((fee) => {
                    const st = studentMap[fee.studentId];
                    const isFullyPaid = fee.status === 'Paid' && safeNumber(fee.balanceDue, 0) === 0;
                    return (
                      <ScalePressable
                        key={fee.id}
                        onLongPress={() =>
                          openLongPressMenu('fee', fee, `${safeString(st?.name, 'Student')} - ₹${fee.amountPaid}`)
                        }
                      >
                        <Surface style={styles.cleanRecordCard} elevation={2}>
                          <View style={{ flex: 1 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.recordPrimaryTitle}>
                                {safeString(st?.name, 'Unknown')} • {fee.feeType}
                              </Text>
                              {fee._pendingSync ? (
                                <View style={styles.cachedTag}>
                                  <Text style={styles.cachedTagText}>CACHED</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.recordSecondarySub}>
                              {formatReadableLocalDate(fee.date)} • {fee.mode}
                              {fee.feeType === 'Monthly Fee' && fee.monthPaidFor
                                ? ` • ${fee.monthPaidFor}`
                                : ''}
                            </Text>
                            <Text style={styles.recordDetailLine}>
                              Paid: ₹{fee.amountPaid} | Balance: ₹{fee.balanceDue}
                            </Text>
                          </View>
                          <View style={{ alignItems: 'flex-end', gap: 8 }}>
                            <View style={[styles.feeBadge, isFullyPaid ? styles.feeBadgePaid : styles.feeBadgeDue]}>
                              <Text style={styles.feeBadgeText}>{fee.status}</Text>
                            </View>
                            <TouchableOpacity
                              style={styles.pdfExportTouchBtn}
                              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                              onPress={() => generateAndShareReceiptPDF(fee)}
                            >
                              <Ionicons name="document-text-outline" size={16} color={COLORS.gold} />
                              <Text style={styles.pdfExportTouchBtnText}>PDF</Text>
                            </TouchableOpacity>
                          </View>
                        </Surface>
                      </ScalePressable>
                    );
                  })}
                </View>
              ))}
            </View>
          ))
        )}
      </ScrollView>
    );
  };

  const renderTrashTab = () => {
    return (
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.tabTopBar}>
          <Text style={styles.pageHeading}>Trash Archive</Text>
          {trashItems.length > 0 && (
            <PaperButton mode="contained" buttonColor={COLORS.danger} textColor={COLORS.white} onPress={handleEmptyTrash}>
              Empty Trash
            </PaperButton>
          )}
        </View>

        {trashItems.length === 0 ? (
          <Surface style={styles.whiteCard} elevation={2}>
            <EmptyStateWatermark message="Trash archive is clean." />
          </Surface>
        ) : (
          trashItems.map((item) => {
            const daysLeft = getDaysRemainingInTrash(item.deletedAt);
            return (
              <ScalePressable
                key={`${item._col}-${item.id}`}
                onPress={() => {
                  triggerHaptic(10);
                  Alert.alert(item._label, `${daysLeft} days remaining before permanent purge.`, [
                    { text: 'Cancel', style: 'cancel' },
                    { text: 'Restore', onPress: () => handleRestoreTrashItem(item) },
                    {
                      text: 'Delete Permanently',
                      style: 'destructive',
                      onPress: () => handlePermanentDeleteItem(item),
                    },
                  ]);
                }}
              >
                <Surface style={styles.cleanRecordCard} elevation={2}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.recordPrimaryTitle}>{item._label}</Text>
                    <Text style={styles.recordSecondarySub}>
                      {safeString(item._col).toUpperCase()}
                    </Text>
                  </View>
                  <View style={styles.daysRemainingBadge}>
                    <Text style={styles.daysRemainingText}>{daysLeft}d left</Text>
                  </View>
                </Surface>
              </ScalePressable>
            );
          })
        )}
      </ScrollView>
    );
  };

  // ==========================================
  // 7. CLEAN FLOATING ACTION BUTTON (FAB) CONFIG
  // ==========================================
  const getActiveFABConfig = () => {
    if (activeTab === 'Students' && !selectedStudent) {
      return {
        label: 'New Student',
        icon: 'person-add-outline',
        onPress: () => {
          Keyboard.dismiss();
          triggerHaptic(12);
          if (activeSubjects.length === 0)
            return Alert.alert('Subject Required', 'Add an instrument in Add Subjects first.');
          setStudentForm({
            id: null,
            name: '',
            subjectId: activeSubjects[0]?.id || '',
            phone: '',
            guardian: '',
            joinedDate: getTodayISO(),
          });
          setStudentModal(true);
        },
      };
    }
    if (activeTab === 'Students' && selectedStudent && profileTab === 'Fees') {
      return {
        label: 'Record Fee',
        icon: 'card-outline',
        onPress: () => {
          Keyboard.dismiss();
          triggerHaptic(12);
          setFeeForm({
            id: null,
            studentId: selectedStudent.id,
            feeType: 'Monthly Fee',
            monthPaidFor: getLocalCurrentMonthLabel(),
            date: getTodayISO(),
            mode: 'UPI',
            status: 'Paid',
            amountPaid: '',
            balanceDue: '0',
            remarks: '',
          });
          setFeeModal(true);
        },
      };
    }
    if (activeTab === 'Attendance') {
      return {
        label: 'Mark Attendance',
        icon: 'checkmark-done-outline',
        onPress: () => {
          Keyboard.dismiss();
          triggerHaptic(12);
          if (activeStudents.length === 0)
            return Alert.alert('No Students', 'Add a student before marking attendance.');
          setAttendanceModalForm({
            id: null,
            studentId: activeStudents[0]?.id || '',
            date: getTodayISO(),
            status: 'Present',
            remarks: '',
          });
          setAttendanceModal(true);
        },
      };
    }
    if (activeTab === 'Fees') {
      return {
        label: 'Record Fee',
        icon: 'card-outline',
        onPress: () => {
          Keyboard.dismiss();
          triggerHaptic(12);
          if (activeStudents.length === 0)
            return Alert.alert('No Students', 'Enroll a student before recording fees.');
          setFeeForm({
            id: null,
            studentId: activeStudents[0]?.id || '',
            feeType: 'Monthly Fee',
            monthPaidFor: getLocalCurrentMonthLabel(),
            date: getTodayISO(),
            mode: 'UPI',
            status: 'Paid',
            amountPaid: '',
            balanceDue: '0',
            remarks: '',
          });
          setFeeModal(true);
        },
      };
    }
    return null;
  };

  const fabConfig = getActiveFABConfig();
  const displayedActivities = activityFilterTodayOnly
    ? activeActivities.filter((a) => a.dateISO === getTodayISO())
    : activeActivities;
  const isInsideStudentProfile = activeTab === 'Students' && Boolean(selectedStudent);
  const anyFormModalOpen = studentModal || lessonEditModal || attendanceModal || feeModal;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {/* Top Navigation Bar */}
      <View style={styles.gradientHeaderWrapper}>
        <SmoothNavyGradient />
        <Appbar.Header style={{ backgroundColor: 'transparent', elevation: 0 }}>
          <Appbar.Action icon="menu" color={COLORS.gold} onPress={openDrawer} />
          <Appbar.Content
            title="JSM"
            subtitle="EST. 2022"
            titleStyle={styles.appbarSerifTitle}
            subtitleStyle={styles.appbarSubtitle}
            style={{ alignItems: 'center' }}
          />
          <View style={{ width: 48 }} />
        </Appbar.Header>
      </View>

      <View style={{ flex: 1 }}>
        {/* Edge Swipe Strip */}
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

        {/* Clean Bottom-Right Floating Action Button (FAB) */}
        {fabConfig && (
          <ScalePressable style={styles.fabContainerPos} onPress={fabConfig.onPress}>
            <View style={styles.fabButton}>
              <SmoothNavyGradient />
              <Ionicons name={fabConfig.icon} size={18} color={COLORS.gold} />
              <Text style={styles.fabButtonText}>{fabConfig.label}</Text>
            </View>
          </ScalePressable>
        )}

        {!anyFormModalOpen && !masterListModal && renderCalendarOverlay()}
      </View>

      {/* Bottom Tab Bar */}
      <View style={styles.bottomTabBar}>
        {[
          { key: 'Home', icon: 'grid-outline', label: 'Home' },
          { key: 'Students', icon: 'people-outline', label: 'Students' },
          { key: 'Attendance', icon: 'calendar-outline', label: 'Attendance' },
          { key: 'Fees', icon: 'card-outline', label: 'Fees' },
          { key: 'Trash', icon: 'trash-outline', label: 'Trash' },
        ].map((tab) => {
          const isFocused = activeTab === tab.key;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.bottomTabItem}
              onPress={() => {
                Keyboard.dismiss();
                triggerHaptic(6);
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
              }}
            >
              <View>
                <Ionicons name={tab.icon} size={22} color={isFocused ? COLORS.gold : COLORS.silver} />
                {tab.key === 'Trash' && trashItems.length > 0 && (
                  <View style={styles.trashTabBadge}>
                    <Text style={styles.trashTabBadgeText}>{trashItems.length}</Text>
                  </View>
                )}
              </View>
              <Text style={[styles.bottomTabLabel, isFocused && styles.bottomTabLabelActive]}>
                {tab.label}
              </Text>
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
                <View style={styles.drawerHeader}>
                  <SmoothNavyGradient />
                  <Text style={styles.crestBadgeText}>★ JSM ★</Text>
                  <Text style={styles.drawerTitle}>Music School Portal</Text>
                  <Text style={styles.drawerSub}>Est. 2022 • Official Edition</Text>
                </View>
                <ScrollView contentContainerStyle={{ padding: 18, gap: 10 }} keyboardShouldPersistTaps="handled">
                  {[
                    { label: 'Global Attendance', tab: 'Attendance', icon: 'calendar-outline' },
                    { label: 'Global Fee Register', tab: 'Fees', icon: 'card-outline' },
                    { label: `Trash Archive (${trashItems.length})`, tab: 'Trash', icon: 'trash-outline' },
                  ].map((nav) => (
                    <TouchableOpacity
                      key={nav.tab}
                      style={[styles.drawerNavItem, activeTab === nav.tab && styles.drawerNavItemActive]}
                      onPress={() => {
                        closeDrawer(() => {
                          const newIdx = MAIN_TABS.indexOf(nav.tab);
                          const oldIdx = MAIN_TABS.indexOf(activeTabRef.current);
                          setNavDirection(newIdx >= oldIdx ? 1 : -1);
                          setSelectedStudentId(null);
                          setActiveTab(nav.tab);
                        });
                      }}
                    >
                      <Ionicons
                        name={nav.icon}
                        size={18}
                        color={activeTab === nav.tab ? COLORS.gold : COLORS.navy}
                      />
                      <Text style={[styles.drawerNavText, activeTab === nav.tab && styles.drawerNavTextActive]}>
                        {nav.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <View style={styles.drawerDivider} />
                  <TouchableOpacity
                    style={styles.drawerNavItem}
                    onPress={() => {
                      closeDrawer(() => {
                        setSubjectForm({ id: null, name: '' });
                        setSubjectsModal(true);
                      });
                    }}
                  >
                    <Ionicons name="musical-notes-outline" size={18} color={COLORS.navy} />
                    <Text style={styles.drawerNavText}>Manage Subjects</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.drawerNavItem}
                    onPress={() => {
                      closeDrawer(() => {
                        setMasterListModal(true);
                      });
                    }}
                  >
                    <Ionicons name="grid-outline" size={18} color={COLORS.navy} />
                    <Text style={styles.drawerNavText}>Master List & Reports</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.drawerNavItem}
                    onPress={() => {
                      closeDrawer(() => {
                        setActivityFilterTodayOnly(false);
                        setTodayLogModal(true);
                      });
                    }}
                  >
                    <Ionicons name="pulse-outline" size={18} color={COLORS.navy} />
                    <Text style={styles.drawerNavText}>Activity Log</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.drawerNavItem} onPress={handleCheckOTA} disabled={checkingOTA}>
                    {checkingOTA ? (
                      <ActivityIndicator size="small" color={COLORS.navy} />
                    ) : (
                      <>
                        <Ionicons name="cloud-download-outline" size={18} color={COLORS.navy} />
                        <Text style={styles.drawerNavText}>Check for OTA Update</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </ScrollView>
              </Animated.View>
            </PanGestureHandler>
            <Pressable style={{ flex: 1 }} onPress={() => closeDrawer()} />
          </Animated.View>
        </GestureHandlerRootView>
      </Modal>

      {/* MASTER LIST & REPORT GENERATOR MODAL (FILTER BY STUDENT & DATE/MONTH) */}
      <Modal visible={masterListModal} animationType="slide" onRequestClose={() => setMasterListModal(false)}>
        <SafeAreaView style={styles.fullScreenModalSafe}>
          <View style={styles.fullScreenModalHeader}>
            <SmoothNavyGradient />
            <View style={{ flex: 1 }}>
              <Text style={styles.fullScreenModalTitle}>Master Student List</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <TouchableOpacity style={styles.pdfExportTouchBtn} onPress={exportMasterListPDF}>
                <Ionicons name="print-outline" size={15} color={COLORS.gold} />
                <Text style={styles.pdfExportTouchBtnText}>Export PDF</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.fullScreenCloseBtn}
                onPress={() => setMasterListModal(false)}
              >
                <Ionicons name="close-outline" size={26} color={COLORS.gold} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Filter Bar: Student & Month/Date Selectors */}
          <View style={styles.masterFilterSection}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={{ flexDirection: 'row', gap: 6 }}>
                <TouchableOpacity
                  style={[styles.choiceChip, masterStudentFilter === 'ALL' && styles.choiceChipSelected]}
                  onPress={() => {
                    triggerHaptic(6);
                    setMasterStudentFilter('ALL');
                  }}
                >
                  <Text
                    style={[
                      styles.choiceChipText,
                      masterStudentFilter === 'ALL' && styles.choiceChipTextSelected,
                    ]}
                  >
                    All Students ({activeStudents.length})
                  </Text>
                </TouchableOpacity>
                {activeStudents.map((st) => (
                  <TouchableOpacity
                    key={st.id}
                    style={[styles.choiceChip, masterStudentFilter === st.id && styles.choiceChipSelected]}
                    onPress={() => {
                      triggerHaptic(6);
                      setMasterStudentFilter(st.id);
                    }}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        masterStudentFilter === st.id && styles.choiceChipTextSelected,
                      ]}
                    >
                      {st.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              style={{ marginTop: 8 }}
            >
              <View style={{ flexDirection: 'row', gap: 6, alignItems: 'center' }}>
                <TouchableOpacity
                  style={[
                    styles.choiceChip,
                    masterMonthFilter === 'ALL' && !masterDateFilter && styles.choiceChipSelected,
                  ]}
                  onPress={() => {
                    triggerHaptic(6);
                    setMasterDateFilter('');
                    setMasterMonthFilter('ALL');
                  }}
                >
                  <Text
                    style={[
                      styles.choiceChipText,
                      masterMonthFilter === 'ALL' && !masterDateFilter && styles.choiceChipTextSelected,
                    ]}
                  >
                    All Time
                  </Text>
                </TouchableOpacity>
                {availableMasterMonths.map((mLabel) => (
                  <TouchableOpacity
                    key={mLabel}
                    style={[
                      styles.choiceChip,
                      masterMonthFilter === mLabel && !masterDateFilter && styles.choiceChipSelected,
                    ]}
                    onPress={() => {
                      triggerHaptic(6);
                      setMasterDateFilter('');
                      setMasterMonthFilter(mLabel);
                    }}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        masterMonthFilter === mLabel && !masterDateFilter && styles.choiceChipTextSelected,
                      ]}
                    >
                      {mLabel}
                    </Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={[styles.quickDateChipCalendar, masterDateFilter && { backgroundColor: COLORS.gold }]}
                  onPress={() =>
                    openCalendarPicker(masterDateFilter || getTodayISO(), (picked) => {
                      setMasterDateFilter(picked);
                    })
                  }
                >
                  <Ionicons
                    name="calendar-outline"
                    size={13}
                    color={masterDateFilter ? COLORS.navy : COLORS.gold}
                  />
                  <Text
                    style={[
                      styles.quickDateChipCalendarText,
                      masterDateFilter && { color: COLORS.navy },
                    ]}
                  >
                    {masterDateFilter ? formatReadableLocalDate(masterDateFilter) : 'Exact Date'}
                  </Text>
                </TouchableOpacity>
                {masterDateFilter ? (
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    onPress={() => setMasterDateFilter('')}
                  >
                    <Ionicons name="close-outline" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </ScrollView>
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {masterListData.length === 0 ? (
              <Surface style={styles.whiteCard} elevation={2}>
                <EmptyStateWatermark message="No records found for this selection." />
              </Surface>
            ) : (
              masterListData.map((row) => (
                <ScalePressable
                  key={row.student.id}
                  onPress={() => {
                    setMasterListModal(false);
                    setNavDirection(1);
                    setSelectedStudentId(row.student.id);
                    setProfileTab('Classes');
                    setActiveTab('Students');
                  }}
                >
                  <Surface style={[styles.whiteCard, { marginBottom: 12, padding: 16 }]} elevation={2}>
                    <View style={styles.cardHeaderRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.recordPrimaryTitle}>
                          {row.student.name} • {row.subjectName}
                        </Text>
                        <Text style={styles.recordSecondarySub}>
                          Classes: {row.stLessons.length} • Present: {row.presentCount} • Absent: {row.absentCount} • Rescheduled: {row.reschedCount}
                        </Text>
                      </View>
                      <View
                        style={[
                          styles.feeBadge,
                          row.totalDue > 0 ? styles.feeBadgeDue : styles.feeBadgePaid,
                        ]}
                      >
                        <Text style={styles.feeBadgeText}>
                          {row.totalDue > 0 ? `Due ₹${row.totalDue}` : `Paid ₹${row.totalPaid}`}
                        </Text>
                      </View>
                    </View>
                    <View style={styles.sheetDivider} />
                    <Text style={styles.recordDetailLine} numberOfLines={2}>
                      <Text style={styles.boldLabel}>Classes: </Text>
                      {row.stLessons.length > 0
                        ? row.stLessons
                            .slice(0, 3)
                            .map(
                              (l) =>
                                `${formatReadableLocalDate(l.date)} (${
                                  [l.lesson, l.technique, l.repertoire].filter(Boolean).join(', ') || 'Logged'
                                })`
                            )
                            .join('  •  ')
                        : 'None in period'}
                    </Text>
                    <Text style={styles.recordDetailLine} numberOfLines={2}>
                      <Text style={styles.boldLabel}>Attendance: </Text>
                      {row.stAtt.length > 0
                        ? row.stAtt
                            .slice(0, 4)
                            .map((a) => `${formatReadableLocalDate(a.date)}: ${a.status}`)
                            .join('  •  ')
                        : 'None in period'}
                    </Text>
                    <Text style={styles.recordDetailLine} numberOfLines={2}>
                      <Text style={styles.boldLabel}>Fees: </Text>
                      {row.stFees.length > 0
                        ? row.stFees
                            .slice(0, 3)
                            .map((f) => `${formatReadableLocalDate(f.date)}: ₹${f.amountPaid} (${f.status})`)
                            .join('  •  ')
                        : 'None in period'}
                    </Text>
                  </Surface>
                </ScalePressable>
              ))
            )}
          </ScrollView>
          {renderCalendarOverlay()}
        </SafeAreaView>
      </Modal>

      {/* BOTTOM-SLIDING CONTEXTUAL ACTION SHEET */}
      <Modal visible={contextMenu.visible} transparent animationType="slide" onRequestClose={closeContextMenu}>
        <Pressable style={styles.bottomSheetBackdrop} onPress={closeContextMenu}>
          <Pressable style={styles.bottomContextSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.bottomSheetPill} />
            <Text style={styles.contextSheetHeader}>{contextMenu.title}</Text>
            <View style={styles.contextDivider} />
            {contextMenu.entityType !== 'activity' && (
              <TouchableOpacity style={styles.contextOptionBtn} onPress={() => handleContextAction('edit')}>
                <Ionicons name="create-outline" size={18} color={COLORS.navy} />
                <Text style={styles.contextOptionText}>Edit</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={styles.contextOptionBtn} onPress={() => handleContextAction('delete')}>
              <Ionicons name="trash-outline" size={18} color={COLORS.danger} />
              <Text style={[styles.contextOptionText, { color: COLORS.danger }]}>Move to Trash</Text>
            </TouchableOpacity>
            <PaperButton
              mode="outlined"
              textColor={COLORS.navy}
              style={{ marginTop: 14, width: '100%', borderColor: COLORS.border, borderRadius: 12 }}
              onPress={() => {
                const shouldReopenSubj = contextMenu.reopenSubjectsModal;
                const shouldReopenLog = contextMenu.reopenTodayLogModal;
                closeContextMenu();
                if (shouldReopenSubj) scheduleTimeout(() => setSubjectsModal(true), 220);
                if (shouldReopenLog) scheduleTimeout(() => setTodayLogModal(true), 220);
              }}
            >
              Cancel
            </PaperButton>
          </Pressable>
        </Pressable>
      </Modal>

      {/* NOTICE BOARD MODAL */}
      <Modal visible={noticeEditModal} transparent animationType="fade" onRequestClose={() => setNoticeEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>NOTICE BOARD</Text>
              {noticeUpdatedAt ? (
                <Text style={styles.silverMeta}>{formatReadableLocalDate(noticeUpdatedAt)}</Text>
              ) : null}
            </View>
            <PaperInput
              mode="outlined"
              multiline
              numberOfLines={5}
              value={noticeInput}
              onChangeText={setNoticeInput}
              placeholder="Write announcement..."
              outlineColor={COLORS.border}
              activeOutlineColor={COLORS.navy}
              style={[styles.tintedInput, { marginTop: 10, marginBottom: 14 }]}
            />
            <View style={[styles.modalBtnRow, { justifyContent: 'space-between', flexWrap: 'wrap' }]}>
              {noticeText ? (
                <TouchableOpacity
                  style={styles.dangerOutlineBtnSmall}
                  onPress={() => handleUpdateNotice('')}
                >
                  <Ionicons name="trash-outline" size={14} color={COLORS.danger} />
                  <Text style={styles.dangerOutlineBtnSmallText}>Clear</Text>
                </TouchableOpacity>
              ) : (
                <View />
              )}
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <PaperButton
                  mode="outlined"
                  textColor={COLORS.navy}
                  onPress={() => {
                    Keyboard.dismiss();
                    setNoticeEditModal(false);
                  }}
                >
                  Cancel
                </PaperButton>
                <PaperButton
                  mode="contained"
                  buttonColor={COLORS.navy}
                  textColor={COLORS.gold}
                  onPress={() => handleUpdateNotice(null)}
                >
                  Save
                </PaperButton>
              </View>
            </View>
          </Surface>
        </KeyboardAvoidingView>
      </Modal>

      {/* FULL-SCREEN ACTIVITY LOG MODAL */}
      <Modal visible={todayLogModal} animationType="slide" onRequestClose={() => setTodayLogModal(false)}>
        <SafeAreaView style={styles.fullScreenModalSafe}>
          <View style={styles.fullScreenModalHeader}>
            <SmoothNavyGradient />
            <Text style={styles.fullScreenModalTitle}>Activity Log</Text>
            <TouchableOpacity
              style={styles.fullScreenCloseBtn}
              onPress={() => setTodayLogModal(false)}
            >
              <Ionicons name="close-outline" size={26} color={COLORS.gold} />
            </TouchableOpacity>
          </View>

          <View style={styles.fullScreenModalToolbar}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity
                style={[styles.choiceChip, !activityFilterTodayOnly && styles.choiceChipSelected]}
                onPress={() => setActivityFilterTodayOnly(false)}
              >
                <Text style={[styles.choiceChipText, !activityFilterTodayOnly && styles.choiceChipTextSelected]}>
                  All ({activeActivities.length})
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.choiceChip, activityFilterTodayOnly && styles.choiceChipSelected]}
                onPress={() => setActivityFilterTodayOnly(true)}
              >
                <Text style={[styles.choiceChipText, activityFilterTodayOnly && styles.choiceChipTextSelected]}>
                  Today
                </Text>
              </TouchableOpacity>
            </View>
            {displayedActivities.length > 0 ? (
              <TouchableOpacity
                style={styles.dangerOutlineBtnSmall}
                onPress={() => handleClearAllActivities(activityFilterTodayOnly)}
              >
                <Ionicons name="trash-outline" size={13} color={COLORS.danger} />
                <Text style={styles.dangerOutlineBtnSmallText}>Clear All</Text>
              </TouchableOpacity>
            ) : null}
          </View>

          <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            {displayedActivities.length === 0 ? (
              <Surface style={styles.whiteCard} elevation={2}>
                <EmptyStateWatermark
                  message={activityFilterTodayOnly ? 'No activity today.' : 'No recent activity.'}
                />
              </Surface>
            ) : (
              displayedActivities.map((act) => (
                <ScalePressable
                  key={act.id}
                  onLongPress={() => {
                    setTodayLogModal(false);
                    scheduleTimeout(
                      () =>
                        openLongPressMenu(
                          'activity',
                          act,
                          `${act.title}${act.subtitle ? ` • ${act.subtitle}` : ''}`,
                          false,
                          true
                        ),
                      220
                    );
                  }}
                >
                  <Surface style={styles.cleanRecordCard} elevation={2}>
                    <View style={styles.activityDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.activityTitle}>{act.title}</Text>
                      {act.subtitle ? <Text style={styles.activitySub}>{act.subtitle}</Text> : null}
                    </View>
                    <Text style={styles.silverMeta}>{formatReadableLocalDate(act.dateISO)}</Text>
                  </Surface>
                </ScalePressable>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* MANAGE SUBJECTS MODAL (DECLUTTERED: LONG-PRESS TO EDIT/DELETE, 6-DOT HANDLE TO REORDER) */}
      <Modal visible={subjectsModal} transparent animationType="fade" onRequestClose={() => setSubjectsModal(false)}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
            <Surface style={styles.modalCard} elevation={5}>
              <Text style={styles.sectionTitle}>SUBJECTS</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <PaperInput
                  mode="outlined"
                  value={subjectForm.name}
                  onChangeText={(t) => setSubjectForm({ ...subjectForm, name: t })}
                  placeholder="Instrument name..."
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={[styles.tintedInput, { flex: 1, height: 48, marginBottom: 0 }]}
                />
                <PaperButton
                  mode="contained"
                  buttonColor={COLORS.navy}
                  textColor={COLORS.gold}
                  onPress={handleSaveSubject}
                >
                  {subjectForm.id ? 'Save' : 'Add'}
                </PaperButton>
              </View>
              <ScrollView
                style={{ maxHeight: 290, marginVertical: 14 }}
                scrollEnabled={!subjectScrollLocked && !draggingSubjectId}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {orderedSubjects.length === 0 ? (
                  <EmptyStateWatermark compact message="No subjects added yet." />
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
                            { minHeight: 50, paddingVertical: 8, paddingHorizontal: 12 },
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
                              onTouchEnd={() => {
                                if (!dragInfoRef.current.active) setSubjectScrollLocked(false);
                              }}
                              onTouchCancel={() => {
                                if (!dragInfoRef.current.active) setSubjectScrollLocked(false);
                              }}
                            >
                              <MaterialCommunityIcons
                                name="drag-vertical"
                                size={22}
                                color={isDragging ? COLORS.navy : COLORS.silver}
                              />
                            </View>
                          </PanGestureHandler>

                          <Pressable
                            style={{ flex: 1, paddingVertical: 6 }}
                            onLongPress={() => {
                              if (draggingSubjectId) return;
                              setSubjectsModal(false);
                              scheduleTimeout(
                                () => openLongPressMenu('subject', subj, subj.name, true),
                                220
                              );
                            }}
                            delayLongPress={260}
                          >
                            <Text style={styles.recordPrimaryTitle}>
                              {idx + 1}. {subj.name}
                            </Text>
                          </Pressable>
                        </Surface>
                      </Animated.View>
                    );
                  })
                )}
              </ScrollView>
              <PaperButton
                mode="outlined"
                textColor={COLORS.navy}
                style={{ alignSelf: 'flex-end', borderColor: COLORS.silver }}
                onPress={() => {
                  Keyboard.dismiss();
                  setSubjectForm({ id: null, name: '' });
                  setSubjectsModal(false);
                }}
              >
                Done
              </PaperButton>
            </Surface>
          </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Modal>

      {/* REGISTER / EDIT STUDENT MODAL */}
      <Modal visible={studentModal} transparent animationType="fade" onRequestClose={() => setStudentModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>
              {studentForm.id ? 'EDIT STUDENT' : 'NEW STUDENT'}
            </Text>
            <ScrollView style={{ maxHeight: 380, marginTop: 8 }} keyboardShouldPersistTaps="handled">
              <PaperInput
                mode="outlined"
                value={studentForm.name}
                onChangeText={(t) => setStudentForm({ ...studentForm, name: t })}
                placeholder="Full Name *"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <View style={styles.chipRow}>
                {activeSubjects.map((s) => (
                  <TouchableOpacity
                    key={s.id}
                    style={[styles.choiceChip, studentForm.subjectId === s.id && styles.choiceChipSelected]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setStudentForm({ ...studentForm, subjectId: s.id });
                    }}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        studentForm.subjectId === s.id && styles.choiceChipTextSelected,
                      ]}
                    >
                      {s.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <PaperInput
                mode="outlined"
                value={studentForm.phone}
                onChangeText={(t) => setStudentForm({ ...studentForm, phone: t })}
                keyboardType="phone-pad"
                placeholder="Phone / WhatsApp"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <PaperInput
                mode="outlined"
                value={studentForm.guardian}
                onChangeText={(t) => setStudentForm({ ...studentForm, guardian: t })}
                placeholder="Parent / Guardian"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <QuickDateRow
                currentDate={studentForm.joinedDate}
                onSelectDate={(d) => setStudentForm({ ...studentForm, joinedDate: d })}
                onOpenCalendar={openCalendarPicker}
              />
              <PaperInput
                mode="outlined"
                value={studentForm.joinedDate}
                onChangeText={(t) => setStudentForm({ ...studentForm, joinedDate: t })}
                right={
                  <PaperInput.Icon
                    icon="calendar-outline"
                    onPress={() =>
                      openCalendarPicker(studentForm.joinedDate, (d) =>
                        setStudentForm({ ...studentForm, joinedDate: d })
                      )
                    }
                  />
                }
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <PaperButton
                mode="outlined"
                textColor={COLORS.navy}
                onPress={() => {
                  Keyboard.dismiss();
                  setStudentModal(false);
                }}
              >
                Cancel
              </PaperButton>
              <PaperButton
                mode="contained"
                buttonColor={COLORS.navy}
                textColor={COLORS.gold}
                onPress={handleSaveStudent}
              >
                Save
              </PaperButton>
            </View>
          </Surface>
          {renderCalendarOverlay()}
        </KeyboardAvoidingView>
      </Modal>

      {/* EDIT LESSON MODAL */}
      <Modal
        visible={lessonEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => setLessonEditModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>EDIT LESSON</Text>
            <ScrollView style={{ maxHeight: 360, marginTop: 8 }} keyboardShouldPersistTaps="handled">
              <QuickDateRow
                currentDate={lessonEditForm.date}
                onSelectDate={(d) => setLessonEditForm({ ...lessonEditForm, date: d })}
                onOpenCalendar={openCalendarPicker}
              />
              <PaperInput
                mode="outlined"
                value={lessonEditForm.date}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, date: t })}
                right={
                  <PaperInput.Icon
                    icon="calendar-outline"
                    onPress={() =>
                      openCalendarPicker(lessonEditForm.date, (d) =>
                        setLessonEditForm({ ...lessonEditForm, date: d })
                      )
                    }
                  />
                }
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <PaperInput
                mode="outlined"
                value={lessonEditForm.technique}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, technique: t })}
                placeholder="Technique"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <PaperInput
                mode="outlined"
                value={lessonEditForm.lesson}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, lesson: t })}
                placeholder="Lesson"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <PaperInput
                mode="outlined"
                value={lessonEditForm.repertoire}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, repertoire: t })}
                placeholder="Repertoire"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <PaperInput
                mode="outlined"
                value={lessonEditForm.assignment}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, assignment: t })}
                placeholder="Assignment"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <PaperButton
                mode="outlined"
                textColor={COLORS.navy}
                onPress={() => {
                  Keyboard.dismiss();
                  setLessonEditModal(false);
                }}
              >
                Cancel
              </PaperButton>
              <PaperButton
                mode="contained"
                buttonColor={COLORS.navy}
                textColor={COLORS.gold}
                onPress={handleSaveEditedLesson}
              >
                Update
              </PaperButton>
            </View>
          </Surface>
          {renderCalendarOverlay()}
        </KeyboardAvoidingView>
      </Modal>

      {/* MARK / EDIT ATTENDANCE MODAL */}
      <Modal
        visible={attendanceModal}
        transparent
        animationType="fade"
        onRequestClose={() => setAttendanceModal(false)}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>
              {attendanceModalForm.id ? 'EDIT ATTENDANCE' : 'MARK ATTENDANCE'}
            </Text>
            <ScrollView style={{ maxHeight: 360, marginTop: 8 }} keyboardShouldPersistTaps="handled">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 10 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {activeStudents.map((st) => (
                    <TouchableOpacity
                      key={st.id}
                      style={[
                        styles.choiceChip,
                        attendanceModalForm.studentId === st.id && styles.choiceChipSelected,
                      ]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setAttendanceModalForm({ ...attendanceModalForm, studentId: st.id });
                      }}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          attendanceModalForm.studentId === st.id && styles.choiceChipTextSelected,
                        ]}
                      >
                        {st.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <QuickDateRow
                currentDate={attendanceModalForm.date}
                onSelectDate={(d) => setAttendanceModalForm({ ...attendanceModalForm, date: d })}
                onOpenCalendar={openCalendarPicker}
              />
              <PaperInput
                mode="outlined"
                value={attendanceModalForm.date}
                onChangeText={(t) => setAttendanceModalForm({ ...attendanceModalForm, date: t })}
                right={
                  <PaperInput.Icon
                    icon="calendar-outline"
                    onPress={() =>
                      openCalendarPicker(attendanceModalForm.date, (d) =>
                        setAttendanceModalForm({ ...attendanceModalForm, date: d })
                      )
                    }
                  />
                }
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <View style={styles.chipRow}>
                {ATTENDANCE_STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[
                      styles.choiceChip,
                      attendanceModalForm.status === st && styles.choiceChipSelected,
                    ]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setAttendanceModalForm({ ...attendanceModalForm, status: st });
                    }}
                  >
                    <Text
                      style={[
                        styles.choiceChipText,
                        attendanceModalForm.status === st && styles.choiceChipTextSelected,
                      ]}
                    >
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <PaperInput
                mode="outlined"
                value={attendanceModalForm.remarks}
                onChangeText={(t) => setAttendanceModalForm({ ...attendanceModalForm, remarks: t })}
                placeholder="Optional remarks"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <PaperButton
                mode="outlined"
                textColor={COLORS.navy}
                onPress={() => {
                  Keyboard.dismiss();
                  setAttendanceModal(false);
                }}
              >
                Cancel
              </PaperButton>
              <PaperButton
                mode="contained"
                buttonColor={COLORS.navy}
                textColor={COLORS.gold}
                onPress={handleSaveModalAttendance}
              >
                Save
              </PaperButton>
            </View>
          </Surface>
          {renderCalendarOverlay()}
        </KeyboardAvoidingView>
      </Modal>

      {/* RECORD / EDIT FEE MODAL */}
      <Modal visible={feeModal} transparent animationType="fade" onRequestClose={() => setFeeModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>{feeForm.id ? 'EDIT FEE' : 'RECORD FEE'}</Text>
            <ScrollView style={{ maxHeight: 420, marginTop: 8 }} keyboardShouldPersistTaps="handled">
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={{ marginBottom: 8 }}
                keyboardShouldPersistTaps="handled"
              >
                <View style={{ flexDirection: 'row', gap: 6 }}>
                  {activeStudents.map((st) => (
                    <TouchableOpacity
                      key={st.id}
                      style={[styles.choiceChip, feeForm.studentId === st.id && styles.choiceChipSelected]}
                      onPress={() => {
                        Keyboard.dismiss();
                        setFeeForm({ ...feeForm, studentId: st.id });
                      }}
                    >
                      <Text
                        style={[
                          styles.choiceChipText,
                          feeForm.studentId === st.id && styles.choiceChipTextSelected,
                        ]}
                      >
                        {st.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
              <View style={styles.chipRow}>
                {FEE_TYPES.map((ft) => (
                  <TouchableOpacity
                    key={ft}
                    style={[styles.choiceChip, feeForm.feeType === ft && styles.choiceChipSelected]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setFeeForm({ ...feeForm, feeType: ft });
                    }}
                  >
                    <Text
                      style={[styles.choiceChipText, feeForm.feeType === ft && styles.choiceChipTextSelected]}
                    >
                      {ft}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              {feeForm.feeType === 'Monthly Fee' && (
                <PaperInput
                  mode="outlined"
                  value={feeForm.monthPaidFor}
                  onChangeText={(t) => setFeeForm({ ...feeForm, monthPaidFor: t })}
                  placeholder="Month Paid For * (e.g., November 2026)"
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
              )}
              <QuickDateRow
                currentDate={feeForm.date}
                onSelectDate={(d) => setFeeForm({ ...feeForm, date: d })}
                onOpenCalendar={openCalendarPicker}
              />
              <PaperInput
                mode="outlined"
                value={feeForm.date}
                onChangeText={(t) => setFeeForm({ ...feeForm, date: t })}
                right={
                  <PaperInput.Icon
                    icon="calendar-outline"
                    onPress={() =>
                      openCalendarPicker(feeForm.date, (d) => setFeeForm({ ...feeForm, date: d }))
                    }
                  />
                }
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <View style={styles.chipRow}>
                {PAYMENT_MODES.map((m) => (
                  <TouchableOpacity
                    key={m}
                    style={[styles.choiceChip, feeForm.mode === m && styles.choiceChipSelected]}
                    onPress={() => {
                      Keyboard.dismiss();
                      setFeeForm({ ...feeForm, mode: m });
                    }}
                  >
                    <Text style={[styles.choiceChipText, feeForm.mode === m && styles.choiceChipTextSelected]}>
                      {m}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.chipRow}>
                {FEE_STATUSES.map((st) => (
                  <TouchableOpacity
                    key={st}
                    style={[styles.choiceChip, feeForm.status === st && styles.choiceChipSelected]}
                    onPress={() => {
                      Keyboard.dismiss();
                      if (st === 'Unpaid') setFeeForm({ ...feeForm, status: st, amountPaid: '0' });
                      else if (st === 'Paid') setFeeForm({ ...feeForm, status: st, balanceDue: '0' });
                      else setFeeForm({ ...feeForm, status: st });
                    }}
                  >
                    <Text style={[styles.choiceChipText, feeForm.status === st && styles.choiceChipTextSelected]}>
                      {st}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text style={styles.inputLabel}>Amount Paid (₹)</Text>
              <PaperInput
                mode="outlined"
                editable={feeForm.status !== 'Unpaid'}
                keyboardType="numeric"
                value={feeForm.status === 'Unpaid' ? '0' : feeForm.amountPaid}
                onChangeText={(t) => setFeeForm({ ...feeForm, amountPaid: sanitizeCurrency(t) })}
                placeholder="0"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={[
                  styles.tintedInput,
                  feeForm.status === 'Unpaid' && { backgroundColor: '#E5E5E5' },
                ]}
              />
              <Text style={styles.inputLabel}>Balance Due (₹)</Text>
              <PaperInput
                mode="outlined"
                editable={feeForm.status !== 'Paid'}
                keyboardType="numeric"
                value={feeForm.status === 'Paid' ? '0' : feeForm.balanceDue}
                onChangeText={(t) => setFeeForm({ ...feeForm, balanceDue: sanitizeCurrency(t) })}
                placeholder="0"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={[
                  styles.tintedInput,
                  feeForm.status === 'Paid' && { backgroundColor: '#E5E5E5' },
                ]}
              />
              <PaperInput
                mode="outlined"
                value={feeForm.remarks}
                onChangeText={(t) => setFeeForm({ ...feeForm, remarks: t })}
                placeholder="Optional receipt notes"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
            </ScrollView>
            <View style={[styles.modalBtnRow, { flexWrap: 'wrap', gap: 8 }]}>
              <PaperButton
                mode="outlined"
                textColor={COLORS.navy}
                onPress={() => {
                  Keyboard.dismiss();
                  setFeeModal(false);
                }}
              >
                Cancel
              </PaperButton>
              <PaperButton
                mode="contained"
                buttonColor={COLORS.navy}
                textColor={COLORS.gold}
                onPress={() => handleSaveFee(false)}
              >
                Save
              </PaperButton>
              <PaperButton
                mode="contained"
                buttonColor={COLORS.gold}
                textColor={COLORS.navy}
                onPress={() => handleSaveFee(true)}
              >
                Save & Share
              </PaperButton>
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
  gradientHeaderWrapper: {
    backgroundColor: COLORS.navy,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.gold,
    overflow: 'hidden',
  },
  appbarSerifTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
    letterSpacing: 2.5,
  },
  appbarSubtitle: {
    color: COLORS.gold,
    fontSize: 9,
    letterSpacing: 3,
    fontWeight: '600',
  },
  errorBoundaryContainer: {
    flex: 1,
    backgroundColor: COLORS.navy,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  errorBoundaryTitle: { color: COLORS.gold, fontSize: 20, fontWeight: '800', marginTop: 12 },
  errorBoundarySub: { color: COLORS.cream, fontSize: 13, textAlign: 'center', marginVertical: 12 },
  errorBoundaryBtn: {
    backgroundColor: COLORS.gold,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
  },
  errorBoundaryBtnText: { color: COLORS.navy, fontSize: 14, fontWeight: '800' },
  leftEdgeSwipeZone: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 16, zIndex: 50 },
  scrollContent: { padding: 18, paddingBottom: 36 },
  scrollContentWithFab: { padding: 18, paddingBottom: 98 },

  // --- HOMEPAGE: GENEROUS NEGATIVE SPACE + COMPACT 4 CARDS + HORIZONTAL MATRIX ---
  homeNoScrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 12,
    gap: 12,
  },
  compactGreetingStrip: {
    backgroundColor: COLORS.navy,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 3,
  },
  compactGreetingTitle: {
    color: COLORS.white,
    fontSize: 17,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
  },
  compactGreetingDate: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '600',
    marginTop: 2,
  },
  compactMetricsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  compactMetricPill: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 11,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 185, 120, 0.35)',
    minWidth: 64,
  },
  compactMetricValue: {
    color: COLORS.gold,
    fontSize: 14,
    fontWeight: '800',
  },
  compactMetricLabel: {
    color: COLORS.cream,
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  compactActionSection: {
    gap: 10,
  },
  compactNoticeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 15,
    overflow: 'hidden',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 2,
  },
  noticeWatermark: {
    position: 'absolute',
    right: 6,
    bottom: -6,
  },
  compactNoticeHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  compactNoticeIconWrap: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(12, 45, 87, 0.07)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  compactNoticeTitle: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
  },
  compactNoticeDate: {
    color: COLORS.silver,
    fontSize: 10,
    fontWeight: '600',
  },
  compactNoticeBody: {
    color: COLORS.charcoal,
    fontSize: 13,
    lineHeight: 18,
  },
  threeSmallCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallActionCard: {
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
    height: 76,
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  smallActionCardNavy: {
    backgroundColor: COLORS.navy,
  },
  smallActionCardCream: {
    backgroundColor: COLORS.cream,
  },
  smallActionCardWhite: {
    backgroundColor: COLORS.white,
  },
  smallCardTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  smallIconCircleGold: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(212, 185, 120, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(212, 185, 120, 0.4)',
  },
  smallIconCircleNavy: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(12, 45, 87, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  smallCountBadge: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 10,
  },
  smallCountBadgeText: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
  },
  smallCardTitleGold: {
    color: COLORS.gold,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
  },
  smallCardTitleNavy: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
  },

  // --- HORIZONTAL LIVE FIREBASE MATRIX WIDGET ---
  liveFirebaseWidget: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  liveWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  liveStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  liveWidgetTitle: {
    color: COLORS.navy,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
  },
  liveStatusPill: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  liveStatusPillText: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.6,
  },
  masterListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  masterListBtnText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  matrixWrapper: {
    flexDirection: 'row',
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  matrixStickyLeftCol: {
    width: 126,
    borderRightWidth: 1,
    borderRightColor: COLORS.border,
    backgroundColor: COLORS.white,
    zIndex: 10,
  },
  matrixHeaderCell: {
    height: 34,
    justifyContent: 'center',
    paddingHorizontal: 10,
    backgroundColor: COLORS.ivory,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  matrixStickyHeaderCell: {
    backgroundColor: COLORS.cream,
  },
  matrixHeaderText: {
    color: COLORS.navy,
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.9,
  },
  matrixScrollHeaderRow: {
    flexDirection: 'row',
  },
  matrixScrollDataRow: {
    flexDirection: 'row',
  },
  matrixRowCell: {
    height: 54,
    justifyContent: 'center',
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F2EFE9',
  },
  matrixStickyCell: {
    backgroundColor: COLORS.white,
  },
  matrixRowAlt: {
    backgroundColor: '#FCFBF8',
  },
  matrixStudentName: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '700',
    flexShrink: 1,
  },
  matrixStudentSub: {
    color: COLORS.silver,
    fontSize: 10,
    marginTop: 2,
  },
  matrixStatusBadge: {
    minWidth: 96,
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  matrixStatusBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    textAlign: 'center',
  },
  matrixCellPrimary: {
    color: COLORS.navy,
    fontSize: 11,
    fontWeight: '600',
  },
  matrixCellMeta: {
    color: COLORS.silver,
    fontSize: 10,
    marginTop: 2,
  },
  cachedTag: {
    backgroundColor: COLORS.warningBg,
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 4,
    flexShrink: 0,
  },
  cachedTagText: {
    color: COLORS.warning,
    fontSize: 7,
    fontWeight: '800',
  },
  sheetDivider: {
    height: 1,
    backgroundColor: '#F0ECE1',
    marginVertical: 8,
  },

  // --- DIRECTORY & LEDGER STYLES WITH GENEROUS NEGATIVE SPACE ---
  floatingSearchToggleBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  floatingSearchToggleBtnActive: {
    backgroundColor: COLORS.navy,
  },
  heroCard: {
    backgroundColor: COLORS.navy,
    borderRadius: 18,
    padding: 20,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 12,
    elevation: 4,
  },
  crestBadgeText: { color: COLORS.gold, fontSize: 10, fontWeight: '700', letterSpacing: 1.5 },
  heroGreeting: {
    color: COLORS.white,
    fontSize: 22,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
    marginTop: 2,
  },
  heroDate: { color: COLORS.cream, fontSize: 12, marginTop: 3 },
  contactActionRow: { flexDirection: 'row', gap: 10, marginTop: 12 },
  contactActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(212, 185, 120, 0.16)',
    borderWidth: 1,
    borderColor: COLORS.gold,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  contactActionText: { color: COLORS.gold, fontSize: 12, fontWeight: '700' },
  whiteCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    marginBottom: 16,
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  sectionTitle: { color: COLORS.navy, fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  silverMeta: { color: COLORS.silver, fontSize: 12 },
  tintedInput: {
    backgroundColor: COLORS.inputTint,
    marginBottom: 10,
  },
  activityDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.gold },
  activityTitle: { color: COLORS.navy, fontSize: 14, fontWeight: '600' },
  activitySub: { color: COLORS.silver, fontSize: 12, marginTop: 2 },
  dangerOutlineBtnSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.dangerBg,
    borderColor: COLORS.danger,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  dangerOutlineBtnSmallText: { color: COLORS.danger, fontSize: 11, fontWeight: '700' },
  tabTopBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    gap: 10,
  },
  pageHeading: {
    color: COLORS.navy,
    fontSize: 24,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
  },
  ledgerSummaryRow: { flexDirection: 'row', gap: 12, marginBottom: 18 },
  ledgerSummaryBox: {
    flex: 1,
    borderRadius: 16,
    padding: 15,
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 2,
  },
  ledgerSummaryLabel: { color: COLORS.cream, fontSize: 10, fontWeight: '700', letterSpacing: 1 },
  ledgerSummaryValGold: { color: COLORS.gold, fontSize: 19, fontWeight: '800', marginTop: 4 },
  groupBlock: { marginBottom: 20 },
  groupHeaderBar: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderLeftWidth: 4,
    borderLeftColor: COLORS.gold,
    marginBottom: 4,
  },
  groupHeaderTitle: { color: COLORS.gold, fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  groupHeaderCount: { color: COLORS.cream, fontSize: 12, fontWeight: '700' },
  monthSubHeader: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
    marginVertical: 6,
    paddingLeft: 4,
  },
  cleanRecordCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 15,
    marginTop: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  draggingSubjectCard: { backgroundColor: COLORS.cream, borderColor: COLORS.gold, borderWidth: 1.5 },
  dragHandleBtn: {
    paddingVertical: 6,
    paddingHorizontal: 6,
    marginRight: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 6,
    backgroundColor: COLORS.ivory,
  },
  recordPrimaryTitle: { color: COLORS.navy, fontSize: 15, fontWeight: '700' },
  recordSecondarySub: { color: COLORS.silver, fontSize: 12, marginTop: 3 },
  recordDetailLine: { color: COLORS.charcoal, fontSize: 12, marginTop: 4 },
  boldLabel: { fontWeight: '700', color: COLORS.navy },
  priorityBadge: {
    backgroundColor: COLORS.navy,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
  },
  priorityBadgeText: { color: COLORS.gold, fontSize: 9, fontWeight: '800' },
  feeBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  feeBadgePaid: { backgroundColor: COLORS.successBg },
  feeBadgeDue: { backgroundColor: COLORS.dangerBg },
  feeBadgeNeutral: { backgroundColor: COLORS.cream },
  feeBadgeText: { fontSize: 11, fontWeight: '700', color: COLORS.navy },
  statusPill: {
    backgroundColor: COLORS.cream,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 11,
    paddingVertical: 5,
    borderRadius: 8,
    minWidth: 86,
    alignItems: 'center',
  },
  statusPillText: { color: COLORS.navy, fontSize: 11, fontWeight: '700' },
  backButtonRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  backButtonText: { color: COLORS.navy, fontSize: 14, fontWeight: '700' },
  secondaryButtonSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.cream,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  profileStatsGrid: { flexDirection: 'row', gap: 10, marginTop: 16 },
  profileStatBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 12,
    padding: 10,
    borderWidth: 1,
    borderColor: 'rgba(212, 185, 120, 0.35)',
    alignItems: 'center',
  },
  profileStatLabel: { color: COLORS.cream, fontSize: 9, fontWeight: '700', letterSpacing: 0.8 },
  profileStatVal: { color: COLORS.gold, fontSize: 15, fontWeight: '800', marginTop: 3 },
  pillNavContainer: {
    flexDirection: 'row',
    backgroundColor: COLORS.cream,
    borderRadius: 14,
    padding: 4,
    marginBottom: 16,
  },
  pillNavItem: { flex: 1, paddingVertical: 9, alignItems: 'center', borderRadius: 10 },
  pillNavItemActive: { backgroundColor: COLORS.navy },
  pillNavText: { color: COLORS.navy, fontSize: 12, fontWeight: '700' },
  pillNavTextActive: { color: COLORS.gold },
  inputLabel: { color: COLORS.navy, fontSize: 12, fontWeight: '700', marginTop: 6, marginBottom: 4 },
  quickDateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  quickDateChip: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#D8D2C5',
  },
  quickDateChipActive: { backgroundColor: COLORS.navy, borderColor: COLORS.gold },
  quickDateChipText: { fontSize: 11, fontWeight: '600', color: COLORS.navy },
  quickDateChipTextActive: { color: COLORS.gold },
  quickDateChipCalendar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 11,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  quickDateChipCalendarText: { fontSize: 11, fontWeight: '700', color: COLORS.gold },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 8 },
  choiceChip: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 13,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#D8D2C5',
  },
  choiceChipSelected: { backgroundColor: COLORS.navy, borderColor: COLORS.gold },
  choiceChipText: { color: COLORS.navy, fontSize: 12, fontWeight: '600' },
  choiceChipTextSelected: { color: COLORS.gold, fontWeight: '700' },
  prioritySwitchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  pdfExportTouchBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: COLORS.navy,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    borderRadius: 10,
  },
  pdfExportTouchBtnText: { color: COLORS.gold, fontSize: 11, fontWeight: '800' },
  iconActionBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  daysRemainingBadge: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  daysRemainingText: { color: COLORS.navy, fontSize: 11, fontWeight: '700' },

  // --- SMART EMPTY STATE ---
  emptyWatermarkContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 26,
    position: 'relative',
  },
  watermarkIcon: {
    position: 'absolute',
  },
  emptyText: { color: COLORS.silver, fontSize: 13, textAlign: 'center', paddingVertical: 6 },
  emptyStateActionBtn: {
    marginTop: 8,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  emptyStateActionText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },

  // --- CLEAN FLOATING ACTION BUTTON (FAB) ---
  fabContainerPos: {
    position: 'absolute',
    right: 18,
    bottom: 18,
    zIndex: 40,
  },
  fabButton: {
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 13,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    overflow: 'hidden',
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  fabButtonText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0.4,
  },

  // --- BOTTOM NAVIGATION & DRAWER ---
  bottomTabBar: {
    flexDirection: 'row',
    backgroundColor: COLORS.navy,
    borderTopWidth: 1.5,
    borderTopColor: COLORS.gold,
    paddingVertical: 8,
  },
  bottomTabItem: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  bottomTabLabel: { color: COLORS.silver, fontSize: 10, marginTop: 3, fontWeight: '600' },
  bottomTabLabelActive: { color: COLORS.gold, fontWeight: '800' },
  trashTabBadge: {
    position: 'absolute',
    right: -10,
    top: -4,
    backgroundColor: COLORS.gold,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trashTabBadgeText: { color: COLORS.navy, fontSize: 10, fontWeight: '800' },
  drawerOverlay: { flex: 1, flexDirection: 'row', backgroundColor: 'rgba(5, 19, 41, 0.6)' },
  drawerContainer: {
    width: 280,
    backgroundColor: COLORS.ivory,
    height: '100%',
    borderRightWidth: 2,
    borderRightColor: COLORS.gold,
  },
  drawerHeader: {
    backgroundColor: COLORS.navy,
    padding: 22,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.gold,
    overflow: 'hidden',
  },
  drawerTitle: {
    color: COLORS.white,
    fontSize: 19,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
    marginTop: 6,
  },
  drawerSub: { color: COLORS.cream, fontSize: 12, marginTop: 2 },
  drawerNavItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: COLORS.cream,
  },
  drawerNavItemActive: { backgroundColor: COLORS.navy, borderWidth: 1, borderColor: COLORS.gold },
  drawerNavText: { color: COLORS.navy, fontSize: 14, fontWeight: '700' },
  drawerNavTextActive: { color: COLORS.gold },
  drawerDivider: { height: 1, backgroundColor: '#D8D2C5', marginVertical: 8 },

  // --- FULL-SCREEN MODALS & MASTER FILTER BAR ---
  fullScreenModalSafe: {
    flex: 1,
    backgroundColor: COLORS.ivory,
  },
  fullScreenModalHeader: {
    backgroundColor: COLORS.navy,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.gold,
    overflow: 'hidden',
  },
  fullScreenModalTitle: {
    color: COLORS.white,
    fontSize: 20,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
  },
  fullScreenCloseBtn: {
    padding: 5,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  fullScreenModalToolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 4,
  },
  masterFilterSection: {
    backgroundColor: COLORS.white,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },

  // --- MODALS, BOTTOM ACTION SHEET & CALENDAR ---
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(5, 19, 41, 0.6)', justifyContent: 'center', padding: 18 },
  bottomSheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(5, 19, 41, 0.55)',
    justifyContent: 'flex-end',
  },
  bottomContextSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 22,
    paddingTop: 12,
    paddingBottom: 28,
    borderTopWidth: 2,
    borderTopColor: COLORS.gold,
    alignItems: 'center',
  },
  bottomSheetPill: {
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.border,
    marginBottom: 12,
  },
  calendarPortalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 19, 41, 0.65)',
    justifyContent: 'center',
    padding: 18,
    zIndex: 9999,
    elevation: 20,
  },
  modalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: 20,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 6,
  },
  modalBtnRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 14 },
  contextSheetHeader: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
    textAlign: 'center',
  },
  contextDivider: { height: 1, backgroundColor: COLORS.cream, width: '100%', marginVertical: 12 },
  contextOptionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2EFE9',
  },
  contextOptionText: { color: COLORS.navy, fontSize: 15, fontWeight: '700' },
  calendarHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  calendarMonthTitle: {
    color: COLORS.navy,
    fontSize: 16,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
  },
  calendarWeekRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
    paddingBottom: 6,
  },
  calendarWeekText: { width: '14.28%', textAlign: 'center', color: COLORS.silver, fontSize: 12, fontWeight: '700' },
  calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  calendarDayCell: { width: '14.28%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 8 },
  calendarDayToday: { borderWidth: 1, borderColor: COLORS.gold, backgroundColor: COLORS.cream },
  calendarDaySelected: { backgroundColor: COLORS.navy },
  calendarDayText: { color: COLORS.charcoal, fontSize: 14, fontWeight: '600' },
  calendarDayTextToday: { color: COLORS.navy, fontWeight: '800' },
  calendarDayTextSelected: { color: COLORS.gold, fontWeight: '800' },
});
