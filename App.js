// ==========================================
// PART 1 OF 2
// ==========================================
import React, { Component, useState, useEffect, useRef, useMemo, useCallback } from 'react';
const { chunkArray, isWithinLastTwoLocalMonths } = require('./utils/appHelpers');
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
  AppState,
} from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import * as Updates from 'expo-updates';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  initializeAuth,
  getAuth,
  getReactNativePersistence,
  onAuthStateChanged,
  signInAnonymously,
} from 'firebase/auth';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  getFirestore,
  collection,
  doc,
  addDoc,
  updateDoc,
  setDoc,
  getDocFromServer,
  serverTimestamp,
  deleteField,
  runTransaction,
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
  // This must come from the EAS environment; do not silently ship a stale key.
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || '',
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "jsm-app-cde22.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "jsm-app-cde22",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "jsm-app-cde22.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "78588387738",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:78588387738:web:f07509bb2e37a751b0da23",
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const auth = (() => {
  try {
    return initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) });
  } catch (e) {
    return getAuth(app);
  }
})();
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
  success: '#166534',
  successBg: '#DCFCE7',
  liveGreen: '#22C55E',
  offlineRed: '#EF4444',
  syncAmber: '#F59E0B',
  warning: '#9A3412',
  warningBg: '#FFEDD5',
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
const safeString = (val, fallback = '') => {
  if (val === null || val === undefined) return fallback;
  const str = String(val);
  return str.trim() === '' && fallback !== '' ? fallback : str;
};

const safeNumber = (val, fallback = 0) => {
  if (val === null || val === undefined || val === '') return fallback;
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
};

const timestampToMillis = (value, fallback = 0) => {
  if (value && typeof value.toMillis === 'function') {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : fallback;
  }
  return safeNumber(value, fallback);
};

const getInitials = (nameStr) => {
  const clean = safeString(nameStr).trim();
  if (!clean) return '?';
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
};

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

const shiftISODate = (isoDateStr, deltaDays) => {
  const norm = normalizeISODate(isoDateStr);
  const base = norm ? new Date(norm.split('-').map(Number)[0], norm.split('-').map(Number)[1] - 1, norm.split('-').map(Number)[2]) : new Date();
  base.setDate(base.getDate() + deltaDays);
  return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`;
};

const sanitizeDocRecord = (id, raw = {}, hasPendingWrites = false, colName = '') => {
  const data = raw && typeof raw === 'object' ? raw : {};
  const isDeleted = Boolean(data.isDeleted);
  const rawDate = safeString(data.date);
  const rawJoinedDate = safeString(data.joinedDate);
  const rawDateISO = safeString(data.dateISO);

  const base = {
    ...data,
    id: safeString(id),
    timestamp: timestampToMillis(data.timestamp, 0),
    deletedAt: isDeleted
      ? timestampToMillis(data.deletedAt, timestampToMillis(data.timestamp, 0) || Date.now())
      : data.deletedAt
      ? timestampToMillis(data.deletedAt, null)
      : null,
    isDeleted,
    _pendingSync: Boolean(hasPendingWrites),
  };

  if (colName === 'subjects') {
    return {
      ...base,
      name: safeString(data.name),
      order: safeNumber(data.order, 999),
    };
  }
  if (colName === 'students') {
    return {
      ...base,
      name: safeString(data.name),
      subjectId: safeString(data.subjectId),
      phone: safeString(data.phone),
      guardian: safeString(data.guardian),
      joinedDate: normalizeISODate(rawJoinedDate) || rawJoinedDate,
      notes: safeString(data.notes),
      priorityNote: Boolean(data.priorityNote),
    };
  }
  if (colName === 'lessons') {
    return {
      ...base,
      studentId: safeString(data.studentId),
      date: normalizeISODate(rawDate) || rawDate,
      technique: safeString(data.technique),
      lesson: safeString(data.lesson),
      repertoire: safeString(data.repertoire),
      assignment: safeString(data.assignment),
    };
  }
  if (colName === 'attendance') {
    return {
      ...base,
      studentId: safeString(data.studentId),
      date: normalizeISODate(rawDate) || rawDate,
      status: safeString(data.status, 'Present'),
      remarks: safeString(data.remarks),
    };
  }
  if (colName === 'fees') {
    return {
      ...base,
      studentId: safeString(data.studentId),
      date: normalizeISODate(rawDate) || rawDate,
      feeType: safeString(data.feeType, 'Monthly Fee'),
      monthPaidFor: safeString(data.monthPaidFor),
      mode: safeString(data.mode, 'UPI'),
      status: safeString(data.status, 'Paid'),
      amountPaid: safeNumber(data.amountPaid, 0),
      balanceDue: safeNumber(data.balanceDue, 0),
      remarks: safeString(data.remarks),
    };
  }
  if (colName === 'activities') {
    return {
      ...base,
      title: safeString(data.title),
      subtitle: safeString(data.subtitle),
      dateISO: normalizeISODate(rawDateISO) || rawDateISO,
    };
  }
  return base;
};

const withWriteTimeout = (promise, ms = 15000) => {
  let timerId;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const error = new Error('The save is taking longer than expected. Check your connection before retrying.');
      error.code = 'jsm/write-timeout';
      reject(error);
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeoutPromise]).finally(() => clearTimeout(timerId));
};

const createStableDocument = async (collectionName, fields, pendingWriteRef) => {
  const signature = JSON.stringify(fields);
  let pendingWrite = pendingWriteRef.current;

  if (pendingWrite?.settled) {
    const completedRef = doc(db, collectionName, pendingWrite.id);
    pendingWriteRef.current = null;
    if (pendingWrite.signature === signature) return completedRef;
    pendingWrite = null;
  }

  if (pendingWrite && pendingWrite.signature !== signature) {
    const error = new Error('A previous save is still awaiting confirmation. Retry it with the same details first.');
    error.code = 'jsm/write-pending';
    throw error;
  }

  if (!pendingWrite) {
    pendingWrite = {
      id: doc(collection(db, collectionName)).id,
      signature,
      settled: false,
    };
    pendingWriteRef.current = pendingWrite;
  }

  const pendingId = pendingWrite.id;
  const documentRef = doc(db, collectionName, pendingId);
  const writePromise = setDoc(documentRef, {
    ...fields,
    timestamp: serverTimestamp(),
    isDeleted: false,
    deletedAt: null,
  });
  const markPendingWriteSettled = () => {
    if (pendingWriteRef.current?.id === pendingId) pendingWriteRef.current.settled = true;
  };
  const clearRejectedWrite = () => {
    if (pendingWriteRef.current?.id === pendingId) pendingWriteRef.current = null;
  };

  // The timeout only changes what the UI awaits; Firestore may still finish the write.
  // Keep the ID until that original write settles so a retry cannot create a second doc.
  writePromise.then(markPendingWriteSettled, clearRejectedWrite);
  await withWriteTimeout(writePromise);
  if (pendingWriteRef.current?.id === pendingId) pendingWriteRef.current = null;
  return documentRef;
};

const getOffsetDateISO = (daysOffset = 0) => {
  const d = new Date();
  d.setDate(d.getDate() + daysOffset);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const getTodayISO = () => getOffsetDateISO(0);

const getLocalCurrentMonthLabel = () => `${MONTHS_FULL[new Date().getMonth()]} ${new Date().getFullYear()}`;

const getSelectableMonthsList = (currentVal = '') => {
  const list = [];
  const now = new Date();
  for (let offset = -6; offset <= 5; offset++) {
    const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
    list.push(`${MONTHS_FULL[d.getMonth()]} ${d.getFullYear()}`);
  }
  if (currentVal && !list.includes(currentVal)) {
    list.unshift(currentVal);
  }
  return list;
};

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

const parseMonthYearSortKey = (label) => {
  const parts = safeString(label).trim().split(' ');
  if (parts.length !== 2) return 0;
  const mIdx = MONTHS_FULL.indexOf(parts[0]);
  const year = parseInt(parts[1], 10);
  if (mIdx === -1 || isNaN(year)) return 0;
  return year * 12 + mIdx;
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
  if (!cleaned) return '';
  const parts = cleaned.split('.');
  const intPart = parts[0].replace(/^0+(?=\d)/, '') || (parts.length > 1 ? '0' : '');
  return parts.length <= 1 ? intPart : `${intPart}.${parts.slice(1).join('').slice(0, 2)}`;
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
  for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
    const batch = writeBatch(db);
    entries.slice(i, i + CHUNK_SIZE).forEach((entry) => {
      const update = {
        isDeleted: true,
        deletedAt: serverTimestamp(),
        deletedWithParentId: entry.deletedWithParentId || deleteField(),
      };
      batch.update(doc(db, entry.col, entry.id), update);
    });
    await withWriteTimeout(batch.commit());
  }
};

// ==========================================
// 4. REUSABLE AESTHETIC & MICRO-INTERACTION COMPONENTS
// ==========================================
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

const ScalePressable = ({ children, onPress, onLongPress, delayLongPress = 280, style, disabled = false }) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(() => {
    Animated.spring(scaleAnim, {
      toValue: 0.97,
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

const DropdownField = ({ label, valueLabel, onPress, style, compact = false }) => (
  <TouchableOpacity
    activeOpacity={0.75}
    style={[styles.dropdownField, compact && styles.dropdownFieldCompact, style]}
    onPress={() => {
      Keyboard.dismiss();
      triggerHaptic(8);
      onPress();
    }}
  >
    <View style={{ flex: 1, paddingRight: 8 }}>
      {label ? <Text style={styles.dropdownFloatingLabel}>{label}</Text> : null}
      <Text style={[styles.dropdownValueText, compact && { fontSize: 13 }]} numberOfLines={1}>
        {valueLabel || 'Select...'}
      </Text>
    </View>
    <Ionicons name="chevron-down-outline" size={18} color={COLORS.navy} />
  </TouchableOpacity>
);

const EmptyStateWatermark = ({ message, compact = false, actionLabel, onAction }) => (
  <View style={[styles.emptyWatermarkContainer, compact && { paddingVertical: 14, minHeight: 56 }]}>
    <MaterialCommunityIcons
      name="music-clef-treble"
      size={compact ? 44 : 72}
      color="rgba(12, 45, 87, 0.055)"
      style={styles.watermarkIcon}
    />
    {message ? <Text style={styles.emptyText}>{message}</Text> : null}
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
  componentDidCatch(error, info) {
    console.error('[JSM] Unhandled render error:', error, info?.componentStack || '');
  }
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
  const isFirstRender = useRef(true);
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
        outputRange: [0.85, 1, 0.85],
        extrapolate: 'clamp',
      }),
    [dragX]
  );

  useEffect(() => {
    dragX.stopAnimation(() => dragX.setValue(0));
    if (isFirstRender.current) {
      isFirstRender.current = false;
      fadeAnim.setValue(1);
      slideAnim.setValue(0);
      return;
    }
    fadeAnim.setValue(0);
    slideAnim.setValue(direction * 28);

    const anim = Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 220,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 220,
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
  const pendingSubjectWriteRef = useRef(null);
  const pendingStudentWriteRef = useRef(null);
  const pendingLessonWriteRef = useRef(null);
  const pendingFeeWriteRef = useRef(null);
  const pendingSettlementWritesRef = useRef(new Map());
  const isMountedRef = useRef(true);
  const pendingTimeoutsRef = useRef([]);
  const purgingIdsRef = useRef(new Set());
  const loadedColsRef = useRef({
    subjects: false,
    students: false,
    lessons: false,
    attendance: false,
    fees: false,
  });

  const [isNetworkOnline, setIsNetworkOnline] = useState(true);
  const isNetworkOnlineRef = useRef(true);
  const [pendingSyncByCol, setPendingSyncByCol] = useState({});

  const [masterListModal, setMasterListModal] = useState(false);
  const [masterStudentFilter, setMasterStudentFilter] = useState('ALL');
  const [masterMonthFilter, setMasterMonthFilter] = useState('ALL');
  const [masterDateFilter, setMasterDateFilter] = useState('');

  const [studentReportModal, setStudentReportModal] = useState({
    visible: false,
    studentId: null,
    dateFilter: '',
  });

  // Overhauled Register View States (Students, Attendance Roster, Fees Bank Ledger)
  const [searchBarVisible, setSearchBarVisible] = useState(false);
  const [studentSearch, setStudentSearch] = useState('');
  const [studentFilter, setStudentFilter] = useState('All');
  const [collapsedSubjects, setCollapsedSubjects] = useState({});
  const [studentDisplayLimit, setStudentDisplayLimit] = useState(50);
  const [attendanceHistoryLimit, setAttendanceHistoryLimit] = useState(50);
  const [trashDisplayLimit, setTrashDisplayLimit] = useState(50);

  const [attendanceViewMode, setAttendanceViewMode] = useState('Roster'); // 'Roster' | 'History'
  const [rosterDate, setRosterDate] = useState(getTodayISO());
  const [collapsedRosterSubjects, setCollapsedRosterSubjects] = useState({});

  const [feeLedgerTab, setFeeLedgerTab] = useState('Pending'); // 'Pending' | 'History'
  const [feeDisplayLimit, setFeeDisplayLimit] = useState(50);
  const [feeSearchVisible, setFeeSearchVisible] = useState(false);
  const [feeSearchQuery, setFeeSearchQuery] = useState('');

  // Progressive disclosure toggles for optional Note / Remarks fields
  const [showInlineAttNote, setShowInlineAttNote] = useState(false);
  const [showModalAttNote, setShowModalAttNote] = useState(false);
  const [showFeeNote, setShowFeeNote] = useState(false);

  // Reusable Dropdown Picker Portal State
  const [dropdownPicker, setDropdownPicker] = useState({
    visible: false,
    title: '',
    options: [],
    selectedValue: null,
    onSelect: null,
  });

  const closeDropdownPicker = useCallback(() => {
    setDropdownPicker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const openDropdownPicker = useCallback((title, options, selectedValue, onSelect) => {
    Keyboard.dismiss();
    triggerHaptic(8);
    setDropdownPicker({
      visible: true,
      title,
      options,
      selectedValue,
      onSelect,
    });
  }, []);

  const toggleSubjectGroup = useCallback((subjId) => {
    triggerHaptic(6);
    triggerLayoutAnimation();
    setCollapsedSubjects((prev) => ({ ...prev, [subjId]: !prev[subjId] }));
  }, []);

  const toggleRosterSubjectGroup = useCallback((subjId) => {
    triggerHaptic(6);
    triggerLayoutAnimation();
    setCollapsedRosterSubjects((prev) => ({ ...prev, [subjId]: !prev[subjId] }));
  }, []);

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
    let appStateCurrent = AppState.currentState;

    const verifyConnection = async () => {
      if (!active || !isMountedRef.current || appStateCurrent !== 'active') return;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);
      try {
        await fetch('https://clients3.google.com/generate_204', {
          method: 'HEAD',
          cache: 'no-store',
          signal: controller.signal,
        });
        if (active && isMountedRef.current) {
          isNetworkOnlineRef.current = true;
          setIsNetworkOnline(true);
        }
      } catch (e) {
        if (active && isMountedRef.current) {
          isNetworkOnlineRef.current = false;
          setIsNetworkOnline(false);
        }
      } finally {
        clearTimeout(timeoutId);
      }
    };

    verifyConnection();
    const intervalId = setInterval(verifyConnection, 10000);
    const appStateSub = AppState.addEventListener('change', (nextState) => {
      appStateCurrent = nextState;
      if (nextState === 'active') verifyConnection();
    });

    return () => {
      active = false;
      clearInterval(intervalId);
      appStateSub.remove();
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
  const [activityLogError, setActivityLogError] = useState('');
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
  const inlineLessonDraftVersionRef = useRef(0);
  const inlineAttendanceDraftVersionRef = useRef(0);
  const updateInlineLessonForm = useCallback((next) => {
    inlineLessonDraftVersionRef.current += 1;
    setInlineLessonForm((previous) => (typeof next === 'function' ? next(previous) : next));
  }, []);
  const updateInlineAttendanceForm = useCallback((next) => {
    inlineAttendanceDraftVersionRef.current += 1;
    setInlineAttendanceForm((previous) => (typeof next === 'function' ? next(previous) : next));
  }, []);
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

  const [orderedSubjects, setOrderedSubjects] = useState([]);
  const [draggingSubjectId, setDraggingSubjectId] = useState(null);
  const [subjectScrollLocked, setSubjectScrollLocked] = useState(false);
  const dragSubjectY = useRef(new Animated.Value(0)).current;
  const dragInfoRef = useRef({
    active: false,
    subjectId: null,
    startIdx: 0,
    currentIdx: 0,
    initialTranslationY: 0,
    list: [],
  });

  const activeTabRef = useRef(activeTab);
  const selectedStudentIdRef = useRef(selectedStudentId);
  const profileTabRef = useRef(profileTab);
  const orderedSubjectsRef = useRef(orderedSubjects);
  const activeSubjectsRef = useRef([]);

  useEffect(() => {
    activeTabRef.current = activeTab;
  }, [activeTab]);
  useEffect(() => {
    selectedStudentIdRef.current = selectedStudentId;
  }, [selectedStudentId]);
  useEffect(() => {
    profileTabRef.current = profileTab;
  }, [profileTab]);
  useEffect(() => {
    orderedSubjectsRef.current = orderedSubjects;
  }, [orderedSubjects]);
  useEffect(() => {
    pendingSettlementWritesRef.current.forEach((pending, feeId) => {
      const currentRecord = fees.find((record) => record.id === feeId);
      if (pending.settled && currentRecord && safeNumber(currentRecord.balanceDue, 0) > 0) {
        pendingSettlementWritesRef.current.delete(feeId);
      }
    });
  }, [fees]);

  const closeCalendarPicker = useCallback(() => {
    setCalendarPicker((prev) => (prev.visible ? { ...prev, visible: false } : prev));
  }, []);

  const openCalendarPicker = useCallback((currentDateStr, onSelectCallback) => {
    const norm = normalizeISODate(currentDateStr) || getTodayISO();
    const parts = norm.split('-');
    const y = parseInt(parts[0], 10) || new Date().getFullYear();
    const m = (parseInt(parts[1], 10) || 1) - 1;
    setCalendarPicker({ visible: true, selectedDate: norm, viewYear: y, viewMonth: m, onSelect: onSelectCallback });
  }, []);

  const closeSubjectsModalClean = useCallback(() => {
    Keyboard.dismiss();
    dragInfoRef.current.active = false;
    setSubjectScrollLocked(false);
    setDraggingSubjectId(null);
    setSubjectForm({ id: null, name: '' });
    setSubjectsModal(false);
  }, []);

  const closeContextMenu = useCallback(() => {
    setContextMenu({
      visible: false,
      entityType: null,
      item: null,
      title: '',
      reopenSubjectsModal: false,
      reopenTodayLogModal: false,
    });
  }, []);

  const dismissContextMenuWithReopen = useCallback(() => {
    const shouldReopenSubj = contextMenu.reopenSubjectsModal;
    const shouldReopenLog = contextMenu.reopenTodayLogModal;
    closeContextMenu();
    if (shouldReopenSubj) scheduleTimeout(() => setSubjectsModal(true), 220);
    if (shouldReopenLog) scheduleTimeout(() => setTodayLogModal(true), 220);
  }, [contextMenu.reopenSubjectsModal, contextMenu.reopenTodayLogModal, closeContextMenu, scheduleTimeout]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (dropdownPicker.visible) {
        closeDropdownPicker();
        return true;
      }
      if (calendarPicker.visible) {
        closeCalendarPicker();
        return true;
      }
      if (contextMenu.visible) {
        dismissContextMenuWithReopen();
        return true;
      }
      if (studentReportModal.visible) {
        setStudentReportModal({ visible: false, studentId: null, dateFilter: '' });
        return true;
      }
      if (studentModal) {
        setStudentModal(false);
        return true;
      }
      if (lessonEditModal) {
        setLessonEditModal(false);
        return true;
      }
      if (attendanceModal) {
        setAttendanceModal(false);
        return true;
      }
      if (feeModal) {
        setFeeModal(false);
        return true;
      }
      if (subjectsModal) {
        closeSubjectsModalClean();
        return true;
      }
      if (noticeEditModal) {
        setNoticeEditModal(false);
        return true;
      }
      if (todayLogModal) {
        setTodayLogModal(false);
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
      if (activeTab === 'Students' && !selectedStudentId && (searchBarVisible || studentSearch.length > 0)) {
        triggerLayoutAnimation();
        setSearchBarVisible(false);
        setStudentSearch('');
        return true;
      }
      if (activeTab === 'Fees' && (feeSearchVisible || feeSearchQuery.length > 0)) {
        triggerLayoutAnimation();
        setFeeSearchVisible(false);
        setFeeSearchQuery('');
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
  }, [
    activeTab,
    selectedStudentId,
    searchBarVisible,
    studentSearch,
    feeSearchVisible,
    feeSearchQuery,
    dropdownPicker.visible,
    calendarPicker.visible,
    contextMenu.visible,
    studentReportModal.visible,
    studentModal,
    lessonEditModal,
    attendanceModal,
    feeModal,
    subjectsModal,
    noticeEditModal,
    todayLogModal,
    masterListModal,
    drawerOpen,
    closeDropdownPicker,
    closeCalendarPicker,
    dismissContextMenuWithReopen,
    closeSubjectsModalClean,
    closeDrawer,
  ]);

const [authUid, setAuthUid] = useState(null);
  const [authStatusText, setAuthStatusText] = useState('Signing in...');

  useEffect(() => {
    if (!firebaseConfig.apiKey) {
      setAuthStatusText('Missing EXPO_PUBLIC_FIREBASE_API_KEY');
      return;
    }
    const unsubAuth = onAuthStateChanged(auth, (user) => {
      if (!isMountedRef.current) return;
      if (user) {
        setAuthUid(user.uid);
        setAuthStatusText(`UID: ${user.uid}`);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error('[JSM] Anonymous sign-in failed:', error);
          if (isMountedRef.current) {
            setAuthStatusText(`Auth Error: ${error?.code || 'Sign-in failed'}`);
          }
        });
      }
    });
    return () => unsubAuth();
  }, []);

  // Real-Time Firestore Listeners
  useEffect(() => {
    if (!authUid) return;
    const timer = setTimeout(() => {
      initialLoadDone.current = true;
    }, 1000);

    const handleSnapshot = (colName, snapshot, setter) => {
      if (!isMountedRef.current) return;
      const serverConfirmed =
        snapshot.metadata?.fromCache === false && snapshot.metadata?.hasPendingWrites === false;
      loadedColsRef.current[colName] = serverConfirmed;
      const records = [];
      const hasPending = Boolean(snapshot.metadata?.hasPendingWrites);
      setPendingSyncByCol((prev) =>
        prev[colName] === hasPending ? prev : { ...prev, [colName]: hasPending }
      );

      snapshot.forEach((docSnap) => {
        const clean = sanitizeDocRecord(docSnap.id, docSnap.data(), docSnap.metadata?.hasPendingWrites, colName);
        // Keep cached/pending records visible; never permanently delete data from an
        // incomplete snapshot. Trash is purged only through an explicit user action.
        records.push(clean);
      });
      if (initialLoadDone.current) triggerLayoutAnimation();
      setter(records);
    };

    const unsubSubjects = onSnapshot(
      collection(db, 'subjects'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshot('subjects', snap, setSubjects),
      (error) => console.error('[JSM] Firestore listener failed (subjects):', error)
    );
    const unsubStudents = onSnapshot(
      collection(db, 'students'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshot('students', snap, setStudents),
      (error) => console.error('[JSM] Firestore listener failed (students):', error)
    );
    const unsubLessons = onSnapshot(
      collection(db, 'lessons'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshot('lessons', snap, setLessons),
      (error) => console.error('[JSM] Firestore listener failed (lessons):', error)
    );
    const unsubAttendance = onSnapshot(
      collection(db, 'attendance'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshot('attendance', snap, setAttendance),
      (error) => console.error('[JSM] Firestore listener failed (attendance):', error)
    );
    const unsubFees = onSnapshot(
      collection(db, 'fees'),
      { includeMetadataChanges: true },
      (snap) => handleSnapshot('fees', snap, setFees),
      (error) => console.error('[JSM] Firestore listener failed (fees):', error)
    );
    const unsubActivities = onSnapshot(
      collection(db, 'activities'),
      { includeMetadataChanges: true },
      (snap) => {
        if (!isMountedRef.current) return;
        setActivityLogError('');
        const list = [];
        const hasPending = Boolean(snap.metadata?.hasPendingWrites);
        setPendingSyncByCol((prev) =>
          prev.activities === hasPending ? prev : { ...prev, activities: hasPending }
        );
        snap.forEach((d) => {
          const clean = sanitizeDocRecord(d.id, d.data(), d.metadata?.hasPendingWrites, 'activities');
          list.push(clean);
        });
        list.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
        if (initialLoadDone.current) triggerLayoutAnimation();
        setActivities(list);
      },
      (error) => {
        console.error('[JSM] Firestore listener failed (activities):', error);
        setActivityLogError(`Could not read activity log (${error?.code || 'unknown error'}).`);
      }
    );
    const unsubNotice = onSnapshot(
      doc(db, 'settings', 'noticeBoard'),
      { includeMetadataChanges: true },
      (docSnap) => {
        if (!isMountedRef.current) return;
        const hasPending = Boolean(docSnap.metadata?.hasPendingWrites);
        setPendingSyncByCol((prev) =>
          prev.notice === hasPending ? prev : { ...prev, notice: hasPending }
        );
        if (docSnap.exists()) {
          const d = docSnap.data() || {};
          setNoticeText(safeString(d.text));
          setNoticeUpdatedAt(safeString(d.updatedDate));
        } else {
          setNoticeText('');
          setNoticeUpdatedAt('');
        }
      },
      (error) => console.error('[JSM] Firestore listener failed (noticeBoard):', error)
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
  }, [authUid]);

  // Cross-collection orphan cleanup after initial load of all collections
  useEffect(() => {
    const { students: stLoaded, lessons: lLoaded, attendance: aLoaded, fees: fLoaded } = loadedColsRef.current;
    if (!stLoaded || !lLoaded || !aLoaded || !fLoaded) return;
    const validStudentIds = new Set(students.map((s) => s.id));
    const purgeOrphan = (colName, id, studentId) => {
      const key = `${colName}/${id}`;
      if (purgingIdsRef.current.has(key)) return;
      purgingIdsRef.current.add(key);
      runTransaction(db, async (transaction) => {
        const childRef = doc(db, colName, id);
        const childSnapshot = await transaction.get(childRef);
        if (!childSnapshot.exists() || childSnapshot.data()?.studentId !== studentId) return;
        const parentSnapshot = await transaction.get(doc(db, 'students', studentId));
        if (!parentSnapshot.exists()) transaction.delete(childRef);
      })
        .catch((error) => console.error(`[JSM] Orphan check failed (${colName}/${id}):`, error))
        .finally(() => {
        purgingIdsRef.current.delete(key);
      });
    };
    lessons.forEach((l) => {
      if (l.studentId && !validStudentIds.has(l.studentId)) purgeOrphan('lessons', l.id, l.studentId);
    });
    attendance.forEach((a) => {
      if (a.studentId && !validStudentIds.has(a.studentId)) purgeOrphan('attendance', a.id, a.studentId);
    });
    fees.forEach((f) => {
      if (f.studentId && !validStudentIds.has(f.studentId)) purgeOrphan('fees', f.id, f.studentId);
    });
  }, [students, lessons, attendance, fees]);

  const hasAnyPendingWrites = useMemo(
    () => Object.values(pendingSyncByCol).some(Boolean),
    [pendingSyncByCol]
  );

  const logActivity = useCallback((actionTitle, subtitle) => {
    try {
      addDoc(collection(db, 'activities'), {
        title: safeString(actionTitle),
        subtitle: safeString(subtitle),
        dateISO: getTodayISO(),
        // Keep this numeric for compatibility with the existing Firestore rules.
        timestamp: Date.now(),
        isDeleted: false,
        deletedAt: null,
      })
        .then(() => setActivityLogError(''))
        .catch((error) => {
          console.error('[JSM] Activity log write failed:', error);
          setActivityLogError(`Could not save activity (${error?.code || 'unknown error'}).`);
        });
    } catch (error) {
      console.error('[JSM] Activity log setup failed:', error);
      setActivityLogError(`Could not save activity (${error?.code || 'unknown error'}).`);
    }
  }, []);

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
        .sort(
          (a, b) =>
            safeString(b.date).localeCompare(safeString(a.date)) ||
            (b.timestamp || 0) - (a.timestamp || 0) ||
            safeString(b.id).localeCompare(safeString(a.id))
        ),
    [lessons, studentMap]
  );
  const activeAttendance = useMemo(
    () =>
      attendance
        .filter((a) => !a.isDeleted && studentMap[a.studentId] && !studentMap[a.studentId].isDeleted)
        .sort(
          (a, b) =>
            safeString(b.date).localeCompare(safeString(a.date)) ||
            (b.timestamp || 0) - (a.timestamp || 0) ||
            safeString(b.id).localeCompare(safeString(a.id))
        ),
    [attendance, studentMap]
  );
  const activeFees = useMemo(
    () =>
      fees
        .filter((f) => !f.isDeleted && studentMap[f.studentId] && !studentMap[f.studentId].isDeleted)
        .sort(
          (a, b) =>
            safeString(b.date).localeCompare(safeString(a.date)) ||
            (b.timestamp || 0) - (a.timestamp || 0) ||
            safeString(b.id).localeCompare(safeString(a.id))
        ),
    [fees, studentMap]
  );
  const activeActivities = useMemo(() => activities.filter((a) => !a.isDeleted), [activities]);

  // O(1) Lookup Map for Daily Roster Attendance by selected `rosterDate`
  const rosterAttendanceByStudent = useMemo(() => {
    const map = {};
    const targetDate = normalizeISODate(rosterDate) || getTodayISO();
    activeAttendance.forEach((a) => {
      if (a.date === targetDate && !map[a.studentId]) {
        map[a.studentId] = a;
      }
    });
    return map;
  }, [activeAttendance, rosterDate]);

  const getNewAttendanceDocumentId = useCallback(
    (studentId, date) => {
      const baseId = `${studentId}_${date}`;
      if (!attendance.some((record) => record.id === baseId)) return baseId;
      let version = 1;
      while (attendance.some((record) => record.id === `${baseId}_v${version}`)) version += 1;
      return `${baseId}_v${version}`;
    },
    [attendance]
  );

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

  const availableMasterMonths = useMemo(() => {
    const monthSet = new Set([getLocalCurrentMonthLabel()]);
    activeLessons.forEach((l) => {
      if (l.date) monthSet.add(getMonthYearFromISO(l.date));
    });
    activeAttendance.forEach((a) => {
      if (a.date) monthSet.add(getMonthYearFromISO(a.date));
    });
    activeFees.forEach((f) => {
      if (f.feeType === 'Monthly Fee' && f.monthPaidFor) {
        monthSet.add(f.monthPaidFor);
      }
      if (f.date) monthSet.add(getMonthYearFromISO(f.date));
    });
    return Array.from(monthSet)
      .filter((m) => m && m !== 'Unknown Month')
      .sort((a, b) => parseMonthYearSortKey(b) - parseMonthYearSortKey(a));
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
      ].sort((a, b) => timestampToMillis(b.deletedAt, 0) - timestampToMillis(a.deletedAt, 0)),
    [subjects, students, lessons, attendance, fees, activities, studentMap]
  );

  const selectedStudent = useMemo(
    () => activeStudents.find((s) => s.id === selectedStudentId) || null,
    [activeStudents, selectedStudentId]
  );

  useEffect(() => {
    if (selectedStudentId && !activeStudents.some((s) => s.id === selectedStudentId)) {
      setSelectedStudentId(null);
    }
    if (
      studentReportModal.visible &&
      studentReportModal.studentId &&
      !activeStudents.some((s) => s.id === studentReportModal.studentId)
    ) {
      setStudentReportModal({ visible: false, studentId: null, dateFilter: '' });
    }
  }, [activeStudents, selectedStudentId, studentReportModal.visible, studentReportModal.studentId]);

  const prevNoteStudentIdRef = useRef(null);
  const noteBaseRef = useRef({ studentId: null, notes: '', priorityNote: false });
  useEffect(() => {
    if (selectedStudent && prevNoteStudentIdRef.current !== selectedStudent.id) {
      prevNoteStudentIdRef.current = selectedStudent.id;
      setNoteDraft(safeString(selectedStudent.notes));
      setPriorityDraft(Boolean(selectedStudent.priorityNote));
      noteBaseRef.current = {
        studentId: selectedStudent.id,
        notes: safeString(selectedStudent.notes),
        priorityNote: Boolean(selectedStudent.priorityNote),
      };
    } else if (!selectedStudent) {
      prevNoteStudentIdRef.current = null;
      noteBaseRef.current = { studentId: null, notes: '', priorityNote: false };
    }
  }, [selectedStudent]);

  useEffect(() => {
    updateInlineLessonForm({ date: getTodayISO(), technique: '', lesson: '', repertoire: '', assignment: '' });
    updateInlineAttendanceForm({ date: getTodayISO(), status: 'Present', remarks: '' });
    setShowInlineAttNote(false);
  }, [selectedStudentId, updateInlineLessonForm, updateInlineAttendanceForm]);

  // Memoized O(1) Student Metrics Map
  const studentMetricsMap = useMemo(() => {
    const map = {};
    activeStudents.forEach((st) => {
      map[st.id] = {
        classesTaken: 0,
        attendancePct: 'N/A',
        feeStatus: 'No Records',
        totalDue: 0,
        stLessons: [],
        stAttendance: [],
        stFees: [],
        hasPendingSync: Boolean(st._pendingSync),
      };
    });

    activeLessons.forEach((l) => {
      const bucket = map[l.studentId];
      if (bucket) {
        bucket.stLessons.push(l);
        if (l._pendingSync) bucket.hasPendingSync = true;
      }
    });

    activeAttendance.forEach((a) => {
      const bucket = map[a.studentId];
      if (bucket) {
        bucket.stAttendance.push(a);
        if (a._pendingSync) bucket.hasPendingSync = true;
      }
    });

    activeFees.forEach((f) => {
      const bucket = map[f.studentId];
      if (bucket) {
        bucket.stFees.push(f);
        if (f._pendingSync) bucket.hasPendingSync = true;
      }
    });

    Object.values(map).forEach((bucket) => {
      bucket.classesTaken = bucket.stLessons.length;
      const gradedAttendance = bucket.stAttendance.filter((a) => a.status !== 'Rescheduled');
      if (gradedAttendance.length > 0) {
        bucket.attendancePct = `${Math.round(
          (gradedAttendance.filter((a) => a.status === 'Present' || a.status === 'Tardy').length /
            gradedAttendance.length) *
            100
        )}%`;
      }
      if (bucket.stFees.length > 0) {
        let totalDue = 0;
        bucket.stFees.forEach((f) => {
          totalDue += safeNumber(f.balanceDue, 0);
        });
        bucket.totalDue = totalDue;
        bucket.feeStatus = bucket.stFees.some(
          (f) => f.status === 'Unpaid' || f.status === 'Partial' || safeNumber(f.balanceDue, 0) > 0
        )
          ? 'Due / Unpaid'
          : 'Paid';
      }
    });

    return map;
  }, [activeStudents, activeLessons, activeAttendance, activeFees]);

  const getStudentMetrics = useCallback(
    (studentId) =>
      studentMetricsMap[studentId] || {
        classesTaken: 0,
        attendancePct: 'N/A',
        feeStatus: 'No Records',
        totalDue: 0,
        stLessons: [],
        stAttendance: [],
        stFees: [],
        hasPendingSync: false,
      },
    [studentMetricsMap]
  );

  const studentReportData = useMemo(() => {
    const st = studentMap[studentReportModal.studentId];
    if (!st || st.isDeleted) return null;
    const df = studentReportModal.dateFilter;
    const matchDate = (iso) => (!df ? true : iso === df);
    const stLessons = activeLessons.filter((l) => l.studentId === st.id && matchDate(l.date));
    const stAtt = activeAttendance.filter((a) => a.studentId === st.id && matchDate(a.date));
    const stFees = activeFees.filter((f) => f.studentId === st.id && matchDate(f.date));
    const totalPaid = stFees.reduce((acc, f) => acc + safeNumber(f.amountPaid, 0), 0);
    const totalDue = stFees.reduce((acc, f) => acc + safeNumber(f.balanceDue, 0), 0);
    return {
      student: st,
      subjectName: safeString(subjectMap[st.subjectId]?.name, 'Unassigned'),
      stLessons,
      stAtt,
      stFees,
      totalPaid,
      totalDue,
    };
  }, [
    studentReportModal.studentId,
    studentReportModal.dateFilter,
    studentMap,
    subjectMap,
    activeLessons,
    activeAttendance,
    activeFees,
  ]);

  const printStudentReport = async () => {
    if (!studentReportData) return;
    triggerHaptic(12);
    const { student, subjectName, stLessons, stAtt, stFees, totalPaid, totalDue } = studentReportData;
    const periodLabel = studentReportModal.dateFilter
      ? formatReadableLocalDate(studentReportModal.dateFilter)
      : 'All Dates';

    const lessonsRows =
      stLessons.length === 0
        ? '<tr><td colspan="2">—</td></tr>'
        : stLessons
            .map(
              (l) => `
          <tr>
            <td style="width:110px;"><strong>${escapeHtml(formatReadableLocalDate(l.date))}</strong></td>
            <td>${escapeHtml(
              [
                l.lesson ? `Lesson: ${l.lesson}` : '',
                l.technique ? `Technique: ${l.technique}` : '',
                l.repertoire ? `Repertoire: ${l.repertoire}` : '',
                l.assignment ? `Assignment: ${l.assignment}` : '',
              ]
                .filter(Boolean)
                .join(' • ') || 'Logged'
            )}</td>
          </tr>`
            )
            .join('');

    const attRows =
      stAtt.length === 0
        ? '<tr><td colspan="3">—</td></tr>'
        : stAtt
            .map(
              (a) => `
          <tr>
            <td style="width:110px;"><strong>${escapeHtml(formatReadableLocalDate(a.date))}</strong></td>
            <td style="width:110px;">${escapeHtml(a.status)}</td>
            <td>${escapeHtml(a.remarks || '—')}</td>
          </tr>`
            )
            .join('');

    const feeRows =
      stFees.length === 0
        ? '<tr><td colspan="4">—</td></tr>'
        : stFees
            .map(
              (f) => `
          <tr>
            <td style="width:110px;"><strong>${escapeHtml(formatReadableLocalDate(f.date))}</strong></td>
            <td>${escapeHtml(f.feeType)}${
                f.feeType === 'Monthly Fee' && f.monthPaidFor ? ` (${escapeHtml(f.monthPaidFor)})` : ''
              }</td>
            <td>${escapeHtml(f.status)} • ${escapeHtml(f.mode)}</td>
            <td>Paid: ₹${safeNumber(f.amountPaid, 0).toFixed(2)} | Due: ₹${safeNumber(f.balanceDue, 0).toFixed(2)}</td>
          </tr>`
            )
            .join('');

    const html = `
      <!DOCTYPE html><html><head><meta charset="utf-8" />
      <style>
        body { font-family: 'Georgia', serif; padding: 26px; color: #0C2D57; background: #FFFFFF; }
        h1 { margin: 0 0 4px; font-size: 22px; }
        .sub { color: #555; font-size: 12px; margin-bottom: 16px; }
        h2 { font-size: 13px; letter-spacing: 1px; color: #0C2D57; border-bottom: 2px solid #D4B978; padding-bottom: 4px; margin-top: 18px; }
        table { width: 100%; border-collapse: collapse; font-family: sans-serif; font-size: 12px; margin-top: 6px; }
        td, th { border-bottom: 1px solid #E6E1D6; padding: 8px; text-align: left; vertical-align: top; }
      </style></head>
      <body>
        <h1>${escapeHtml(student.name)}</h1>
        <div class="sub">${escapeHtml(subjectName)} • Filter: ${escapeHtml(periodLabel)}${
      student.phone ? ` • ${escapeHtml(student.phone)}` : ''
    }</div>
        ${
          student.notes
            ? `<h2>NOTES</h2><p style="font-family:sans-serif;font-size:12px;white-space:pre-wrap;">${escapeHtml(student.notes)}</p>`
            : ''
        }
        <h2>CLASSES (${stLessons.length})</h2>
        <table><tbody>${lessonsRows}</tbody></table>
        <h2>ATTENDANCE (${stAtt.length})</h2>
        <table><tbody>${attRows}</tbody></table>
        <h2>FEES (Paid: ₹${totalPaid.toFixed(2)} | Due: ₹${totalDue.toFixed(2)})</h2>
        <table><tbody>${feeRows}</tbody></table>
      </body></html>
    `;

    try {
      await Print.printAsync({ html });
    } catch (e) {
      try {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf' });
        }
      } catch (err) {
        Alert.alert('Print Error', 'Could not print student report.');
      }
    }
  };

  const masterListData = useMemo(() => {
    const targetStudents =
      masterStudentFilter === 'ALL'
        ? activeStudents
        : activeStudents.filter((s) => s.id === masterStudentFilter);

    const matchesTimeframe = (isoDate, feeRecord = null) => {
      if (masterDateFilter) return isoDate === masterDateFilter;
      if (masterMonthFilter !== 'ALL') {
        if (feeRecord && feeRecord.feeType === 'Monthly Fee' && feeRecord.monthPaidFor) {
          return feeRecord.monthPaidFor === masterMonthFilter;
        }
        return getMonthYearFromISO(isoDate) === masterMonthFilter;
      }
      return true;
    };

    return targetStudents.map((st) => {
      const stLessons = activeLessons.filter((l) => l.studentId === st.id && matchesTimeframe(l.date));
      const stAtt = activeAttendance.filter((a) => a.studentId === st.id && matchesTimeframe(a.date));
      const stFees = activeFees.filter((f) => f.studentId === st.id && matchesTimeframe(f.date, f));
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
          <td>Paid: ₹${row.totalPaid.toFixed(2)}<br/><span style="color:${
          row.totalDue > 0 ? '#9E2A2B' : '#166534'
        };font-size:11px;">Due: ₹${row.totalDue.toFixed(2)}</span></td>
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
      await Print.printAsync({ html });
    } catch (e) {
      try {
        const { uri } = await Print.printToFileAsync({ html });
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(uri, {
            mimeType: 'application/pdf',
            dialogTitle: 'JSM Master Report',
            UTI: 'com.adobe.pdf',
          });
        }
      } catch (err) {
        Alert.alert('Export Error', 'Could not generate the Master List PDF.');
      }
    }
  };

  const handleCheckOTA = async () => {
    if (__DEV__ || !Updates.isEnabled) {
      Alert.alert('OTA Notice', 'OTA updates are only active in standalone production/preview builds.');
      return;
    }
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
      Alert.alert('OTA Notice', 'Could not check for updates at this time.');
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
    const rawDigits = safeString(phoneStr).replace(/[^\d]/g, '');
    if (!rawDigits) return;
    const digits = rawDigits.length === 11 && rawDigits.startsWith('0') ? rawDigits.slice(1) : rawDigits;
    const formattedPhone = digits.length === 10 ? `91${digits}` : digits;
    Linking.openURL(
      `https://wa.me/${formattedPhone}?text=${encodeURIComponent(
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
        <div class="row"><span class="label">Instrument / Subject:</span><span class="val">${escapeHtml(subjectMap[st?.subjectId]?.name || 'Unassigned')}</span></div>
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

  const handleSoftDelete = async (collectionName, item, label) => {
    if (!item?.id) return;
    try {
      triggerLayoutAnimation();
      triggerHaptic(15);
      if (collectionName === 'students' && selectedStudentId === item.id) setSelectedStudentId(null);
      if (collectionName === 'subjects' && subjectForm.id === item.id) setSubjectForm({ id: null, name: '' });
      if (collectionName === 'students' && masterStudentFilter === item.id) setMasterStudentFilter('ALL');
      if (collectionName === 'students' && studentReportModal.studentId === item.id) {
        setStudentReportModal({ visible: false, studentId: null, dateFilter: '' });
      }

      const entriesToSoftDelete = [];
      if (collectionName === 'students') {
        lessons
          .filter((l) => l.studentId === item.id && !l.isDeleted)
          .forEach((l) => entriesToSoftDelete.push({ col: 'lessons', id: l.id, deletedWithParentId: item.id }));
        attendance
          .filter((a) => a.studentId === item.id && !a.isDeleted)
          .forEach((a) => entriesToSoftDelete.push({ col: 'attendance', id: a.id, deletedWithParentId: item.id }));
        fees
          .filter((f) => f.studentId === item.id && !f.isDeleted)
          .forEach((f) => entriesToSoftDelete.push({ col: 'fees', id: f.id, deletedWithParentId: item.id }));
      }
      // Hide the parent only after all child batches have been queued. If a batch fails,
      // the student remains visible and the partial state can be retried or repaired.
      entriesToSoftDelete.push({ col: collectionName, id: item.id });

      await commitBatchSoftDeletes(entriesToSoftDelete);
      if (collectionName !== 'activities') {
        logActivity('Moved to Trash', label);
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
      const CHUNK_SIZE = 450;
      let offset = 0;
      for (const subjectChunk of chunkArray(reorderedList, CHUNK_SIZE)) {
        const batch = writeBatch(db);
        subjectChunk.forEach((subj, index) =>
          batch.update(doc(db, 'subjects', subj.id), { order: offset + index })
        );
        await withWriteTimeout(batch.commit());
        offset += subjectChunk.length;
      }
      logActivity('Reordered Subjects', 'Updated instrument display order');
    } catch (e) {
      Alert.alert('Error', 'Could not save new subject order.');
    }
  };

  const handleSubjectDragStart = useCallback(
    (subj, initialTranslationY = 0) => {
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
        initialTranslationY,
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
        handleSubjectDragStart(subj, translationY);
      }
      const { startIdx, currentIdx, initialTranslationY = 0, list } = dragInfoRef.current;
      if (!list || list.length === 0) return;

      const deltaY = translationY - initialTranslationY;
      const targetIdx = Math.max(
        0,
        Math.min(list.length - 1, Math.round(startIdx + deltaY / SUBJECT_ROW_HEIGHT))
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
      dragSubjectY.setValue(deltaY - (dragInfoRef.current.currentIdx - startIdx) * SUBJECT_ROW_HEIGHT);
    },
    [dragSubjectY, handleSubjectDragStart]
  );

  const handleSubjectDragStateChange = useCallback(
    (subj, event) => {
      const { state, translationY } = event.nativeEvent;
      if (state === State.BEGAN) {
        handleSubjectDragStart(subj, translationY || 0);
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
          setStudentForm({
            id: item.id,
            name: safeString(item.name),
            subjectId: safeString(item.subjectId) || activeSubjects[0]?.id || '',
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
          const hasRem = Boolean(safeString(item.remarks).trim());
          setShowModalAttNote(hasRem);
          setAttendanceModalForm({
            id: item.id,
            studentId: item.studentId,
            date: safeString(item.date, getTodayISO()),
            status: safeString(item.status, 'Present'),
            remarks: safeString(item.remarks),
          });
          setAttendanceModal(true);
        } else if (entityType === 'fee') {
          const hasRem = Boolean(safeString(item.remarks).trim());
          setShowFeeNote(hasRem);
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
    const editingId = subjectForm.id;
    const isDuplicate = activeSubjects.some(
      (s) => s.id !== editingId && safeString(s.name).trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      return Alert.alert('Duplicate Subject', `"${trimmed}" already exists in your subjects list.`);
    }
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'subjects', editingId), { name: trimmed }));
        setSubjectForm({ id: null, name: '' });
        logActivity('Updated Subject', trimmed);
      } else {
        const nextOrder =
          activeSubjects.reduce((maxOrd, s) => Math.max(maxOrd, safeNumber(s.order, 0)), -1) + 1;
        await createStableDocument(
          'subjects',
          { name: trimmed, order: nextOrder },
          pendingSubjectWriteRef
        );
        setSubjectForm({ id: null, name: '' });
        logActivity('Added Subject', trimmed);
      }
    } catch (e) {
      Alert.alert(
        e?.code === 'jsm/write-pending' ? 'Previous Save Pending' : 'Save Not Confirmed',
        e?.code === 'jsm/write-pending'
          ? 'The previous subject save is still unresolved. Retry it with the same name, or wait for the connection to recover before starting another subject.'
          : e?.code === 'jsm/write-timeout'
          ? 'The subject may still be saving. Keep this form open and retry with the same name; the retry will reuse the same record.'
          : 'Could not save subject.'
      );
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
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'students', editingId), payload));
        logActivity('Updated Student', payload.name);
      } else {
        await createStableDocument(
          'students',
          { ...payload, notes: '', priorityNote: false },
          pendingStudentWriteRef
        );
        logActivity('Enrolled Student', `${payload.name} (${safeString(subjectMap[payload.subjectId]?.name, 'Unassigned')})`);
      }
      closeCalendarPicker();
      closeDropdownPicker();
      setStudentModal(false);
      setStudentForm({
        id: null,
        name: '',
        subjectId: activeSubjects[0]?.id || '',
        phone: '',
        guardian: '',
        joinedDate: getTodayISO(),
      });
    } catch (e) {
      Alert.alert(
        e?.code === 'jsm/write-pending' ? 'Previous Save Pending' : 'Save Not Confirmed',
        e?.code === 'jsm/write-pending'
          ? 'The previous student save is still unresolved. Retry it with the same details, or wait for the connection to recover before starting another student.'
          : e?.code === 'jsm/write-timeout'
          ? 'The student may still be saving. Keep this form open and retry with the same details; the retry will reuse the same record.'
          : 'Could not save student record.'
      );
    } finally {
      savingLockRef.current = false;
    }
  };

  const handleSaveInlineLesson = async () => {
    Keyboard.dismiss();
    if (!selectedStudentId) return;
    const savedStudentId = selectedStudentId;
    const savedDraftVersion = inlineLessonDraftVersionRef.current;
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
        studentId: savedStudentId,
        date: validDate,
        lesson: safeString(inlineLessonForm.lesson).trim(),
        technique: safeString(inlineLessonForm.technique).trim(),
        repertoire: safeString(inlineLessonForm.repertoire).trim(),
        assignment: safeString(inlineLessonForm.assignment).trim(),
      };
      await createStableDocument('lessons', payload, pendingLessonWriteRef);
      if (
        selectedStudentIdRef.current === savedStudentId &&
        inlineLessonDraftVersionRef.current === savedDraftVersion
      ) {
        updateInlineLessonForm({ date: getTodayISO(), technique: '', lesson: '', repertoire: '', assignment: '' });
      }
      logActivity(
        'Logged Lesson',
        `${safeString(studentMap[savedStudentId]?.name, 'Student')} (${formatReadableLocalDate(validDate)})`
      );
    } catch (e) {
      Alert.alert(
        e?.code === 'jsm/write-pending' ? 'Previous Save Pending' : 'Save Not Confirmed',
        e?.code === 'jsm/write-pending'
          ? 'A previous lesson save is still unresolved. Retry it with the same details before starting another lesson.'
          : e?.code === 'jsm/write-timeout'
          ? 'The lesson may still be saving. Keep the same student and details, then retry; the retry will reuse the same record.'
          : 'Could not log lesson.'
      );
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
      await withWriteTimeout(updateDoc(doc(db, 'lessons', editingId), payload));
      closeCalendarPicker();
      setLessonEditModal(false);
      logActivity(
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
    const savedStudentId = selectedStudentId;
    const savedDraftVersion = inlineAttendanceDraftVersionRef.current;
    const validDate = normalizeISODate(inlineAttendanceForm.date);
    if (!validDate) return Alert.alert('Validation', 'Please enter a valid date in YYYY-MM-DD format.');
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerLayoutAnimation();
      triggerHaptic(14);
      const statusVal = inlineAttendanceForm.status;
      const remarksVal = safeString(inlineAttendanceForm.remarks).trim();
      const existingRecord = activeAttendance.find(
        (a) => a.studentId === savedStudentId && a.date === validDate
      );
      if (existingRecord) {
        await withWriteTimeout(
          updateDoc(doc(db, 'attendance', existingRecord.id), { status: statusVal, remarks: remarksVal })
        );
        logActivity(
          'Updated Attendance',
          `${safeString(studentMap[selectedStudentId]?.name, 'Student')} • ${statusVal}`
        );
      } else {
        const attendanceId = getNewAttendanceDocumentId(savedStudentId, validDate);
        await withWriteTimeout(
          setDoc(doc(db, 'attendance', attendanceId), {
            studentId: savedStudentId,
            date: validDate,
            status: statusVal,
            remarks: remarksVal,
            timestamp: serverTimestamp(),
            isDeleted: false,
            deletedAt: null,
          })
        );
        logActivity(
          'Marked Attendance',
          `${safeString(studentMap[selectedStudentId]?.name, 'Student')} • ${statusVal}`
        );
      }
      if (
        selectedStudentIdRef.current === savedStudentId &&
        inlineAttendanceDraftVersionRef.current === savedDraftVersion
      ) {
        updateInlineAttendanceForm({ date: getTodayISO(), status: 'Present', remarks: '' });
        setShowInlineAttNote(false);
      }
    } catch (e) {
      Alert.alert('Error', 'Could not save attendance.');
    } finally {
      savingLockRef.current = false;
    }
  };

  // One-Tap Inline Quick-Toggle Handler for Daily Roster
  const handleQuickRosterAttendance = async (studentId, statusVal) => {
    if (!studentId || !ATTENDANCE_STATUSES.includes(statusVal)) return;
    const validDate = normalizeISODate(rosterDate) || getTodayISO();
    const existingRecord = rosterAttendanceByStudent[studentId];

    try {
      triggerHaptic(10);
      if (existingRecord && existingRecord.status === statusVal) {
        // Tapping the already active button opens the edit/note modal for that entry
        const hasRem = Boolean(safeString(existingRecord.remarks).trim());
        setShowModalAttNote(hasRem);
        setAttendanceModalForm({
          id: existingRecord.id,
          studentId: existingRecord.studentId,
          date: existingRecord.date,
          status: existingRecord.status,
          remarks: safeString(existingRecord.remarks),
        });
        setAttendanceModal(true);
        return;
      }

      if (existingRecord) {
        await withWriteTimeout(
          updateDoc(doc(db, 'attendance', existingRecord.id), {
            status: statusVal,
          })
        );
      } else {
        const attendanceId = getNewAttendanceDocumentId(studentId, validDate);
        await withWriteTimeout(
          setDoc(doc(db, 'attendance', attendanceId), {
            studentId,
            date: validDate,
            status: statusVal,
            remarks: '',
            timestamp: serverTimestamp(),
            isDeleted: false,
            deletedAt: null,
          })
        );
      }
      logActivity(
        'Marked Attendance',
        `${safeString(studentMap[studentId]?.name, 'Student')} • ${statusVal} (${formatReadableLocalDate(validDate)})`
      );
    } catch (e) {
      Alert.alert('Error', 'Could not update attendance.');
    }
  };

  // One-Tap Bulk "All Present" per Instrument Group on the Daily Roster
  const handleBulkRosterPresent = async (subjId, subjName) => {
    const validDate = normalizeISODate(rosterDate) || getTodayISO();
    const targetStudents =
      subjId === '_unassigned'
        ? activeStudents.filter((s) => !subjectMap[s.subjectId] || subjectMap[s.subjectId].isDeleted)
        : activeStudents.filter((s) => s.subjectId === subjId);

    if (targetStudents.length === 0) return;
    try {
      triggerHaptic(14);
      triggerLayoutAnimation();
      // Firestore limits each write batch to 500 operations; leave headroom.
      for (const studentChunk of chunkArray(targetStudents, 450)) {
        const batch = writeBatch(db);
        studentChunk.forEach((st) => {
          const existing = rosterAttendanceByStudent[st.id];
          if (existing) {
            batch.update(doc(db, 'attendance', existing.id), { status: 'Present' });
          } else {
            const attendanceId = getNewAttendanceDocumentId(st.id, validDate);
            batch.set(doc(db, 'attendance', attendanceId), {
              studentId: st.id,
              date: validDate,
              status: 'Present',
              remarks: '',
              timestamp: serverTimestamp(),
              isDeleted: false,
              deletedAt: null,
            });
          }
        });
        await withWriteTimeout(batch.commit());
      }
      logActivity(
        'Bulk Marked Present',
        `${subjName} (${targetStudents.length} students • ${formatReadableLocalDate(validDate)})`
      );
    } catch (e) {
      Alert.alert('Error', 'Could not bulk mark attendance.');
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
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'attendance', editingId), payload));
        logActivity(
          'Updated Attendance',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ${payload.status}`
        );
      } else if (duplicateRecord) {
        await withWriteTimeout(updateDoc(doc(db, 'attendance', duplicateRecord.id), payload));
        logActivity(
          'Updated Attendance',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ${payload.status}`
        );
      } else {
        const attendanceId = getNewAttendanceDocumentId(payload.studentId, validDate);
        await withWriteTimeout(
          setDoc(doc(db, 'attendance', attendanceId), {
            ...payload,
            timestamp: serverTimestamp(),
            isDeleted: false,
            deletedAt: null,
          })
        );
        logActivity(
          'Marked Attendance',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ${payload.status}`
        );
      }
      closeCalendarPicker();
      closeDropdownPicker();
      setAttendanceModal(false);
      setShowModalAttNote(false);
    } catch (e) {
      Alert.alert('Error', 'Could not save attendance.');
    } finally {
      savingLockRef.current = false;
    }
  };

  const handleSaveStudentNotes = async () => {
    Keyboard.dismiss();
    if (!selectedStudentId || savingLockRef.current) return;
    savingLockRef.current = true;
    const studentId = selectedStudentId;
    const savedNotes = safeString(noteDraft);
    const savedPriority = Boolean(priorityDraft);
    const baseline = noteBaseRef.current;
    let conflictingNotes = null;

    const saveNotesIfUnchanged = async (expected) => {
      await runTransaction(db, async (transaction) => {
        const studentRef = doc(db, 'students', studentId);
        const studentSnapshot = await transaction.get(studentRef);
        if (!studentSnapshot.exists()) {
          const error = new Error('Student no longer exists.');
          error.code = 'jsm/student-missing';
          throw error;
        }
        const current = studentSnapshot.data() || {};
        const currentNotes = safeString(current.notes);
        const currentPriority = Boolean(current.priorityNote);
        if (currentNotes !== expected.notes || currentPriority !== expected.priorityNote) {
          conflictingNotes = { notes: currentNotes, priorityNote: currentPriority };
          const error = new Error('Student notes changed on another device.');
          error.code = 'jsm/note-conflict';
          throw error;
        }
        transaction.update(studentRef, { notes: savedNotes, priorityNote: savedPriority });
      });
    };

    try {
      triggerLayoutAnimation();
      triggerHaptic(14);
      if (baseline.studentId !== studentId) {
        Alert.alert('Notes Changed', 'Reopen the student profile before saving notes.');
        return;
      }
      await withWriteTimeout(saveNotesIfUnchanged(baseline));
      noteBaseRef.current = { studentId, notes: savedNotes, priorityNote: savedPriority };
      logActivity('Updated Student Notes', safeString(studentMap[studentId]?.name));
    } catch (e) {
      if (e?.code === 'jsm/note-conflict' && conflictingNotes) {
        Alert.alert(
          'Notes Changed on Another Device',
          'Your draft is still available. Reload the latest version, or explicitly replace it with your draft.',
          [
            { text: 'Keep Editing', style: 'cancel' },
            {
              text: 'Reload Latest',
              onPress: () => {
                noteBaseRef.current = { studentId, ...conflictingNotes };
                setNoteDraft(conflictingNotes.notes);
                setPriorityDraft(conflictingNotes.priorityNote);
              },
            },
            {
              text: 'Replace Latest',
              style: 'destructive',
              onPress: async () => {
                if (savingLockRef.current) return;
                savingLockRef.current = true;
                try {
                  await withWriteTimeout(saveNotesIfUnchanged(conflictingNotes));
                  noteBaseRef.current = { studentId, notes: savedNotes, priorityNote: savedPriority };
                  logActivity('Updated Student Notes', safeString(studentMap[studentId]?.name));
                } catch (overwriteError) {
                  Alert.alert('Notes Changed Again', 'Reload the latest notes and review the changes before trying again.');
                } finally {
                  savingLockRef.current = false;
                }
              },
            },
          ]
        );
      } else {
        Alert.alert(
          'Notes Not Saved',
          e?.code === 'jsm/write-timeout'
            ? 'The notes save is still awaiting confirmation. Retry when the connection is stable.'
            : e?.code === 'jsm/student-missing'
            ? 'This student no longer exists.'
            : 'Could not update student notes. A connection is required to check for concurrent edits safely.'
        );
      }
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
    const editingId = feeForm.id;
    const pendingSettlement = editingId ? pendingSettlementWritesRef.current.get(editingId) : null;
    if (pendingSettlement && !pendingSettlement.settled) {
      return Alert.alert('Settlement Pending', 'Wait for the existing fee settlement to finish before editing this record.');
    }
    savingLockRef.current = true;

    try {
      triggerLayoutAnimation();
      triggerHaptic(12);
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
      if (editingId) {
        await withWriteTimeout(updateDoc(doc(db, 'fees', editingId), payload));
        if (numericBalance > 0) pendingSettlementWritesRef.current.delete(editingId);
        logActivity(
          'Updated Fee Record',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ₹${numericPaid}`
        );
      } else {
        await createStableDocument('fees', payload, pendingFeeWriteRef);
        logActivity(
          'Recorded Fee',
          `${safeString(studentMap[payload.studentId]?.name, 'Student')} • ₹${numericPaid} (${payload.status})`
        );
      }
      closeCalendarPicker();
      closeDropdownPicker();
      setFeeModal(false);
      setShowFeeNote(false);
      if (shouldSharePDF) {
        scheduleTimeout(() => {
          generateAndShareReceiptPDF(payload);
        }, 180);
      }
    } catch (e) {
      Alert.alert(
        'Save not confirmed',
        e?.code === 'jsm/write-timeout' || e?.code === 'jsm/write-pending'
          ? 'The fee save is still awaiting confirmation. Keep this form open and do not start a second fee record. You can retry Save safely; it will reuse the same record ID.'
          : 'Could not save fee record. Check the details and connection before retrying.'
      );
    } finally {
      savingLockRef.current = false;
    }
  };

  // One-Tap Settle Handler for Pending Dues in the Bank Ledger
  const handleQuickSettleFee = (feeRecord) => {
    if (!feeRecord?.id) return;
    const dueAmt = safeNumber(feeRecord.balanceDue, 0);
    const stName = safeString(studentMap[feeRecord.studentId]?.name, 'Student');
    triggerHaptic(12);
    Alert.alert(
      'Settle Balance Due',
      `Record a settlement of ₹${dueAmt.toFixed(2)} for ${stName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Settle Now',
          onPress: async () => {
            try {
              triggerLayoutAnimation();
              const payment = {
                studentId: feeRecord.studentId,
                feeType: feeRecord.feeType,
                monthPaidFor: safeString(feeRecord.monthPaidFor),
                date: getTodayISO(),
                mode: safeString(feeRecord.mode, 'UPI'),
                status: 'Paid',
                amountPaid: dueAmt,
                balanceDue: 0,
                remarks: `Settlement for fee record ${feeRecord.id}`,
              };
              let pending = pendingSettlementWritesRef.current.get(feeRecord.id);
              if (pending?.settled) {
                Alert.alert('Already Settled', 'This balance has already been settled. Refresh the fee ledger before trying again.');
                return;
              }
              const signature = JSON.stringify(payment);
              if (pending && pending.signature !== signature) {
                throw Object.assign(new Error('A previous settlement is still awaiting confirmation.'), {
                  code: 'jsm/write-pending',
                });
              }
              if (!pending) {
                pending = { id: doc(collection(db, 'fees')).id, signature };
                pendingSettlementWritesRef.current.set(feeRecord.id, pending);
              }

              const batch = writeBatch(db);
              batch.set(doc(db, 'fees', pending.id), {
                ...payment,
                timestamp: serverTimestamp(),
                isDeleted: false,
                deletedAt: null,
              });
              batch.update(doc(db, 'fees', feeRecord.id), { balanceDue: 0, status: 'Paid' });

              const pendingId = pending.id;
              const commitPromise = batch.commit();
              const markSettled = () => {
                const current = pendingSettlementWritesRef.current.get(feeRecord.id);
                if (current?.id === pendingId) current.settled = true;
              };
              const clearFailed = () => {
                if (pendingSettlementWritesRef.current.get(feeRecord.id)?.id === pendingId) {
                  pendingSettlementWritesRef.current.delete(feeRecord.id);
                }
              };
              commitPromise.then(markSettled, clearFailed);
              await withWriteTimeout(commitPromise);
              logActivity('Settled Pending Fee', `${stName} • ₹${dueAmt.toFixed(2)}`);
            } catch (e) {
              Alert.alert(
                'Settlement Not Confirmed',
                e?.code === 'jsm/write-timeout' || e?.code === 'jsm/write-pending'
                  ? 'The settlement may still be saving. Retry only this same settlement; it reuses the same payment record.'
                  : 'Could not settle fee balance.'
              );
            }
          },
        },
      ]
    );
  };

  const handleUpdateNotice = async (overrideText = null) => {
    Keyboard.dismiss();
    if (savingLockRef.current) return;
    savingLockRef.current = true;
    try {
      triggerHaptic(12);
      const today = getTodayISO();
      const textVal = overrideText !== null ? safeString(overrideText).trim() : safeString(noticeInput).trim();
      await withWriteTimeout(setDoc(doc(db, 'settings', 'noticeBoard'), { text: textVal, updatedDate: today }));
      setNoticeEditModal(false);
      logActivity(
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
      if (item._col === 'students') {
        const parentDeletedAt = timestampToMillis(item.deletedAt, 0);
        const wasDeletedWithParent = (record) =>
          record.deletedWithParentId === item.id ||
          (record.isDeleted &&
            parentDeletedAt > 0 &&
            timestampToMillis(record.deletedAt, 0) === parentDeletedAt);
        const linkedRecords = [
          ...lessons
            .filter((record) => record.studentId === item.id && wasDeletedWithParent(record))
            .map((record) => ({ ...record, _col: 'lessons' })),
          ...attendance
            .filter((record) => record.studentId === item.id && wasDeletedWithParent(record))
            .map((record) => ({ ...record, _col: 'attendance' })),
          ...fees
            .filter((record) => record.studentId === item.id && wasDeletedWithParent(record))
            .map((record) => ({ ...record, _col: 'fees' })),
        ];

        for (const recordChunk of chunkArray(linkedRecords, 450)) {
          const childBatch = writeBatch(db);
          recordChunk.forEach((record) =>
            childBatch.update(doc(db, record._col, record.id), {
              isDeleted: false,
              deletedAt: null,
            })
          );
          await withWriteTimeout(childBatch.commit());
        }

        const parentBatch = writeBatch(db);
        parentBatch.update(doc(db, 'students', item.id), { isDeleted: false, deletedAt: null });
        if (item.subjectId && subjectMap[item.subjectId]?.isDeleted) {
          parentBatch.update(doc(db, 'subjects', item.subjectId), { isDeleted: false, deletedAt: null });
        }
        await withWriteTimeout(parentBatch.commit());
        logActivity('Restored from Trash', item._label);
        return;
      }

      const batch = writeBatch(db);

      if (item._col === 'attendance') {
        const duplicateActive = activeAttendance.find(
          (a) => a.studentId === item.studentId && a.date === item.date && a.id !== item.id
        );
        if (duplicateActive) {
          Alert.alert(
            'Attendance Already Exists',
            'Keep the current active record, or explicitly replace it with the record from Trash?',
            [
              { text: 'Keep Current', style: 'cancel' },
              {
                text: 'Replace Active',
                style: 'destructive',
                onPress: async () => {
                  try {
                    const replaceBatch = writeBatch(db);
                    replaceBatch.update(doc(db, 'attendance', duplicateActive.id), {
                      status: item.status,
                      remarks: item.remarks,
                    });
                    replaceBatch.delete(doc(db, 'attendance', item.id));
                    await withWriteTimeout(replaceBatch.commit());
                    logActivity('Restored from Trash', item._label);
                  } catch (error) {
                    Alert.alert('Error', 'Could not replace the active attendance record.');
                  }
                },
              },
            ]
          );
          return;
        } else {
          batch.update(doc(db, 'attendance', item.id), { isDeleted: false, deletedAt: null });
        }
      } else {
        batch.update(doc(db, item._col, item.id), { isDeleted: false, deletedAt: null });
      }

      if (
        ['lessons', 'attendance', 'fees'].includes(item._col) &&
        item.studentId &&
        studentMap[item.studentId]?.isDeleted
      ) {
        const parentSt = studentMap[item.studentId];
        batch.update(doc(db, 'students', item.studentId), { isDeleted: false, deletedAt: null });
        if (parentSt?.subjectId && subjectMap[parentSt.subjectId]?.isDeleted) {
          batch.update(doc(db, 'subjects', parentSt.subjectId), { isDeleted: false, deletedAt: null });
        }
      }

      await withWriteTimeout(batch.commit());
      if (item._col !== 'activities') {
        logActivity('Restored from Trash', item._label);
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
      const docsToDelete = [];
      if (item._col === 'students') {
        lessons.filter((l) => l.studentId === item.id).forEach((l) => docsToDelete.push({ col: 'lessons', id: l.id }));
        attendance
          .filter((a) => a.studentId === item.id)
          .forEach((a) => docsToDelete.push({ col: 'attendance', id: a.id }));
        fees.filter((f) => f.studentId === item.id).forEach((f) => docsToDelete.push({ col: 'fees', id: f.id }));
      }
      docsToDelete.push({ col: item._col, id: item.id });
      await commitBatchDeletes(docsToDelete);
      if (item._col !== 'activities') {
        logActivity('Permanently Deleted from Firebase', item._label);
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
              const orderedDeletes = Array.from(docsToDelete.values()).sort(
                (a, b) => Number(a.col === 'students') - Number(b.col === 'students')
              );
              await commitBatchDeletes(orderedDeletes);
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
      const getRecordMonthLabel = (rec) => {
        if (rec.feeType === 'Monthly Fee' && rec.monthPaidFor) {
          return rec.monthPaidFor;
        }
        return getMonthYearFromISO(rec.date);
      };

      activeSubjects.forEach((subj) => {
        const subjectRecords = records.filter((r) => studentMap[r.studentId]?.subjectId === subj.id);
        if (subjectRecords.length > 0) {
          const monthsMap = {};
          subjectRecords.forEach((rec) => {
            const mLabel = getRecordMonthLabel(rec);
            if (!monthsMap[mLabel]) monthsMap[mLabel] = [];
            monthsMap[mLabel].push(rec);
          });
          grouped.push({
            subject: subj,
            months: Object.entries(monthsMap)
              .map(([monthName, items]) => ({ monthName, items }))
              .sort((a, b) => parseMonthYearSortKey(b.monthName) - parseMonthYearSortKey(a.monthName)),
          });
        }
      });
      const unassignedRecords = records.filter((r) => !activeSubjectIds.has(studentMap[r.studentId]?.subjectId));
      if (unassignedRecords.length > 0) {
        const monthsMap = {};
        unassignedRecords.forEach((rec) => {
          const mLabel = getRecordMonthLabel(rec);
          if (!monthsMap[mLabel]) monthsMap[mLabel] = [];
          monthsMap[mLabel].push(rec);
        });
        grouped.push({
          subject: { id: '_unassigned', name: 'Unassigned / Other' },
          months: Object.entries(monthsMap)
            .map(([monthName, items]) => ({ monthName, items }))
            .sort((a, b) => parseMonthYearSortKey(b.monthName) - parseMonthYearSortKey(a.monthName)),
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
// ==========================================
// PART 2:a OF 2
// ==========================================

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
                closeCalendarPicker();
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
      <Pressable style={styles.calendarPortalOverlay} onPress={closeCalendarPicker}>
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
                closeCalendarPicker();
              }}
            >
              Today
            </PaperButton>
            <PaperButton
              mode="contained"
              buttonColor={COLORS.navy}
              textColor={COLORS.gold}
              onPress={closeCalendarPicker}
            >
              Close
            </PaperButton>
          </View>
        </Pressable>
      </Pressable>
    );
  };

  const renderDropdownOverlay = () => {
    if (!dropdownPicker.visible) return null;
    return (
      <Pressable style={styles.dropdownPortalOverlay} onPress={closeDropdownPicker}>
        <Pressable style={styles.dropdownModalCard} onPress={(e) => e.stopPropagation()}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.sectionTitle}>{safeString(dropdownPicker.title).toUpperCase()}</Text>
            <TouchableOpacity onPress={closeDropdownPicker} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Ionicons name="close-outline" size={22} color={COLORS.navy} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ maxHeight: 300, marginTop: 4 }} keyboardShouldPersistTaps="handled">
            {dropdownPicker.options.map((opt) => {
              const isSelected = opt.value === dropdownPicker.selectedValue;
              return (
                <TouchableOpacity
                  key={String(opt.value)}
                  style={[styles.dropdownOptionRow, isSelected && styles.dropdownOptionRowSelected]}
                  onPress={() => {
                    triggerHaptic(8);
                    if (typeof dropdownPicker.onSelect === 'function') {
                      dropdownPicker.onSelect(opt.value);
                    }
                    closeDropdownPicker();
                  }}
                >
                  <Text
                    style={[
                      styles.dropdownOptionText,
                      isSelected && styles.dropdownOptionTextSelected,
                    ]}
                    numberOfLines={1}
                  >
                    {opt.label}
                  </Text>
                  {isSelected ? (
                    <Ionicons name="checkmark-circle" size={18} color={COLORS.gold} />
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </Pressable>
      </Pressable>
    );
  };

  // ==========================================
  // 6. HOMEPAGE: THIN GREETING, LARGER NOTICE BOARD & HORIZONTAL MATRIX
  // ==========================================
  const renderHomeTab = () => {
    const todayISO = getTodayISO();
    const liveStatusColor = !isNetworkOnline
      ? COLORS.offlineRed
      : hasAnyPendingWrites
      ? COLORS.syncAmber
      : COLORS.liveGreen;

    const openStudentPopup = (stId) => {
      triggerHaptic(8);
      setStudentReportModal({
        visible: true,
        studentId: stId,
        dateFilter: '',
      });
    };

    return (
      <View style={styles.homeNoScrollContainer}>
        <PanGestureHandler
          activeOffsetX={[-20, 20]}
          failOffsetY={[-15, 15]}
          onHandlerStateChange={(e) => {
            if (e.nativeEvent.state === State.END) {
              handleMainTabSwipe(e);
            }
          }}
        >
          <View style={{ gap: 10 }}>
            {/* 1. Slim Greeting Strip */}
            <View style={styles.compactGreetingStrip}>
              <SmoothNavyGradient />
              <Text style={styles.compactGreetingTitle} numberOfLines={1}>
                {getGreetingByLocalTime()}, Maestro
              </Text>
              <Text style={styles.compactGreetingDate}>{formatReadableLocalDate(todayISO)}</Text>
            </View>

            {/* 2. Larger Notice Board + 3 Action Cards */}
            <View style={styles.compactActionSection}>
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
                    size={56}
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
                  {noticeText ? (
                    <Text style={styles.compactNoticeBody} numberOfLines={4}>
                      {noticeText}
                    </Text>
                  ) : null}
                </View>
              </ScalePressable>

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
          </View>
        </PanGestureHandler>

        {/* 3. Bottom Half: Horizontal Matrix Live Firebase Widget */}
        <Surface style={styles.liveFirebaseWidget} elevation={3}>
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
            </View>

            <TouchableOpacity
              style={styles.masterListBtn}
              onPress={() => {
                triggerHaptic(10);
                setMasterListModal(true);
              }}
            >
              <Ionicons name="grid-outline" size={11} color={COLORS.gold} />
              <Text style={styles.masterListBtnText}>Master List</Text>
            </TouchableOpacity>
          </View>

          {activeStudents.length === 0 ? (
            <View style={{ flex: 1, justifyContent: 'center' }}>
              <EmptyStateWatermark compact message="" />
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              <View style={styles.matrixWrapper}>
                <View style={styles.matrixStickyLeftCol}>
                  <View style={[styles.matrixHeaderCell, styles.matrixStickyHeaderCell]}>
                    <Text style={styles.matrixHeaderText}>STUDENT</Text>
                  </View>
                  {activeStudents.map((st, idx) => {
                    const m = getStudentMetrics(st.id);
                    return (
                      <TouchableOpacity
                        key={st.id}
                        activeOpacity={0.75}
                        style={[
                          styles.matrixRowCell,
                          styles.matrixStickyCell,
                          idx % 2 === 1 && styles.matrixRowAlt,
                        ]}
                        onPress={() => openStudentPopup(st.id)}
                      >
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                          <Text style={styles.matrixStudentName} numberOfLines={1}>
                            {st.name}
                          </Text>
                          {m.hasPendingSync ? (
                            <View style={styles.cachedTag}>
                              <Text style={styles.cachedTagText}>CACHED</Text>
                            </View>
                          ) : null}
                        </View>
                        <Text style={styles.matrixStudentSub} numberOfLines={1}>
                          {safeString(subjectMap[st.subjectId]?.name, 'Unassigned')}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={true}
                  nestedScrollEnabled={true}
                >
                  <View>
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

                    {activeStudents.map((st, idx) => {
                      const m = getStudentMetrics(st.id);
                      const latestLesson = m.stLessons[0];
                      const latestAtt = m.stAttendance[0];
                      const latestFee = m.stFees[0];

                      const attBg = !latestAtt
                        ? COLORS.cream
                        : latestAtt.status === 'Present'
                        ? COLORS.successBg
                        : latestAtt.status === 'Absent'
                        ? COLORS.dangerBg
                        : COLORS.warningBg;

                      const attBorder = !latestAtt
                        ? COLORS.border
                        : latestAtt.status === 'Present'
                        ? '#86EFAC'
                        : latestAtt.status === 'Absent'
                        ? '#FCA5A5'
                        : '#FDBA74';

                      const attColor = !latestAtt
                        ? COLORS.navy
                        : latestAtt.status === 'Present'
                        ? COLORS.success
                        : latestAtt.status === 'Absent'
                        ? COLORS.danger
                        : COLORS.warning;

                      const isOverallDue = m.feeStatus === 'Due / Unpaid';
                      const feeBg =
                        m.feeStatus === 'Paid'
                          ? COLORS.successBg
                          : isOverallDue
                          ? COLORS.dangerBg
                          : COLORS.cream;

                      const feeBorder =
                        m.feeStatus === 'Paid'
                          ? '#86EFAC'
                          : isOverallDue
                          ? '#FCA5A5'
                          : COLORS.border;

                      const feeColor =
                        m.feeStatus === 'Paid'
                          ? COLORS.success
                          : isOverallDue
                          ? COLORS.danger
                          : COLORS.navy;

                      const feeBadgeLabel = !latestFee
                        ? '—'
                        : isOverallDue
                        ? `DUE • ₹${m.totalDue}`
                        : `₹${latestFee.amountPaid} • ${latestFee.status.toUpperCase()}`;

                      return (
                        <View
                          key={st.id}
                          style={[styles.matrixScrollDataRow, idx % 2 === 1 && styles.matrixRowAlt]}
                        >
                          <TouchableOpacity
                            activeOpacity={0.75}
                            style={[styles.matrixRowCell, { width: 148 }]}
                            onPress={() => openStudentPopup(st.id)}
                          >
                            <View
                              style={[
                                styles.matrixStatusBadge,
                                { backgroundColor: attBg, borderColor: attBorder },
                              ]}
                            >
                              <Text
                                style={[styles.matrixStatusBadgeText, { color: attColor }]}
                                numberOfLines={1}
                              >
                                {latestAtt ? latestAtt.status.toUpperCase() : '—'}
                              </Text>
                            </View>
                            <Text style={styles.matrixCellMeta} numberOfLines={1}>
                              {latestAtt ? `${formatReadableLocalDate(latestAtt.date)} (${m.attendancePct})` : '—'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.75}
                            style={[styles.matrixRowCell, { width: 175 }]}
                            onPress={() => openStudentPopup(st.id)}
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
                                    .join(' • ') || 'Logged'
                                : '—'}
                            </Text>
                            <Text style={styles.matrixCellMeta} numberOfLines={1}>
                              {latestLesson
                                ? `${formatReadableLocalDate(latestLesson.date)} • ${m.classesTaken} total`
                                : '—'}
                            </Text>
                          </TouchableOpacity>

                          <TouchableOpacity
                            activeOpacity={0.75}
                            style={[styles.matrixRowCell, { width: 155 }]}
                            onPress={() => openStudentPopup(st.id)}
                          >
                            <View
                              style={[
                                styles.matrixStatusBadge,
                                { backgroundColor: feeBg, borderColor: feeBorder },
                              ]}
                            >
                              <Text
                                style={[styles.matrixStatusBadgeText, { color: feeColor }]}
                                numberOfLines={1}
                              >
                                {feeBadgeLabel}
                              </Text>
                            </View>
                            <Text style={styles.matrixCellMeta} numberOfLines={1}>
                              {latestFee
                                ? isOverallDue
                                  ? `Last: ₹${latestFee.amountPaid} (${formatReadableLocalDate(latestFee.date)})`
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

  // ==========================================
  // 6B. OVERHAULED STUDENTS TAB: "CONTACT DIRECTORY" HIGH-DENSITY LAYOUT
  // ==========================================
  const renderDirectoryStudentRow = (st, isLast = false) => {
    const metrics = getStudentMetrics(st.id);
    const isDue = metrics.feeStatus === 'Due / Unpaid';
    const isPaid = metrics.feeStatus === 'Paid';

    return (
      <Pressable
        key={st.id}
        style={({ pressed }) => [
          styles.directorySlimRow,
          isLast && { borderBottomWidth: 0 },
          pressed && { backgroundColor: COLORS.cream },
        ]}
        onPress={() => {
          Keyboard.dismiss();
          triggerHaptic(8);
          setNavDirection(1);
          setSubTabDirection(1);
          setSelectedStudentId(st.id);
          setProfileTab('Classes');
        }}
        onLongPress={() => openLongPressMenu('student', st, st.name)}
        delayLongPress={260}
      >
        {/* Left Avatar Circle with Initials & Red Due Dot */}
        <View style={styles.directoryAvatar}>
          <Text style={styles.directoryAvatarText}>{getInitials(st.name)}</Text>
          {isDue ? <View style={styles.directoryDueDot} /> : null}
        </View>

        {/* Center Compact Name + Meta */}
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={styles.directoryNameText} numberOfLines={1}>
              {safeString(st.name, 'Unnamed Student')}
            </Text>
            {st.priorityNote ? (
              <Ionicons name="star" size={13} color={COLORS.gold} />
            ) : null}
            {metrics.hasPendingSync ? (
              <View style={styles.cachedTag}>
                <Text style={styles.cachedTagText}>CACHED</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.directoryMetaText} numberOfLines={1}>
            Att: {metrics.attendancePct} • {metrics.classesTaken} Classes • Joined {formatReadableLocalDate(st.joinedDate)}
          </Text>
        </View>

        {/* Right Slim Status Pill + Chevron */}
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <View
            style={[
              styles.directoryStatusBadge,
              isPaid
                ? styles.feeBadgePaid
                : isDue
                ? styles.feeBadgeDue
                : styles.feeBadgeNeutral,
            ]}
          >
            <Text
              style={[
                styles.directoryStatusBadgeText,
                { color: isDue ? COLORS.danger : isPaid ? COLORS.success : COLORS.navy },
              ]}
            >
              {isDue && metrics.totalDue > 0 ? `Due ₹${metrics.totalDue}` : metrics.feeStatus}
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={15} color={COLORS.silver} />
        </View>
      </Pressable>
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
    const visibleStudents = filteredStudents.slice(0, studentDisplayLimit);
    const unassignedStudents = visibleStudents.filter((st) => !activeSubjectIdSet.has(st.subjectId));

    const filterOptions = [
      { value: 'All', label: `All Students (${activeStudents.length})` },
      { value: 'Due', label: 'Due / Unpaid Only' },
      { value: 'Priority', label: 'Priority ☆ Notes Only' },
    ];

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContentWithFab}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.tabTopBar}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Text style={styles.pageHeading}>Students</Text>
            {studentFilter !== 'All' ? (
              <TouchableOpacity
                style={styles.activeFilterPill}
                onPress={() => {
                  triggerHaptic(6);
                  setStudentFilter('All');
                }}
              >
                <Text style={styles.activeFilterPillText}>
                  {studentFilter === 'Due' ? 'Due / Unpaid' : '☆ Notes'} ✕
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              style={[
                styles.floatingSearchToggleBtn,
                studentFilter !== 'All' && styles.floatingSearchToggleBtnActive,
              ]}
              onPress={() =>
                openDropdownPicker('Filter Students', filterOptions, studentFilter, (val) => {
                  triggerLayoutAnimation();
                  setStudentFilter(val);
                })
              }
            >
              <Ionicons
                name="funnel-outline"
                size={18}
                color={studentFilter !== 'All' ? COLORS.gold : COLORS.navy}
              />
            </TouchableOpacity>
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
        </View>

        {searchBarVisible && (
          <PaperInput
            mode="outlined"
            label="Search students"
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

        {activeSubjects.length === 0 && unassignedStudents.length === 0 ? (
          <Surface style={styles.whiteCard} elevation={2}>
            <EmptyStateWatermark
              message=""
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
              const subjStudents = visibleStudents.filter((s) => s.subjectId === subj.id);
              if ((query || studentFilter !== 'All') && subjStudents.length === 0) return null;
              const isCollapsed = Boolean(collapsedSubjects[subj.id]);

              return (
                <View key={subj.id} style={styles.directoryGroupBlock}>
                  <TouchableOpacity
                    activeOpacity={0.8}
                    style={styles.groupHeaderBar}
                    onPress={() => toggleSubjectGroup(subj.id)}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Ionicons
                        name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                        size={14}
                        color={COLORS.gold}
                      />
                      <Text style={styles.groupHeaderTitle}>
                        {safeString(subj.name, 'Instrument').toUpperCase()}
                      </Text>
                    </View>
                    <Text style={styles.groupHeaderCount}>{subjStudents.length}</Text>
                  </TouchableOpacity>

                  {!isCollapsed &&
                    (subjStudents.length === 0 ? (
                      <Surface style={styles.directoryListSurface} elevation={1}>
                        <EmptyStateWatermark compact message="" />
                      </Surface>
                    ) : (
                      <Surface style={styles.directoryListSurface} elevation={1}>
                        {subjStudents.map((st, idx) =>
                          renderDirectoryStudentRow(st, idx === subjStudents.length - 1)
                        )}
                      </Surface>
                    ))}
                </View>
              );
            })}

            {unassignedStudents.length > 0 && (
              <View style={styles.directoryGroupBlock}>
                <TouchableOpacity
                  activeOpacity={0.8}
                  style={styles.groupHeaderBar}
                  onPress={() => toggleSubjectGroup('_unassigned')}
                >
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons
                      name={collapsedSubjects._unassigned ? 'chevron-forward' : 'chevron-down'}
                      size={14}
                      color={COLORS.gold}
                    />
                    <Text style={styles.groupHeaderTitle}>UNASSIGNED</Text>
                  </View>
                  <Text style={styles.groupHeaderCount}>{unassignedStudents.length}</Text>
                </TouchableOpacity>
                {!collapsedSubjects._unassigned && (
                  <Surface style={styles.directoryListSurface} elevation={1}>
                    {unassignedStudents.map((st, idx) =>
                      renderDirectoryStudentRow(st, idx === unassignedStudents.length - 1)
                    )}
                  </Surface>
                )}
              </View>
            )}
            {visibleStudents.length < filteredStudents.length && (
              <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => setStudentDisplayLimit((n) => n + 50)}>
                Load 50 more students ({filteredStudents.length - visibleStudents.length} remaining)
              </PaperButton>
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
                  onSelectDate={(d) => updateInlineLessonForm((prev) => ({ ...prev, date: d }))}
                  onOpenCalendar={openCalendarPicker}
                />
                <PaperInput
                  mode="outlined"
                  label="Date"
                  value={inlineLessonForm.date}
                  onChangeText={(t) => updateInlineLessonForm((prev) => ({ ...prev, date: t }))}
                  right={
                    <PaperInput.Icon
                      icon="calendar-outline"
                      onPress={() =>
                        openCalendarPicker(inlineLessonForm.date, (d) =>
                          updateInlineLessonForm((prev) => ({ ...prev, date: d }))
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
                  label="Technique"
                  value={inlineLessonForm.technique}
                  onChangeText={(t) => updateInlineLessonForm((prev) => ({ ...prev, technique: t }))}
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperInput
                  mode="outlined"
                  label="Lesson"
                  value={inlineLessonForm.lesson}
                  onChangeText={(t) => updateInlineLessonForm((prev) => ({ ...prev, lesson: t }))}
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperInput
                  mode="outlined"
                  label="Repertoire"
                  value={inlineLessonForm.repertoire}
                  onChangeText={(t) => updateInlineLessonForm((prev) => ({ ...prev, repertoire: t }))}
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperInput
                  mode="outlined"
                  label="Assignment"
                  value={inlineLessonForm.assignment}
                  onChangeText={(t) => updateInlineLessonForm((prev) => ({ ...prev, assignment: t }))}
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <PaperButton
                  mode="contained"
                  buttonColor={COLORS.navy}
                  textColor={COLORS.gold}
                  onPress={handleSaveInlineLesson}
                  style={{ marginTop: 6, borderRadius: 10 }}
                >
                  Save Lesson
                </PaperButton>
              </Surface>

              <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>LESSON HISTORY</Text>
              {metrics.stLessons.length === 0 ? (
                <Surface style={styles.whiteCard} elevation={2}>
                  <EmptyStateWatermark compact message="" />
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
                  onSelectDate={(d) => updateInlineAttendanceForm((prev) => ({ ...prev, date: d }))}
                  onOpenCalendar={openCalendarPicker}
                />
                <PaperInput
                  mode="outlined"
                  label="Date"
                  value={inlineAttendanceForm.date}
                  onChangeText={(t) => updateInlineAttendanceForm((prev) => ({ ...prev, date: t }))}
                  right={
                    <PaperInput.Icon
                      icon="calendar-outline"
                      onPress={() =>
                        openCalendarPicker(inlineAttendanceForm.date, (d) =>
                          updateInlineAttendanceForm((prev) => ({ ...prev, date: d }))
                        )
                      }
                    />
                  }
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
                <DropdownField
                  label="Attendance Status"
                  valueLabel={inlineAttendanceForm.status}
                  onPress={() =>
                    openDropdownPicker(
                      'Attendance Status',
                      ATTENDANCE_STATUSES.map((s) => ({ label: s, value: s })),
                      inlineAttendanceForm.status,
                      (val) => updateInlineAttendanceForm((prev) => ({ ...prev, status: val }))
                    )
                  }
                />
                {showInlineAttNote || Boolean(inlineAttendanceForm.remarks) ? (
                  <PaperInput
                    mode="outlined"
                    label="Note / Remarks"
                    value={inlineAttendanceForm.remarks}
                    onChangeText={(t) => updateInlineAttendanceForm((prev) => ({ ...prev, remarks: t }))}
                    right={
                      <PaperInput.Icon
                        icon="close"
                        onPress={() => {
                          triggerLayoutAnimation();
                          updateInlineAttendanceForm((prev) => ({ ...prev, remarks: '' }));
                          setShowInlineAttNote(false);
                        }}
                      />
                    }
                    outlineColor={COLORS.border}
                    activeOutlineColor={COLORS.navy}
                    style={styles.tintedInput}
                  />
                ) : (
                  <TouchableOpacity
                    style={styles.addNoteToggleBtn}
                    onPress={() => {
                      triggerLayoutAnimation();
                      setShowInlineAttNote(true);
                    }}
                  >
                    <Ionicons name="add-circle-outline" size={15} color={COLORS.navy} />
                    <Text style={styles.addNoteToggleText}>+ Add Note</Text>
                  </TouchableOpacity>
                )}
                <PaperButton
                  mode="contained"
                  buttonColor={COLORS.navy}
                  textColor={COLORS.gold}
                  onPress={handleSaveInlineAttendance}
                  style={{ marginTop: 6, borderRadius: 10 }}
                >
                  Save Attendance
                </PaperButton>
              </Surface>

              <Text style={[styles.sectionTitle, { marginVertical: 10 }]}>ATTENDANCE LOG</Text>
              {metrics.stAttendance.length === 0 ? (
                <Surface style={styles.whiteCard} elevation={2}>
                  <EmptyStateWatermark compact message="" />
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
                <Text style={styles.recordPrimaryTitle}>Priority "☆ NOTE"</Text>
                <Switch
                  value={priorityDraft}
                  onValueChange={setPriorityDraft}
                  trackColor={{ false: COLORS.silver, true: COLORS.navy }}
                  thumbColor={priorityDraft ? COLORS.gold : COLORS.white}
                />
              </View>
              <PaperInput
                mode="outlined"
                label="Faculty Notes"
                multiline
                numberOfLines={5}
                value={noteDraft}
                onChangeText={setNoteDraft}
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
                  <EmptyStateWatermark compact message="" />
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
                          Paid: ₹{fee.amountPaid}
                          {safeNumber(fee.balanceDue, 0) > 0 ? ` | Balance: ₹${fee.balanceDue}` : ''}
                        </Text>
                        {fee.remarks ? <Text style={styles.silverMeta}>{fee.remarks}</Text> : null}
                      </View>
                      <TouchableOpacity
                        style={styles.pdfExportTouchBtn}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        onPress={() => generateAndShareReceiptPDF(fee)}
                      >
                        <Ionicons name="share-social-outline" size={16} color={COLORS.gold} />
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

  // ==========================================
  // 6C. OVERHAULED ATTENDANCE TAB: "DAILY ROSTER" QUICK-TOGGLE + COMPACT HISTORY
  // ==========================================
  const renderRosterStudentRow = (st, isLast = false) => {
    const rec = rosterAttendanceByStudent[st.id];
    const currentStatus = rec?.status || null;

    const statusButtons = [
      { short: 'P', full: 'Present', activeBg: COLORS.success, activeText: COLORS.white },
      { short: 'A', full: 'Absent', activeBg: COLORS.danger, activeText: COLORS.white },
      { short: 'T', full: 'Tardy', activeBg: COLORS.warning, activeText: COLORS.white },
      { short: 'R', full: 'Rescheduled', activeBg: COLORS.navy, activeText: COLORS.gold },
    ];

    return (
      <Pressable
        key={st.id}
        style={[styles.directorySlimRow, isLast && { borderBottomWidth: 0 }]}
        onLongPress={() => {
          if (rec) {
            openLongPressMenu(
              'attendance',
              rec,
              `${st.name} - ${rec.status} (${formatReadableLocalDate(rec.date)})`
            );
          } else {
            setShowModalAttNote(false);
            setAttendanceModalForm({
              id: null,
              studentId: st.id,
              date: rosterDate,
              status: 'Present',
              remarks: '',
            });
            setAttendanceModal(true);
          }
        }}
        delayLongPress={260}
      >
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <Text style={styles.directoryNameText} numberOfLines={1}>
              {safeString(st.name, 'Student')}
            </Text>
            {rec?._pendingSync ? (
              <View style={styles.cachedTag}>
                <Text style={styles.cachedTagText}>CACHED</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.directoryMetaText} numberOfLines={1}>
            {currentStatus
              ? `${currentStatus}${rec?.remarks ? ` • ${rec.remarks}` : ''}`
              : 'Tap P / A / T / R to mark'}
          </Text>
        </View>

        <View style={styles.rosterToggleRow}>
          {statusButtons.map((btn) => {
            const isSelected = currentStatus === btn.full;
            return (
              <TouchableOpacity
                key={btn.full}
                activeOpacity={0.75}
                style={[
                  styles.rosterToggleBtn,
                  isSelected && { backgroundColor: btn.activeBg, borderColor: btn.activeBg },
                ]}
                onPress={() => handleQuickRosterAttendance(st.id, btn.full)}
              >
                <Text
                  style={[
                    styles.rosterToggleBtnText,
                    isSelected && { color: btn.activeText, fontWeight: '900' },
                  ]}
                >
                  {btn.short}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </Pressable>
    );
  };

  const renderAttendanceTab = () => {
    const todayISO = getTodayISO();
    const activeSubjectIdSet = new Set(activeSubjects.map((s) => s.id));
    const unassignedRosterStudents = activeStudents.filter((st) => !activeSubjectIdSet.has(st.subjectId));

    // Group History Log by Date-First so the date is written once per section header
    const filteredRecords = attendanceFilterAllMonths
      ? activeAttendance
      : activeAttendance.filter((a) => isWithinLastTwoLocalMonths(a.date));
    const visibleHistoryRecords = filteredRecords.slice(0, attendanceHistoryLimit);

    const historyByDate = [];
    const dateBuckets = Object.create(null);
    visibleHistoryRecords.forEach((rec) => {
      const dKey = rec.date || 'Unknown';
      if (!dateBuckets[dKey]) {
        dateBuckets[dKey] = [];
        historyByDate.push({ dateISO: dKey, items: dateBuckets[dKey] });
      }
      dateBuckets[dKey].push(rec);
    });

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContentWithFab}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.tabTopBar}>
          <Text style={styles.pageHeading}>Attendance</Text>
          <View style={styles.segmentedModePill}>
            <TouchableOpacity
              style={[
                styles.segmentedModeOption,
                attendanceViewMode === 'Roster' && styles.segmentedModeOptionActive,
              ]}
              onPress={() => {
                triggerHaptic(6);
                triggerLayoutAnimation();
                setAttendanceViewMode('Roster');
              }}
            >
              <Text
                style={[
                  styles.segmentedModeText,
                  attendanceViewMode === 'Roster' && styles.segmentedModeTextActive,
                ]}
              >
                Daily Roster
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.segmentedModeOption,
                attendanceViewMode === 'History' && styles.segmentedModeOptionActive,
              ]}
              onPress={() => {
                triggerHaptic(6);
                triggerLayoutAnimation();
                setAttendanceViewMode('History');
              }}
            >
              <Text
                style={[
                  styles.segmentedModeText,
                  attendanceViewMode === 'History' && styles.segmentedModeTextActive,
                ]}
              >
                History Log
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {attendanceViewMode === 'Roster' ? (
          <>
            {/* Date Stepper Bar: Write Date Once at the Top */}
            <Surface style={styles.rosterDateBar} elevation={1}>
              <TouchableOpacity
                style={styles.rosterDateArrowBtn}
                onPress={() => {
                  triggerHaptic(6);
                  setRosterDate((prev) => shiftISODate(prev, -1));
                }}
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.navy} />
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.rosterDateCenterBtn}
                onPress={() => openCalendarPicker(rosterDate, (picked) => setRosterDate(picked))}
              >
                <Ionicons name="calendar-outline" size={15} color={COLORS.gold} />
                <Text style={styles.rosterDateCenterText}>
                  {rosterDate === todayISO
                    ? `Today • ${formatReadableLocalDate(rosterDate)}`
                    : formatReadableLocalDate(rosterDate)}
                </Text>
              </TouchableOpacity>

              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                {rosterDate !== todayISO ? (
                  <TouchableOpacity
                    style={styles.rosterTodayJumpBtn}
                    onPress={() => {
                      triggerHaptic(8);
                      setRosterDate(todayISO);
                    }}
                  >
                    <Text style={styles.rosterTodayJumpText}>Today</Text>
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity
                  style={styles.rosterDateArrowBtn}
                  onPress={() => {
                    triggerHaptic(6);
                    setRosterDate((prev) => shiftISODate(prev, 1));
                  }}
                >
                  <Ionicons name="chevron-forward" size={18} color={COLORS.navy} />
                </TouchableOpacity>
              </View>
            </Surface>

            {activeStudents.length === 0 ? (
              <Surface style={styles.whiteCard} elevation={2}>
                <EmptyStateWatermark compact message="" />
              </Surface>
            ) : (
              <>
                {activeSubjects.map((subj) => {
                  const subjStudents = activeStudents.filter((s) => s.subjectId === subj.id);
                  if (subjStudents.length === 0) return null;
                  const isCollapsed = Boolean(collapsedRosterSubjects[subj.id]);

                  return (
                    <View key={subj.id} style={styles.directoryGroupBlock}>
                      <View style={styles.groupHeaderBar}>
                        <TouchableOpacity
                          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                          onPress={() => toggleRosterSubjectGroup(subj.id)}
                        >
                          <Ionicons
                            name={isCollapsed ? 'chevron-forward' : 'chevron-down'}
                            size={14}
                            color={COLORS.gold}
                          />
                          <Text style={styles.groupHeaderTitle}>
                            {safeString(subj.name, 'Instrument').toUpperCase()} ({subjStudents.length})
                          </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                          style={styles.bulkMarkPresentChip}
                          onPress={() => handleBulkRosterPresent(subj.id, subj.name)}
                        >
                          <Ionicons name="checkmark-done" size={12} color={COLORS.navy} />
                          <Text style={styles.bulkMarkPresentChipText}>All Present</Text>
                        </TouchableOpacity>
                      </View>

                      {!isCollapsed && (
                        <Surface style={styles.directoryListSurface} elevation={1}>
                          {subjStudents.map((st, idx) =>
                            renderRosterStudentRow(st, idx === subjStudents.length - 1)
                          )}
                        </Surface>
                      )}
                    </View>
                  );
                })}

                {unassignedRosterStudents.length > 0 && (
                  <View style={styles.directoryGroupBlock}>
                    <View style={styles.groupHeaderBar}>
                      <TouchableOpacity
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flex: 1 }}
                        onPress={() => toggleRosterSubjectGroup('_unassigned')}
                      >
                        <Ionicons
                          name={collapsedRosterSubjects._unassigned ? 'chevron-forward' : 'chevron-down'}
                          size={14}
                          color={COLORS.gold}
                        />
                        <Text style={styles.groupHeaderTitle}>
                          UNASSIGNED ({unassignedRosterStudents.length})
                        </Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={styles.bulkMarkPresentChip}
                        onPress={() => handleBulkRosterPresent('_unassigned', 'Unassigned')}
                      >
                        <Ionicons name="checkmark-done" size={12} color={COLORS.navy} />
                        <Text style={styles.bulkMarkPresentChipText}>All Present</Text>
                      </TouchableOpacity>
                    </View>
                    {!collapsedRosterSubjects._unassigned && (
                      <Surface style={styles.directoryListSurface} elevation={1}>
                        {unassignedRosterStudents.map((st, idx) =>
                          renderRosterStudentRow(st, idx === unassignedRosterStudents.length - 1)
                        )}
                      </Surface>
                    )}
                  </View>
                )}
              </>
            )}
          </>
        ) : (
          /* DATE-GROUPED COMPACT HISTORY LOG */
          <>
            <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: 10 }}>
              <DropdownField
                compact
                style={{ width: 160, marginBottom: 0 }}
                valueLabel={attendanceFilterAllMonths ? 'All Months' : 'Last 2 Months'}
                onPress={() =>
                  openDropdownPicker(
                    'Timeframe',
                    [
                      { label: 'Last 2 Months', value: false },
                      { label: 'All Months', value: true },
                    ],
                    attendanceFilterAllMonths,
                    (val) => {
                      triggerLayoutAnimation();
                      setAttendanceFilterAllMonths(val);
                    }
                  )
                }
              />
            </View>

            {historyByDate.length === 0 ? (
              <Surface style={styles.whiteCard} elevation={2}>
                <EmptyStateWatermark compact message="" />
              </Surface>
            ) : (
              historyByDate.map((dBucket) => (
                <View key={dBucket.dateISO} style={styles.directoryGroupBlock}>
                  <View style={styles.groupHeaderBar}>
                    <Text style={styles.groupHeaderTitle}>
                      {formatReadableLocalDate(dBucket.dateISO).toUpperCase()}
                    </Text>
                    <Text style={styles.groupHeaderCount}>{dBucket.items.length} Marked</Text>
                  </View>
                  <Surface style={styles.directoryListSurface} elevation={1}>
                    {dBucket.items.map((att, idx) => {
                      const st = studentMap[att.studentId];
                      const subjName = safeString(subjectMap[st?.subjectId]?.name, 'Unassigned');
                      const isLast = idx === dBucket.items.length - 1;
                      const badgeBg =
                        att.status === 'Present'
                          ? COLORS.successBg
                          : att.status === 'Absent'
                          ? COLORS.dangerBg
                          : COLORS.warningBg;
                      const badgeColor =
                        att.status === 'Present'
                          ? COLORS.success
                          : att.status === 'Absent'
                          ? COLORS.danger
                          : COLORS.warning;

                      return (
                        <Pressable
                          key={att.id}
                          style={({ pressed }) => [
                            styles.directorySlimRow,
                            isLast && { borderBottomWidth: 0 },
                            pressed && { backgroundColor: COLORS.cream },
                          ]}
                          onPress={() => {
                            const hasRem = Boolean(safeString(att.remarks).trim());
                            setShowModalAttNote(hasRem);
                            setAttendanceModalForm({
                              id: att.id,
                              studentId: att.studentId,
                              date: att.date,
                              status: att.status,
                              remarks: safeString(att.remarks),
                            });
                            setAttendanceModal(true);
                          }}
                          onLongPress={() =>
                            openLongPressMenu(
                              'attendance',
                              att,
                              `${safeString(st?.name, 'Student')} - ${att.status} (${formatReadableLocalDate(
                                att.date
                              )})`
                            )
                          }
                          delayLongPress={260}
                        >
                          <View style={{ flex: 1, paddingRight: 8 }}>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                              <Text style={styles.directoryNameText} numberOfLines={1}>
                                {safeString(st?.name, 'Unknown')}
                              </Text>
                              {att._pendingSync ? (
                                <View style={styles.cachedTag}>
                                  <Text style={styles.cachedTagText}>CACHED</Text>
                                </View>
                              ) : null}
                            </View>
                            <Text style={styles.directoryMetaText} numberOfLines={1}>
                              {subjName}
                              {att.remarks ? ` • ${att.remarks}` : ''}
                            </Text>
                          </View>
                          <View style={[styles.directoryStatusBadge, { backgroundColor: badgeBg }]}>
                            <Text style={[styles.directoryStatusBadgeText, { color: badgeColor }]}>
                              {att.status}
                            </Text>
                          </View>
                        </Pressable>
                      );
                    })}
                  </Surface>
                </View>
              ))
            )}
            {visibleHistoryRecords.length < filteredRecords.length && (
              <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => setAttendanceHistoryLimit((n) => n + 50)}>
                Load 50 more records ({filteredRecords.length - visibleHistoryRecords.length} remaining)
              </PaperButton>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  // ==========================================
  // 6D. OVERHAULED FEES TAB: "BANK LEDGER" SEGMENTED LAYOUT
  // ==========================================
  const renderFeesTab = () => {
    const q = safeString(feeSearchQuery).trim().toLowerCase();

    const pendingFeeRecords = activeFees.filter((f) => {
      const isPending =
        safeNumber(f.balanceDue, 0) > 0 || f.status === 'Unpaid' || f.status === 'Partial';
      if (!isPending) return false;
      if (!q) return true;
      const stName = safeString(studentMap[f.studentId]?.name).toLowerCase();
      const subjName = safeString(subjectMap[studentMap[f.studentId]?.subjectId]?.name).toLowerCase();
      return (
        stName.includes(q) ||
        subjName.includes(q) ||
        safeString(f.feeType).toLowerCase().includes(q) ||
        safeString(f.monthPaidFor).toLowerCase().includes(q)
      );
    });

    const historyFeeRecords = activeFees.filter((f) => {
      if (!q) return true;
      const stName = safeString(studentMap[f.studentId]?.name).toLowerCase();
      const subjName = safeString(subjectMap[studentMap[f.studentId]?.subjectId]?.name).toLowerCase();
      return (
        stName.includes(q) ||
        subjName.includes(q) ||
        safeString(f.feeType).toLowerCase().includes(q) ||
        safeString(f.monthPaidFor).toLowerCase().includes(q)
      );
    });

    const displayedRecords = feeLedgerTab === 'Pending' ? pendingFeeRecords : historyFeeRecords;
    const visibleFeeRecords = displayedRecords.slice(0, feeDisplayLimit);

    return (
      <ScrollView
        contentContainerStyle={styles.scrollContentWithFab}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        <View style={styles.tabTopBar}>
          <Text style={styles.pageHeading}>Fee Ledger</Text>
          <TouchableOpacity
            style={[
              styles.floatingSearchToggleBtn,
              (feeSearchVisible || feeSearchQuery.length > 0) && styles.floatingSearchToggleBtnActive,
            ]}
            onPress={() => {
              triggerHaptic(8);
              triggerLayoutAnimation();
              if (feeSearchVisible && feeSearchQuery) {
                setFeeSearchQuery('');
              }
              setFeeSearchVisible(!feeSearchVisible);
            }}
          >
            <Ionicons
              name={feeSearchVisible ? 'close-outline' : 'search-outline'}
              size={20}
              color={feeSearchVisible || feeSearchQuery.length > 0 ? COLORS.gold : COLORS.navy}
            />
          </TouchableOpacity>
        </View>

        {feeSearchVisible && (
          <PaperInput
            mode="outlined"
            label="Filter ledger by student, subject, or month"
            value={feeSearchQuery}
            onChangeText={setFeeSearchQuery}
            autoFocus
            left={<PaperInput.Icon icon="magnify" />}
            right={
              feeSearchQuery.length > 0 ? (
                <PaperInput.Icon icon="close-circle-outline" onPress={() => setFeeSearchQuery('')} />
              ) : null
            }
            outlineColor={COLORS.border}
            activeOutlineColor={COLORS.navy}
            style={[styles.tintedInput, { marginBottom: 12 }]}
          />
        )}

        {/* Top Summary KPI Cards (Tappable to switch segments) */}
        <View style={styles.ledgerSummaryRow}>
          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.ledgerSummaryBox,
              {
                backgroundColor: COLORS.cream,
                borderColor: feeLedgerTab === 'Pending' ? COLORS.danger : COLORS.gold,
                borderWidth: feeLedgerTab === 'Pending' ? 2 : 1,
              },
            ]}
            onPress={() => {
              triggerHaptic(6);
              setFeeLedgerTab('Pending');
            }}
          >
            <Text style={[styles.ledgerSummaryLabel, { color: COLORS.navy }]}>PENDING DUES</Text>
            <Text style={[styles.ledgerSummaryValGold, { color: COLORS.danger }]}>
              ₹{globalFeeTotals.pending.toFixed(2)}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            activeOpacity={0.85}
            style={[
              styles.ledgerSummaryBox,
              {
                backgroundColor: COLORS.navy,
                overflow: 'hidden',
                borderColor: COLORS.gold,
                borderWidth: feeLedgerTab === 'History' ? 2 : 0,
              },
            ]}
            onPress={() => {
              triggerHaptic(6);
              setFeeLedgerTab('History');
            }}
          >
            <SmoothNavyGradient />
            <Text style={styles.ledgerSummaryLabel}>TOTAL COLLECTED</Text>
            <Text style={styles.ledgerSummaryValGold}>₹{globalFeeTotals.collected.toFixed(2)}</Text>
          </TouchableOpacity>
        </View>

        {/* Pinned Segmented Bank Bar: [ Pending Dues ] | [ Transaction History ] */}
        <View style={styles.pillNavContainer}>
          <TouchableOpacity
            style={[styles.pillNavItem, feeLedgerTab === 'Pending' && styles.pillNavItemActive]}
            onPress={() => {
              triggerHaptic(6);
              triggerLayoutAnimation();
              setFeeLedgerTab('Pending');
            }}
          >
            <Text style={[styles.pillNavText, feeLedgerTab === 'Pending' && styles.pillNavTextActive]}>
              Pending Dues ({pendingFeeRecords.length})
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.pillNavItem, feeLedgerTab === 'History' && styles.pillNavItemActive]}
            onPress={() => {
              triggerHaptic(6);
              triggerLayoutAnimation();
              setFeeLedgerTab('History');
            }}
          >
            <Text style={[styles.pillNavText, feeLedgerTab === 'History' && styles.pillNavTextActive]}>
              Transaction History ({historyFeeRecords.length})
            </Text>
          </TouchableOpacity>
        </View>

        {displayedRecords.length === 0 ? (
          <Surface style={styles.whiteCard} elevation={2}>
            <EmptyStateWatermark compact message="" />
          </Surface>
        ) : (
          <Surface style={styles.directoryListSurface} elevation={1}>
            {visibleFeeRecords.map((fee, idx) => {
              const st = studentMap[fee.studentId];
              const subjName = safeString(subjectMap[st?.subjectId]?.name, 'Unassigned');
              const isLast = idx === visibleFeeRecords.length - 1;
              const dueVal = safeNumber(fee.balanceDue, 0);
              const paidVal = safeNumber(fee.amountPaid, 0);
              const hasDue = dueVal > 0 || fee.status === 'Unpaid' || fee.status === 'Partial';

              return (
                <Pressable
                  key={fee.id}
                  style={({ pressed }) => [
                    styles.directorySlimRow,
                    isLast && { borderBottomWidth: 0 },
                    pressed && { backgroundColor: COLORS.cream },
                  ]}
                  onPress={() => {
                    const hasRem = Boolean(safeString(fee.remarks).trim());
                    setShowFeeNote(hasRem);
                    setFeeForm({
                      id: fee.id,
                      studentId: fee.studentId,
                      feeType: safeString(fee.feeType, 'Monthly Fee'),
                      monthPaidFor: safeString(fee.monthPaidFor, getLocalCurrentMonthLabel()),
                      date: safeString(fee.date, getTodayISO()),
                      mode: safeString(fee.mode, 'UPI'),
                      status: safeString(fee.status, 'Paid'),
                      amountPaid: String(paidVal),
                      balanceDue: String(dueVal),
                      remarks: safeString(fee.remarks),
                    });
                    setFeeModal(true);
                  }}
                  onLongPress={() =>
                    openLongPressMenu('fee', fee, `${safeString(st?.name, 'Student')} - ₹${paidVal}`)
                  }
                  delayLongPress={260}
                >
                  {/* Left Ledger Status Icon */}
                  <View
                    style={[
                      styles.ledgerRowIconWrap,
                      { backgroundColor: hasDue ? COLORS.dangerBg : COLORS.successBg },
                    ]}
                  >
                    <Ionicons
                      name={hasDue ? 'alert-circle-outline' : 'checkmark-circle-outline'}
                      size={16}
                      color={hasDue ? COLORS.danger : COLORS.success}
                    />
                  </View>

                  {/* Center Student & Transaction Meta */}
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
                      <Text style={styles.directoryNameText} numberOfLines={1}>
                        {safeString(st?.name, 'Unknown')}
                      </Text>
                      <Text style={styles.ledgerSubjPillText}>• {subjName}</Text>
                      {fee._pendingSync ? (
                        <View style={styles.cachedTag}>
                          <Text style={styles.cachedTagText}>CACHED</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.directoryMetaText} numberOfLines={1}>
                      {fee.feeType}
                      {fee.feeType === 'Monthly Fee' && fee.monthPaidFor ? ` (${fee.monthPaidFor})` : ''} •{' '}
                      {formatReadableLocalDate(fee.date)} • {fee.mode}
                    </Text>
                  </View>

                  {/* Right Figures & Quick Action */}
                  {feeLedgerTab === 'Pending' ? (
                    <View style={{ alignItems: 'flex-end', gap: 4 }}>
                      <Text style={styles.ledgerDueAmountText}>Due ₹{dueVal}</Text>
                      <TouchableOpacity
                        style={styles.settleQuickBtn}
                        onPress={() => handleQuickSettleFee(fee)}
                      >
                        <Text style={styles.settleQuickBtnText}>Settle</Text>
                      </TouchableOpacity>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <View style={{ alignItems: 'flex-end' }}>
                        <Text style={styles.ledgerPaidAmountText}>+₹{paidVal}</Text>
                        {hasDue ? (
                          <Text style={styles.ledgerDueSubText}>Due ₹{dueVal}</Text>
                        ) : (
                          <Text style={styles.ledgerPaidSubText}>Paid</Text>
                        )}
                      </View>
                      <TouchableOpacity
                        style={styles.pdfExportTouchBtn}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                        onPress={() => generateAndShareReceiptPDF(fee)}
                      >
                        <Ionicons name="share-social-outline" size={14} color={COLORS.gold} />
                      </TouchableOpacity>
                    </View>
                  )}
                </Pressable>
              );
            })}
          </Surface>
        )}
        {visibleFeeRecords.length < displayedRecords.length ? (
          <TouchableOpacity
            style={[styles.emptyStateActionBtn, { alignSelf: 'center', marginVertical: 14 }]}
            onPress={() => setFeeDisplayLimit((current) => current + 50)}
          >
            <Text style={styles.emptyStateActionText}>Load 50 more ({displayedRecords.length - visibleFeeRecords.length} remaining)</Text>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    );
  };
// ==========================================
// PART 2:b OF 2 (FINAL)
// ==========================================

  // ==========================================
  // 6E. TRASH TAB: ARCHIVE & CASCADE RECOVERY
  // ==========================================
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
            <EmptyStateWatermark compact message="" />
          </Surface>
        ) : (
          trashItems.slice(0, trashDisplayLimit).map((item) => {
            return (
              <ScalePressable
                key={`${item._col}-${item.id}`}
                onPress={() => {
                  triggerHaptic(10);
                  Alert.alert(item._label, 'This item stays in Trash until you restore it or permanently delete it.', [
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
                    <Text style={styles.daysRemainingText}>In Trash</Text>
                  </View>
                </Surface>
              </ScalePressable>
            );
          })
        )}
        {trashItems.length > trashDisplayLimit && (
          <PaperButton mode="outlined" textColor={COLORS.navy} onPress={() => setTrashDisplayLimit((n) => n + 50)}>
            Load 50 more items ({trashItems.length - trashDisplayLimit} remaining)
          </PaperButton>
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
          setShowFeeNote(false);
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
          setShowModalAttNote(false);
          setAttendanceModalForm({
            id: null,
            studentId: activeStudents[0]?.id || '',
            date: rosterDate,
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
          setShowFeeNote(false);
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
  const anyFormModalOpen =
    studentModal || lessonEditModal || attendanceModal || feeModal || studentReportModal.visible;

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.navy} />

      {/* Top Navigation Bar */}
      <View style={styles.gradientHeaderWrapper}>
        <SmoothNavyGradient />
        <Appbar.Header statusBarHeight={0} style={{ backgroundColor: 'transparent', elevation: 0 }}>
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
        {!isInsideStudentProfile && (
          <PanGestureHandler
            activeOffsetX={10}
            failOffsetY={[-18, 18]}
            onHandlerStateChange={(e) => {
              if (e.nativeEvent.state === State.END && e.nativeEvent.translationX > 24) {
                openDrawer();
              }
            }}
          >
            <View style={styles.leftEdgeSwipeZone} />
          </PanGestureHandler>
        )}

        <AnimatedScreen
          direction={navDirection}
          onSwipe={handleMainTabSwipe}
          swipeEnabled={!isInsideStudentProfile && activeTab !== 'Home'}
          triggerKey={`${activeTab}-${selectedStudentId || 'list'}`}
        >
          {activeTab === 'Home' && renderHomeTab()}
          {activeTab === 'Students' && renderStudentsTab()}
          {activeTab === 'Attendance' && renderAttendanceTab()}
          {activeTab === 'Fees' && renderFeesTab()}
          {activeTab === 'Trash' && renderTrashTab()}
        </AnimatedScreen>

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
        {!anyFormModalOpen && !masterListModal && renderDropdownOverlay()}
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
              onHandlerStateChange={(e) => {
                if (e.nativeEvent.state === State.END && e.nativeEvent.translationX < -30) {
                  closeDrawer();
                }
              }}
            >
              <Animated.View style={[styles.drawerContainer, { transform: [{ translateX: drawerSlideAnim }] }]}>
            <View style={styles.drawerHeader}>
                  <SmoothNavyGradient />
                  <Text style={styles.crestBadgeText}>★ JSM ★</Text>
                  <Text style={styles.drawerTitle}>Music School Portal</Text>
                  <Text style={styles.drawerSub}>Est. 2022 • Official Edition</Text>
                  <Text selectable style={[styles.drawerSub, { color: COLORS.gold, marginTop: 6, fontSize: 11 }]}>
                    {authStatusText}
                  </Text>
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

      {/* SINGLE STUDENT DATA & PRINT MODAL */}
      <Modal
        visible={studentReportModal.visible}
        animationType="slide"
        onRequestClose={() => {
          if (dropdownPicker.visible) closeDropdownPicker();
          else if (calendarPicker.visible) closeCalendarPicker();
          else setStudentReportModal({ visible: false, studentId: null, dateFilter: '' });
        }}
      >
        <SafeAreaProvider>
          <SafeAreaView style={styles.fullScreenModalSafe}>
            <View style={styles.fullScreenModalHeader}>
              <SmoothNavyGradient />
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={styles.fullScreenModalTitle} numberOfLines={1}>
                  {studentReportData?.student?.name || 'Student'}
                </Text>
                <Text style={{ color: COLORS.gold, fontSize: 11, fontWeight: '600', marginTop: 2 }}>
                  {studentReportData?.subjectName || ''}
                </Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                <TouchableOpacity
                  style={[
                    styles.quickDateChipCalendar,
                    studentReportModal.dateFilter && { backgroundColor: COLORS.gold },
                  ]}
                  onPress={() =>
                    openCalendarPicker(studentReportModal.dateFilter || getTodayISO(), (picked) => {
                      setStudentReportModal((prev) => ({ ...prev, dateFilter: picked }));
                    })
                  }
                >
                  <Ionicons
                    name="calendar-outline"
                    size={14}
                    color={studentReportModal.dateFilter ? COLORS.navy : COLORS.gold}
                  />
                  <Text
                    style={[
                      styles.quickDateChipCalendarText,
                      studentReportModal.dateFilter && { color: COLORS.navy },
                    ]}
                  >
                    {studentReportModal.dateFilter
                      ? formatReadableLocalDate(studentReportModal.dateFilter)
                      : 'Date'}
                  </Text>
                </TouchableOpacity>
                {studentReportModal.dateFilter ? (
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    onPress={() => setStudentReportModal((prev) => ({ ...prev, dateFilter: '' }))}
                  >
                    <Ionicons name="close-outline" size={16} color={COLORS.danger} />
                  </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.pdfExportTouchBtn} onPress={printStudentReport}>
                  <Ionicons name="print-outline" size={15} color={COLORS.gold} />
                  <Text style={styles.pdfExportTouchBtnText}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.fullScreenCloseBtn}
                  onPress={() => {
                    closeDropdownPicker();
                    closeCalendarPicker();
                    setStudentReportModal({ visible: false, studentId: null, dateFilter: '' });
                  }}
                >
                  <Ionicons name="close-outline" size={24} color={COLORS.gold} />
                </TouchableOpacity>
              </View>
            </View>

            {studentReportData ? (
              <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
                {studentReportData.student.notes ? (
                  <Surface style={styles.whiteCard} elevation={2}>
                    <Text style={styles.sectionTitle}>NOTES</Text>
                    <Text style={[styles.recordDetailLine, { marginTop: 6 }]}>
                      {studentReportData.student.notes}
                    </Text>
                  </Surface>
                ) : null}

                <View style={styles.groupBlock}>
                  <View style={styles.groupHeaderBar}>
                    <Text style={styles.groupHeaderTitle}>CLASSES</Text>
                    <Text style={styles.groupHeaderCount}>{studentReportData.stLessons.length}</Text>
                  </View>
                  {studentReportData.stLessons.length === 0 ? (
                    <Surface style={styles.whiteCard} elevation={1}>
                      <EmptyStateWatermark compact message="" />
                    </Surface>
                  ) : (
                    studentReportData.stLessons.map((les) => (
                      <Surface key={les.id} style={styles.cleanRecordCard} elevation={1}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordPrimaryTitle}>{formatReadableLocalDate(les.date)}</Text>
                          {les.lesson ? (
                            <Text style={styles.recordDetailLine}>
                              <Text style={styles.boldLabel}>Lesson: </Text>
                              {les.lesson}
                            </Text>
                          ) : null}
                          {les.technique ? (
                            <Text style={styles.recordDetailLine}>
                              <Text style={styles.boldLabel}>Technique: </Text>
                              {les.technique}
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
                    ))
                  )}
                </View>

                <View style={styles.groupBlock}>
                  <View style={styles.groupHeaderBar}>
                    <Text style={styles.groupHeaderTitle}>ATTENDANCE</Text>
                    <Text style={styles.groupHeaderCount}>{studentReportData.stAtt.length}</Text>
                  </View>
                  {studentReportData.stAtt.length === 0 ? (
                    <Surface style={styles.whiteCard} elevation={1}>
                      <EmptyStateWatermark compact message="" />
                    </Surface>
                  ) : (
                    studentReportData.stAtt.map((att) => (
                      <Surface key={att.id} style={styles.cleanRecordCard} elevation={1}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordPrimaryTitle}>{formatReadableLocalDate(att.date)}</Text>
                          {att.remarks ? <Text style={styles.recordSecondarySub}>{att.remarks}</Text> : null}
                        </View>
                        <View style={styles.statusPill}>
                          <Text style={styles.statusPillText}>{att.status}</Text>
                        </View>
                      </Surface>
                    ))
                  )}
                </View>

                <View style={styles.groupBlock}>
                  <View style={styles.groupHeaderBar}>
                    <Text style={styles.groupHeaderTitle}>FEES</Text>
                    <Text style={styles.groupHeaderCount}>
                      Paid ₹{studentReportData.totalPaid} • Due ₹{studentReportData.totalDue}
                    </Text>
                  </View>
                  {studentReportData.stFees.length === 0 ? (
                    <Surface style={styles.whiteCard} elevation={1}>
                      <EmptyStateWatermark compact message="" />
                    </Surface>
                  ) : (
                    studentReportData.stFees.map((fee) => (
                      <Surface key={fee.id} style={styles.cleanRecordCard} elevation={1}>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.recordPrimaryTitle}>
                            {fee.feeType}
                            {fee.feeType === 'Monthly Fee' && fee.monthPaidFor ? ` • ${fee.monthPaidFor}` : ''}
                          </Text>
                          <Text style={styles.recordSecondarySub}>
                            {formatReadableLocalDate(fee.date)} • {fee.mode} • {fee.status}
                          </Text>
                          <Text style={styles.recordDetailLine}>
                            Paid: ₹{fee.amountPaid}
                            {safeNumber(fee.balanceDue, 0) > 0 ? ` | Balance: ₹${fee.balanceDue}` : ''}
                          </Text>
                        </View>
                      </Surface>
                    ))
                  )}
                </View>
              </ScrollView>
            ) : null}
            {renderCalendarOverlay()}
            {renderDropdownOverlay()}
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      {/* MASTER LIST & REPORT GENERATOR MODAL */}
      <Modal
        visible={masterListModal}
        animationType="slide"
        onRequestClose={() => {
          if (dropdownPicker.visible) closeDropdownPicker();
          else if (calendarPicker.visible) closeCalendarPicker();
          else setMasterListModal(false);
        }}
      >
        <SafeAreaProvider>
          <SafeAreaView style={styles.fullScreenModalSafe}>
            <View style={styles.fullScreenModalHeader}>
              <SmoothNavyGradient />
              <View style={{ flex: 1 }}>
                <Text style={styles.fullScreenModalTitle}>Master Student List</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <TouchableOpacity style={styles.pdfExportTouchBtn} onPress={exportMasterListPDF}>
                  <Ionicons name="print-outline" size={15} color={COLORS.gold} />
                  <Text style={styles.pdfExportTouchBtnText}>Print</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.fullScreenCloseBtn}
                  onPress={() => {
                    closeDropdownPicker();
                    closeCalendarPicker();
                    setMasterListModal(false);
                  }}
                >
                  <Ionicons name="close-outline" size={26} color={COLORS.gold} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.masterFilterSection}>
              <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
                <DropdownField
                  compact
                  label="Student"
                  style={{ flex: 1, marginBottom: 0 }}
                  valueLabel={
                    masterStudentFilter === 'ALL'
                      ? `All Students (${activeStudents.length})`
                      : studentMap[masterStudentFilter]?.name || 'Select'
                  }
                  onPress={() =>
                    openDropdownPicker(
                      'Select Student',
                      [
                        { label: `All Students (${activeStudents.length})`, value: 'ALL' },
                        ...activeStudents.map((st) => ({ label: st.name, value: st.id })),
                      ],
                      masterStudentFilter,
                      (val) => setMasterStudentFilter(val)
                    )
                  }
                />

                <DropdownField
                  compact
                  label="Month"
                  style={{ flex: 1, marginBottom: 0 }}
                  valueLabel={
                    masterDateFilter
                      ? formatReadableLocalDate(masterDateFilter)
                      : masterMonthFilter === 'ALL'
                      ? 'All Time'
                      : masterMonthFilter
                  }
                  onPress={() =>
                    openDropdownPicker(
                      'Select Period',
                      [
                        { label: 'All Time', value: 'ALL' },
                        ...availableMasterMonths.map((m) => ({ label: m, value: m })),
                      ],
                      masterMonthFilter,
                      (val) => {
                        setMasterDateFilter('');
                        setMasterMonthFilter(val);
                      }
                    )
                  }
                />

                <TouchableOpacity
                  style={[styles.calendarIconBtn, masterDateFilter && { backgroundColor: COLORS.gold }]}
                  onPress={() =>
                    openCalendarPicker(masterDateFilter || getTodayISO(), (picked) => {
                      setMasterMonthFilter('ALL');
                      setMasterDateFilter(picked);
                    })
                  }
                >
                  <Ionicons
                    name="calendar-outline"
                    size={18}
                    color={masterDateFilter ? COLORS.navy : COLORS.gold}
                  />
                </TouchableOpacity>
                {masterDateFilter ? (
                  <TouchableOpacity
                    style={styles.iconActionBtn}
                    onPress={() => setMasterDateFilter('')}
                  >
                    <Ionicons name="close-outline" size={18} color={COLORS.danger} />
                  </TouchableOpacity>
                ) : null}
              </View>
            </View>

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              {masterListData.length === 0 ? (
                <Surface style={styles.whiteCard} elevation={2}>
                  <EmptyStateWatermark compact message="" />
                </Surface>
              ) : (
                masterListData.map((row) => (
                  <Surface
                    key={row.student.id}
                    style={[styles.whiteCard, { marginBottom: 12, padding: 16 }]}
                    elevation={2}
                  >
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
                    <Text style={[styles.recordDetailLine, { marginTop: 8 }]} numberOfLines={2}>
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
                        : '—'}
                    </Text>
                    <Text style={styles.recordDetailLine} numberOfLines={2}>
                      <Text style={styles.boldLabel}>Attendance: </Text>
                      {row.stAtt.length > 0
                        ? row.stAtt
                            .slice(0, 4)
                            .map((a) => `${formatReadableLocalDate(a.date)}: ${a.status}`)
                            .join('  •  ')
                        : '—'}
                    </Text>
                    <Text style={styles.recordDetailLine} numberOfLines={2}>
                      <Text style={styles.boldLabel}>Fees: </Text>
                      {row.stFees.length > 0
                        ? row.stFees
                            .slice(0, 3)
                            .map((f) => `${formatReadableLocalDate(f.date)}: ₹${f.amountPaid} (${f.status})`)
                            .join('  •  ')
                        : '—'}
                    </Text>
                  </Surface>
                ))
              )}
            </ScrollView>
            {renderCalendarOverlay()}
            {renderDropdownOverlay()}
          </SafeAreaView>
        </SafeAreaProvider>
      </Modal>

      {/* BOTTOM-SLIDING CONTEXTUAL ACTION SHEET */}
      <Modal
        visible={contextMenu.visible}
        transparent
        animationType="slide"
        onRequestClose={dismissContextMenuWithReopen}
      >
        <Pressable style={styles.bottomSheetBackdrop} onPress={dismissContextMenuWithReopen}>
          <Pressable style={styles.bottomContextSheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.bottomSheetPill} />
            <Text style={styles.contextSheetHeader}>{contextMenu.title}</Text>
            <View style={{ height: 8 }} />
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
              onPress={dismissContextMenuWithReopen}
            >
              Cancel
            </PaperButton>
          </Pressable>
        </Pressable>
      </Modal>

      {/* NOTICE BOARD MODAL */}
      <Modal visible={noticeEditModal} transparent animationType="fade" onRequestClose={() => setNoticeEditModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <View style={styles.cardHeaderRow}>
              <Text style={styles.sectionTitle}>NOTICE BOARD</Text>
              {noticeUpdatedAt ? (
                <Text style={styles.silverMeta}>{formatReadableLocalDate(noticeUpdatedAt)}</Text>
              ) : null}
            </View>
            <PaperInput
              mode="outlined"
              label="Announcement"
              multiline
              numberOfLines={5}
              value={noticeInput}
              onChangeText={setNoticeInput}
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
        <SafeAreaProvider>
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

            {activityLogError ? (
              <Text
                accessibilityRole="alert"
                style={{ color: COLORS.danger, fontSize: 13, paddingHorizontal: 18, paddingTop: 10 }}
              >
                {activityLogError}
              </Text>
            ) : null}

            <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
              {displayedActivities.length === 0 ? (
                <Surface style={styles.whiteCard} elevation={2}>
                  <EmptyStateWatermark compact message="" />
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
        </SafeAreaProvider>
      </Modal>

      {/* MANAGE SUBJECTS MODAL */}
      <Modal visible={subjectsModal} transparent animationType="fade" onRequestClose={closeSubjectsModalClean}>
        <GestureHandlerRootView style={{ flex: 1 }}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
            <Surface style={styles.modalCard} elevation={5}>
              <Text style={styles.sectionTitle}>SUBJECTS</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 12, alignItems: 'center' }}>
                <PaperInput
                  mode="outlined"
                  label="Subject"
                  value={subjectForm.name}
                  onChangeText={(t) => setSubjectForm({ ...subjectForm, name: t })}
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={[styles.tintedInput, { flex: 1, marginBottom: 0 }]}
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
                  <EmptyStateWatermark compact message="" />
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
                            { height: 52, paddingVertical: 8, paddingHorizontal: 12 },
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
                            <Text style={styles.recordPrimaryTitle} numberOfLines={1}>
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
                onPress={closeSubjectsModalClean}
              >
                Done
              </PaperButton>
            </Surface>
          </KeyboardAvoidingView>
        </GestureHandlerRootView>
      </Modal>

      {/* REGISTER / EDIT STUDENT MODAL */}
      <Modal
        visible={studentModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (dropdownPicker.visible) closeDropdownPicker();
          else if (calendarPicker.visible) closeCalendarPicker();
          else setStudentModal(false);
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>
              {studentForm.id ? 'EDIT STUDENT' : 'NEW STUDENT'}
            </Text>
            <ScrollView style={{ maxHeight: 380, marginTop: 8 }} keyboardShouldPersistTaps="handled">
              <PaperInput
                mode="outlined"
                label="Full Name *"
                value={studentForm.name}
                onChangeText={(t) => setStudentForm({ ...studentForm, name: t })}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <DropdownField
                label="Subject *"
                valueLabel={
                  subjectMap[studentForm.subjectId]?.name
                    ? `${subjectMap[studentForm.subjectId].name}${
                        subjectMap[studentForm.subjectId].isDeleted ? ' (In Trash)' : ''
                      }`
                    : 'Select Subject'
                }
                onPress={() => {
                  const currentSubj = subjectMap[studentForm.subjectId];
                  const subjOptions = activeSubjects.map((s) => ({ label: s.name, value: s.id }));
                  if (currentSubj && currentSubj.isDeleted) {
                    subjOptions.unshift({
                      label: `${currentSubj.name} (In Trash)`,
                      value: currentSubj.id,
                    });
                  }
                  openDropdownPicker(
                    'Select Subject',
                    subjOptions,
                    studentForm.subjectId,
                    (val) => setStudentForm({ ...studentForm, subjectId: val })
                  );
                }}
              />
              <PaperInput
                mode="outlined"
                label="Phone / WhatsApp"
                value={studentForm.phone}
                onChangeText={(t) => setStudentForm({ ...studentForm, phone: t })}
                keyboardType="phone-pad"
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <PaperInput
                mode="outlined"
                label="Parent / Guardian"
                value={studentForm.guardian}
                onChangeText={(t) => setStudentForm({ ...studentForm, guardian: t })}
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
                label="Joined Date"
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
                  closeDropdownPicker();
                  closeCalendarPicker();
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
          {renderDropdownOverlay()}
        </KeyboardAvoidingView>
      </Modal>

      {/* EDIT LESSON MODAL */}
      <Modal
        visible={lessonEditModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (calendarPicker.visible) closeCalendarPicker();
          else setLessonEditModal(false);
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
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
                label="Date"
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
                label="Technique"
                value={lessonEditForm.technique}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, technique: t })}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <PaperInput
                mode="outlined"
                label="Lesson"
                value={lessonEditForm.lesson}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, lesson: t })}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <PaperInput
                mode="outlined"
                label="Repertoire"
                value={lessonEditForm.repertoire}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, repertoire: t })}
                outlineColor={COLORS.border}
                activeOutlineColor={COLORS.navy}
                style={styles.tintedInput}
              />
              <PaperInput
                mode="outlined"
                label="Assignment"
                value={lessonEditForm.assignment}
                onChangeText={(t) => setLessonEditForm({ ...lessonEditForm, assignment: t })}
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
                  closeCalendarPicker();
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
        onRequestClose={() => {
          if (dropdownPicker.visible) closeDropdownPicker();
          else if (calendarPicker.visible) closeCalendarPicker();
          else setAttendanceModal(false);
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>
              {attendanceModalForm.id ? 'EDIT ATTENDANCE' : 'MARK ATTENDANCE'}
            </Text>
            <ScrollView style={{ maxHeight: 360, marginTop: 10 }} keyboardShouldPersistTaps="handled">
              <DropdownField
                label="Student"
                valueLabel={studentMap[attendanceModalForm.studentId]?.name || 'Select Student'}
                onPress={() =>
                  openDropdownPicker(
                    'Select Student',
                    activeStudents.map((st) => ({ label: st.name, value: st.id })),
                    attendanceModalForm.studentId,
                    (val) => setAttendanceModalForm({ ...attendanceModalForm, studentId: val })
                  )
                }
              />
              <QuickDateRow
                currentDate={attendanceModalForm.date}
                onSelectDate={(d) => setAttendanceModalForm({ ...attendanceModalForm, date: d })}
                onOpenCalendar={openCalendarPicker}
              />
              <PaperInput
                mode="outlined"
                label="Date"
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
              <DropdownField
                label="Attendance Status"
                valueLabel={attendanceModalForm.status}
                onPress={() =>
                  openDropdownPicker(
                    'Attendance Status',
                    ATTENDANCE_STATUSES.map((s) => ({ label: s, value: s })),
                    attendanceModalForm.status,
                    (val) => setAttendanceModalForm({ ...attendanceModalForm, status: val })
                  )
                }
              />
              {showModalAttNote || Boolean(attendanceModalForm.remarks) ? (
                <PaperInput
                  mode="outlined"
                  label="Note / Remarks"
                  value={attendanceModalForm.remarks}
                  onChangeText={(t) => setAttendanceModalForm({ ...attendanceModalForm, remarks: t })}
                  right={
                    <PaperInput.Icon
                      icon="close"
                      onPress={() => {
                        triggerLayoutAnimation();
                        setAttendanceModalForm({ ...attendanceModalForm, remarks: '' });
                        setShowModalAttNote(false);
                      }}
                    />
                  }
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
              ) : (
                <TouchableOpacity
                  style={styles.addNoteToggleBtn}
                  onPress={() => {
                    triggerLayoutAnimation();
                    setShowModalAttNote(true);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={15} color={COLORS.navy} />
                  <Text style={styles.addNoteToggleText}>+ Add Note</Text>
                </TouchableOpacity>
              )}
            </ScrollView>
            <View style={styles.modalBtnRow}>
              <PaperButton
                mode="outlined"
                textColor={COLORS.navy}
                onPress={() => {
                  Keyboard.dismiss();
                  closeDropdownPicker();
                  closeCalendarPicker();
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
          {renderDropdownOverlay()}
        </KeyboardAvoidingView>
      </Modal>

      {/* RECORD / EDIT FEE MODAL */}
      <Modal
        visible={feeModal}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (dropdownPicker.visible) closeDropdownPicker();
          else if (calendarPicker.visible) closeCalendarPicker();
          else {
            setFeeModal(false);
          }
        }}
      >
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.modalBackdrop}>
          <Surface style={styles.modalCard} elevation={5}>
            <Text style={styles.sectionTitle}>{feeForm.id ? 'EDIT FEE' : 'RECORD FEE'}</Text>
            <ScrollView style={{ maxHeight: 420, marginTop: 10 }} keyboardShouldPersistTaps="handled">
              <DropdownField
                label="Student"
                valueLabel={studentMap[feeForm.studentId]?.name || 'Select Student'}
                onPress={() =>
                  openDropdownPicker(
                    'Select Student',
                    activeStudents.map((st) => ({ label: st.name, value: st.id })),
                    feeForm.studentId,
                    (val) => setFeeForm({ ...feeForm, studentId: val })
                  )
                }
              />

              <DropdownField
                label="Fee Category"
                valueLabel={feeForm.feeType}
                onPress={() =>
                  openDropdownPicker(
                    'Fee Category',
                    FEE_TYPES.map((ft) => ({ label: ft, value: ft })),
                    feeForm.feeType,
                    (val) => {
                      triggerLayoutAnimation();
                      setFeeForm({ ...feeForm, feeType: val });
                    }
                  )
                }
              />

              {feeForm.feeType === 'Monthly Fee' && (
                <DropdownField
                  label="Month Paid For *"
                  valueLabel={feeForm.monthPaidFor || getLocalCurrentMonthLabel()}
                  onPress={() =>
                    openDropdownPicker(
                      'Month Paid For',
                      getSelectableMonthsList(feeForm.monthPaidFor).map((m) => ({
                        label: m,
                        value: m,
                      })),
                      feeForm.monthPaidFor,
                      (val) => setFeeForm({ ...feeForm, monthPaidFor: val })
                    )
                  }
                />
              )}

              <QuickDateRow
                currentDate={feeForm.date}
                onSelectDate={(d) => setFeeForm({ ...feeForm, date: d })}
                onOpenCalendar={openCalendarPicker}
              />
              <PaperInput
                mode="outlined"
                label="Date"
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

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <DropdownField
                  label="Payment Mode"
                  style={{ flex: 1 }}
                  valueLabel={feeForm.mode}
                  onPress={() =>
                    openDropdownPicker(
                      'Payment Mode',
                      PAYMENT_MODES.map((m) => ({ label: m, value: m })),
                      feeForm.mode,
                      (val) => setFeeForm({ ...feeForm, mode: val })
                    )
                  }
                />

                <DropdownField
                  label="Status"
                  style={{ flex: 1 }}
                  valueLabel={feeForm.status}
                  onPress={() =>
                    openDropdownPicker(
                      'Payment Status',
                      FEE_STATUSES.map((st) => ({ label: st, value: st })),
                      feeForm.status,
                      (st) => {
                        triggerLayoutAnimation();
                        if (st === 'Unpaid') {
                          setFeeForm({
                            ...feeForm,
                            status: st,
                            amountPaid: '0',
                            balanceDue: feeForm.balanceDue === '0' ? '' : feeForm.balanceDue,
                          });
                        } else if (st === 'Paid') {
                          setFeeForm({
                            ...feeForm,
                            status: st,
                            amountPaid: feeForm.amountPaid === '0' ? '' : feeForm.amountPaid,
                            balanceDue: '0',
                          });
                        } else {
                          setFeeForm({
                            ...feeForm,
                            status: st,
                            amountPaid: feeForm.amountPaid === '0' ? '' : feeForm.amountPaid,
                            balanceDue: feeForm.balanceDue === '0' ? '' : feeForm.balanceDue,
                          });
                        }
                      }
                    )
                  }
                />
              </View>

              {feeForm.status !== 'Unpaid' && (
                <PaperInput
                  mode="outlined"
                  label="Amount Paid (₹)"
                  keyboardType="numeric"
                  value={feeForm.amountPaid}
                  onChangeText={(t) => setFeeForm({ ...feeForm, amountPaid: sanitizeCurrency(t) })}
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
              )}

              {(feeForm.status === 'Partial' || feeForm.status === 'Unpaid') && (
                <PaperInput
                  mode="outlined"
                  label="Balance Due (₹)"
                  keyboardType="numeric"
                  value={feeForm.balanceDue}
                  onChangeText={(t) => setFeeForm({ ...feeForm, balanceDue: sanitizeCurrency(t) })}
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
              )}

              {showFeeNote || Boolean(feeForm.remarks) ? (
                <PaperInput
                  mode="outlined"
                  label="Note / Remarks"
                  value={feeForm.remarks}
                  onChangeText={(t) => setFeeForm({ ...feeForm, remarks: t })}
                  right={
                    <PaperInput.Icon
                      icon="close"
                      onPress={() => {
                        triggerLayoutAnimation();
                        setFeeForm({ ...feeForm, remarks: '' });
                        setShowFeeNote(false);
                      }}
                    />
                  }
                  outlineColor={COLORS.border}
                  activeOutlineColor={COLORS.navy}
                  style={styles.tintedInput}
                />
              ) : (
                <TouchableOpacity
                  style={styles.addNoteToggleBtn}
                  onPress={() => {
                    triggerLayoutAnimation();
                    setShowFeeNote(true);
                  }}
                >
                  <Ionicons name="add-circle-outline" size={15} color={COLORS.navy} />
                  <Text style={styles.addNoteToggleText}>+ Add Note</Text>
                </TouchableOpacity>
              )}
            </ScrollView>

            <View style={[styles.modalBtnRow, { alignItems: 'center' }]}>
              <PaperButton
                mode="outlined"
                textColor={COLORS.navy}
                onPress={() => {
                  Keyboard.dismiss();
                  closeDropdownPicker();
                  closeCalendarPicker();
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
              <TouchableOpacity
                style={styles.iconShareBtnGold}
                onPress={() => handleSaveFee(true)}
              >
                <Ionicons name="share-social-outline" size={18} color={COLORS.navy} />
              </TouchableOpacity>
            </View>
          </Surface>
          {renderCalendarOverlay()}
          {renderDropdownOverlay()}
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

  // --- DROPDOWN FIELD & PORTAL STYLES ---
  dropdownField: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: COLORS.inputTint,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 9,
    marginBottom: 10,
    minHeight: 52,
  },
  dropdownFieldCompact: {
    minHeight: 42,
    paddingVertical: 6,
    paddingHorizontal: 11,
  },
  dropdownFloatingLabel: {
    color: COLORS.silver,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  dropdownValueText: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  dropdownPortalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(5, 19, 41, 0.6)',
    justifyContent: 'center',
    padding: 22,
    zIndex: 9999,
    elevation: 22,
  },
  dropdownModalCard: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    padding: 18,
    borderWidth: 1.5,
    borderColor: COLORS.gold,
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.22,
    shadowRadius: 16,
    elevation: 8,
  },
  dropdownOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginVertical: 2,
  },
  dropdownOptionRowSelected: {
    backgroundColor: COLORS.navy,
  },
  dropdownOptionText: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  dropdownOptionTextSelected: {
    color: COLORS.gold,
    fontWeight: '800',
  },
  addNoteToggleBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 5,
    paddingVertical: 6,
    paddingHorizontal: 4,
    marginBottom: 6,
  },
  addNoteToggleText: {
    color: COLORS.navy,
    fontSize: 12,
    fontWeight: '700',
  },
  iconShareBtnGold: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.navy,
  },
  activeFilterPill: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  activeFilterPillText: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '700',
  },
  calendarIconBtn: {
    width: 42,
    height: 42,
    borderRadius: 8,
    backgroundColor: COLORS.navy,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.gold,
  },

  // --- HOMEPAGE: SLIM GREETING + LARGER NOTICE BOARD + HORIZONTAL MATRIX ---
  homeNoScrollContainer: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    gap: 10,
  },
  compactGreetingStrip: {
    backgroundColor: COLORS.navy,
    borderRadius: 12,
    paddingVertical: 8,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'hidden',
    shadowColor: COLORS.midnight,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 2,
  },
  compactGreetingTitle: {
    color: COLORS.white,
    fontSize: 15,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
  },
  compactGreetingDate: {
    color: COLORS.gold,
    fontSize: 11,
    fontWeight: '600',
  },
  compactActionSection: {
    gap: 10,
  },
  compactNoticeCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 96,
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
    marginBottom: 6,
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
    lineHeight: 19,
  },
  threeSmallCardsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  smallActionCard: {
    borderRadius: 16,
    paddingVertical: 11,
    paddingHorizontal: 12,
    height: 74,
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
    paddingTop: 10,
    paddingBottom: 8,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  liveWidgetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
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
  masterListBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  masterListBtnText: {
    color: COLORS.gold,
    fontSize: 10,
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
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  matrixStatusBadgeText: {
    fontSize: 10,
    fontWeight: '900',
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

  // --- HIGH-DENSITY DIRECTORY, ROSTER & LEDGER STYLES ---
  directoryGroupBlock: {
    marginBottom: 14,
  },
  directoryListSurface: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
    overflow: 'hidden',
  },
  directorySlimRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F2EFE9',
  },
  directoryAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.cream,
    borderWidth: 1,
    borderColor: COLORS.gold,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  directoryAvatarText: {
    color: COLORS.navy,
    fontSize: 13,
    fontWeight: '800',
  },
  directoryDueDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 9,
    height: 9,
    borderRadius: 4.5,
    backgroundColor: COLORS.danger,
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  directoryNameText: {
    color: COLORS.navy,
    fontSize: 14,
    fontWeight: '700',
  },
  directoryMetaText: {
    color: COLORS.silver,
    fontSize: 11,
    marginTop: 2,
  },
  directoryStatusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  directoryStatusBadgeText: {
    fontSize: 10,
    fontWeight: '800',
  },

  /* Attendance Roster Styles */
  segmentedModePill: {
    flexDirection: 'row',
    backgroundColor: COLORS.cream,
    borderRadius: 12,
    padding: 3,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  segmentedModeOption: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 9,
  },
  segmentedModeOptionActive: {
    backgroundColor: COLORS.navy,
  },
  segmentedModeText: {
    color: COLORS.navy,
    fontSize: 11,
    fontWeight: '700',
  },
  segmentedModeTextActive: {
    color: COLORS.gold,
  },
  rosterDateBar: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    paddingVertical: 8,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rosterDateArrowBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.cream,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  rosterDateCenterBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: COLORS.navy,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  rosterDateCenterText: {
    color: COLORS.gold,
    fontSize: 13,
    fontWeight: '800',
  },
  rosterTodayJumpBtn: {
    backgroundColor: COLORS.cream,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  rosterTodayJumpText: {
    color: COLORS.navy,
    fontSize: 11,
    fontWeight: '700',
  },
  bulkMarkPresentChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    backgroundColor: COLORS.cream,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  bulkMarkPresentChipText: {
    color: COLORS.navy,
    fontSize: 10,
    fontWeight: '800',
  },
  rosterToggleRow: {
    flexDirection: 'row',
    gap: 5,
  },
  rosterToggleBtn: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: COLORS.ivory,
    borderWidth: 1,
    borderColor: COLORS.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rosterToggleBtnText: {
    color: COLORS.charcoal,
    fontSize: 11,
    fontWeight: '700',
  },

  /* Bank Ledger Styles */
  ledgerRowIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  ledgerSubjPillText: {
    color: COLORS.silver,
    fontSize: 11,
    fontWeight: '600',
  },
  ledgerDueAmountText: {
    color: COLORS.danger,
    fontSize: 13,
    fontWeight: '900',
  },
  ledgerPaidAmountText: {
    color: COLORS.success,
    fontSize: 13,
    fontWeight: '900',
  },
  ledgerDueSubText: {
    color: COLORS.danger,
    fontSize: 10,
    fontWeight: '700',
  },
  ledgerPaidSubText: {
    color: COLORS.success,
    fontSize: 10,
    fontWeight: '700',
  },
  settleQuickBtn: {
    backgroundColor: COLORS.navy,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: COLORS.gold,
  },
  settleQuickBtnText: {
    color: COLORS.gold,
    fontSize: 10,
    fontWeight: '800',
  },

  // --- DIRECTORY & LEDGER STYLES ---
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
    gap: 5,
    backgroundColor: COLORS.navy,
    borderColor: COLORS.gold,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: 8,
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
    minHeight: 84,
    overflow: 'hidden',
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
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1.5,
    borderBottomColor: COLORS.gold,
    overflow: 'hidden',
  },
  fullScreenModalTitle: {
    color: COLORS.white,
    fontSize: 18,
    fontWeight: '700',
    fontFamily: SERIF_FONT,
  },
  fullScreenCloseBtn: {
    padding: 4,
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
  contextOptionBtn: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
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
