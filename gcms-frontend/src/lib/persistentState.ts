import { postJSON } from "./api";

export const PERSISTENT_STATE_KEYS = [
  "gcms_auth_user_v1",
  "gcms_mock_users_v1",
  "gcms_mock_colleges_v1",
  "gcms_mock_academic_years_v1",
  "gcms_mock_year_levels_v1",
  "gcms_mock_counseling_cases_v2",
  "gcms_mock_group_sessions_v1",
  "gcms_mock_group_session_members_v1",
  "gcms_mock_referrals_v1",
  "gcms_mock_referral_logs_v1",
  "gcms_store_users_v1",
  "gcms_store_counseling_v1",
  "gcms_store_referrals_v1",
  "gcms_store_group_sessions_v1",
  "gcms_store_group_session_members_v1",
  "gcms_store_survey_interviews_v1",
  "gcms_store_current_user_v1",
] as const;

const REMOVED_PERSISTENT_STATE_KEYS = [
  "gcms_mock_mediation_cases_v1",
] as const;

const SYNC_KEY_SET = new Set<string>([
  ...PERSISTENT_STATE_KEYS,
  ...REMOVED_PERSISTENT_STATE_KEYS,
]);
const RESET_IF_REMOTE_MISSING_KEYS = new Set<string>([
  "gcms_mock_users_v1",
  "gcms_store_users_v1",
  "gcms_mock_counseling_cases_v2",
  "gcms_store_counseling_v1",
  "gcms_mock_group_sessions_v1",
  "gcms_store_group_sessions_v1",
  "gcms_mock_group_session_members_v1",
  "gcms_store_group_session_members_v1",
  "gcms_mock_referrals_v1",
  "gcms_store_referrals_v1",
  "gcms_mock_referral_logs_v1",
]);

type BootstrapResponse = {
  ok: boolean;
  data?: Record<string, string>;
};

type BulkSetResponse = {
  ok: boolean;
};

let hooksInstalled = false;
let suspendSync = false;
let flushTimer: number | null = null;
const pendingMap = new Map<string, string | null>();

const originalSetItem = Storage.prototype.setItem;
const originalRemoveItem = Storage.prototype.removeItem;

function queueStateWrite(key: string, raw: string | null) {
  if (!SYNC_KEY_SET.has(key)) return;
  pendingMap.set(key, raw);
  scheduleFlush();
}

function scheduleFlush() {
  if (flushTimer !== null) return;
  flushTimer = window.setTimeout(() => {
    void flushPendingWrites();
  }, 300);
}

async function flushPendingWrites() {
  if (flushTimer !== null) {
    window.clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (!pendingMap.size) return;

  const items = [...pendingMap.entries()].map(([key, raw]) => ({ key, raw }));
  pendingMap.clear();

  try {
    await postJSON<BulkSetResponse>("/state_bulk_set.php", { items });
  } catch {
    // Keep app usable even when API is offline.
  }
}

function installStorageHooks() {
  if (hooksInstalled) return;
  hooksInstalled = true;

  Storage.prototype.setItem = function patchedSetItem(
    this: Storage,
    key: string,
    value: string,
  ) {
    originalSetItem.call(this, key, value);

    if (this === window.localStorage && !suspendSync) {
      queueStateWrite(key, value);
    }
  };

  Storage.prototype.removeItem = function patchedRemoveItem(
    this: Storage,
    key: string,
  ) {
    originalRemoveItem.call(this, key);

    if (this === window.localStorage && !suspendSync) {
      queueStateWrite(key, null);
    }
  };
}

export async function initPersistentStateSync() {
  if (typeof window === "undefined") return;

  installStorageHooks();

  let remoteData: Record<string, string> = {};
  try {
    const res = await postJSON<BootstrapResponse>("/state_bootstrap.php", {
      keys: [...PERSISTENT_STATE_KEYS],
    });
    if (res.ok && res.data) remoteData = res.data;
  } catch {
    remoteData = {};
  }

  suspendSync = true;
  try {
    for (const key of REMOVED_PERSISTENT_STATE_KEYS) {
      originalRemoveItem.call(window.localStorage, key);
      queueStateWrite(key, null);
    }

    for (const key of PERSISTENT_STATE_KEYS) {
      const remoteRaw = remoteData[key];

      if (typeof remoteRaw === "string") {
        originalSetItem.call(window.localStorage, key, remoteRaw);
        continue;
      }

      const localRaw = window.localStorage.getItem(key);
      if (RESET_IF_REMOTE_MISSING_KEYS.has(key)) {
        originalRemoveItem.call(window.localStorage, key);
        continue;
      }
      if (localRaw !== null) {
        queueStateWrite(key, localRaw);
      }
    }
  } finally {
    suspendSync = false;
  }

  await flushPendingWrites();
}
