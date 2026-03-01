import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';

export const MONETIZATION_RPC_V2_CONTRACT_VERSION = '2026-03-01';

const V2_RPC_NAMES = {
  getSubscriptionState: 'get_user_subscription_state_v2',
  getUserEntitlements: 'get_user_entitlements_v2',
  canUserAccessAttraction: 'can_user_access_attraction_v2',
  recordAttractionUsage: 'record_attraction_usage_v2',
} as const;

type UnknownRecord = Record<string, unknown>;

export interface MonetizationSubscriptionStateV2 {
  isActive: boolean;
  subscriptionType: string | null;
  expiresAt: string | null;
  inGracePeriod: boolean;
  inTrial: boolean;
  trialEndsAt: string | null;
}

export interface MonetizationEntitlementsStateV2 {
  hasUnlimitedAccess: boolean;
  totalAttractionLimit: number;
  attractionsUsed: number;
  attractionsRemaining: number;
  ownedPackages: string[];
}

export interface MonetizationUsageRecordResultV2 {
  recorded: boolean;
  reason: string | null;
  totalAttractionLimit: number;
  attractionsUsed: number;
  attractionsRemaining: number;
}

const SUBSCRIPTION_REQUIRED_FIELDS = [
  'is_active',
  'subscription_type',
  'expires_at',
  'in_grace_period',
  'in_trial',
  'trial_ends_at',
] as const;

const ENTITLEMENTS_REQUIRED_FIELDS = [
  'has_unlimited_access',
  'total_attraction_limit',
  'attractions_used',
  'attractions_remaining',
  'owned_packages',
] as const;

const USAGE_RECORD_REQUIRED_FIELDS = [
  'recorded',
  'reason',
  'total_attraction_limit',
  'attractions_used',
  'attractions_remaining',
] as const;

function asRecord(value: unknown): UnknownRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as UnknownRecord;
}

function pickFirstRecordRow(data: unknown): UnknownRecord | null {
  if (Array.isArray(data)) {
    return asRecord(data[0]);
  }
  return asRecord(data);
}

function toBoolean(value: unknown, fallback = false): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true') return true;
    if (normalized === 'false') return false;
  }
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  return fallback;
}

function toNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim().length > 0) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  if (value instanceof Number) {
    const primitive = value.valueOf();
    if (Number.isFinite(primitive)) {
      return primitive;
    }
  }
  return fallback;
}

function toIsoDateStringOrNull(value: unknown): string | null {
  if (!value) return null;

  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.valueOf())) {
      return parsed.toISOString();
    }
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return value.toISOString();
  }

  return null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0);
}

function hasRequiredFields(
  row: UnknownRecord,
  requiredFields: readonly string[],
  rpcName: string
): boolean {
  const missing = requiredFields.filter(field => !(field in row));
  if (missing.length === 0) {
    return true;
  }

  logger.warn('Monetization RPC v2 schema drift detected', {
    rpcName,
    contractVersion: MONETIZATION_RPC_V2_CONTRACT_VERSION,
    missingFields: missing,
    availableFields: Object.keys(row),
  });
  return false;
}

export const monetizationRpcContract = {
  async getSubscriptionStateV2(userId: string): Promise<MonetizationSubscriptionStateV2 | null> {
    const { data, error } = await supabase.rpc(V2_RPC_NAMES.getSubscriptionState, {
      user_uuid: userId,
    });

    if (error) {
      logger.warn('Failed to load subscription state from RPC v2', {
        rpcName: V2_RPC_NAMES.getSubscriptionState,
        contractVersion: MONETIZATION_RPC_V2_CONTRACT_VERSION,
        error,
      });
      return null;
    }

    const row = pickFirstRecordRow(data);
    if (!row) {
      logger.warn('RPC v2 subscription state returned empty row', {
        rpcName: V2_RPC_NAMES.getSubscriptionState,
        contractVersion: MONETIZATION_RPC_V2_CONTRACT_VERSION,
      });
      return null;
    }

    if (!hasRequiredFields(row, SUBSCRIPTION_REQUIRED_FIELDS, V2_RPC_NAMES.getSubscriptionState)) {
      return null;
    }

    return {
      isActive: toBoolean(row.is_active, false),
      subscriptionType: typeof row.subscription_type === 'string' ? row.subscription_type : 'free',
      expiresAt: toIsoDateStringOrNull(row.expires_at),
      inGracePeriod: toBoolean(row.in_grace_period, false),
      inTrial: toBoolean(row.in_trial, false),
      trialEndsAt: toIsoDateStringOrNull(row.trial_ends_at),
    };
  },

  async getUserEntitlementsV2(userId: string): Promise<MonetizationEntitlementsStateV2 | null> {
    const { data, error } = await supabase.rpc(V2_RPC_NAMES.getUserEntitlements, {
      user_uuid: userId,
    });

    if (error) {
      logger.warn('Failed to load entitlements from RPC v2', {
        rpcName: V2_RPC_NAMES.getUserEntitlements,
        contractVersion: MONETIZATION_RPC_V2_CONTRACT_VERSION,
        error,
      });
      return null;
    }

    const row = pickFirstRecordRow(data);
    if (!row) {
      logger.warn('RPC v2 entitlements returned empty row', {
        rpcName: V2_RPC_NAMES.getUserEntitlements,
        contractVersion: MONETIZATION_RPC_V2_CONTRACT_VERSION,
      });
      return null;
    }

    if (!hasRequiredFields(row, ENTITLEMENTS_REQUIRED_FIELDS, V2_RPC_NAMES.getUserEntitlements)) {
      return null;
    }

    const totalAttractionLimit = Math.max(0, toNumber(row.total_attraction_limit, 2));
    const attractionsUsed = Math.max(0, toNumber(row.attractions_used, 0));
    const attractionsRemaining = Math.max(
      0,
      toNumber(row.attractions_remaining, totalAttractionLimit - attractionsUsed)
    );

    return {
      hasUnlimitedAccess: toBoolean(row.has_unlimited_access, false),
      totalAttractionLimit,
      attractionsUsed,
      attractionsRemaining,
      ownedPackages: toStringArray(row.owned_packages),
    };
  },

  async canUserAccessAttractionV2(userId: string, attractionId: string): Promise<boolean | null> {
    const { data, error } = await supabase.rpc(V2_RPC_NAMES.canUserAccessAttraction, {
      user_uuid: userId,
      attraction_id: attractionId,
    });

    if (error) {
      logger.warn('Failed to evaluate attraction access from RPC v2', {
        rpcName: V2_RPC_NAMES.canUserAccessAttraction,
        contractVersion: MONETIZATION_RPC_V2_CONTRACT_VERSION,
        error,
      });
      return null;
    }

    if (typeof data === 'boolean') {
      return data;
    }

    if (typeof data === 'number') {
      return data > 0;
    }

    if (typeof data === 'string') {
      const normalized = data.trim().toLowerCase();
      if (normalized === 'true') return true;
      if (normalized === 'false') return false;
    }

    logger.warn('RPC v2 attraction access returned unexpected payload', {
      rpcName: V2_RPC_NAMES.canUserAccessAttraction,
      contractVersion: MONETIZATION_RPC_V2_CONTRACT_VERSION,
      valueType: typeof data,
    });
    return null;
  },

  async recordAttractionUsageV2(
    userId: string,
    attractionId: string
  ): Promise<MonetizationUsageRecordResultV2 | null> {
    const { data, error } = await supabase.rpc(V2_RPC_NAMES.recordAttractionUsage, {
      user_uuid: userId,
      attraction_id: attractionId,
    });

    if (error) {
      logger.warn('Failed to record attraction usage via RPC v2', {
        rpcName: V2_RPC_NAMES.recordAttractionUsage,
        contractVersion: MONETIZATION_RPC_V2_CONTRACT_VERSION,
        error,
      });
      return null;
    }

    const row = pickFirstRecordRow(data);
    if (!row) {
      logger.warn('RPC v2 usage record returned empty row', {
        rpcName: V2_RPC_NAMES.recordAttractionUsage,
        contractVersion: MONETIZATION_RPC_V2_CONTRACT_VERSION,
      });
      return null;
    }

    if (!hasRequiredFields(row, USAGE_RECORD_REQUIRED_FIELDS, V2_RPC_NAMES.recordAttractionUsage)) {
      return null;
    }

    const totalAttractionLimit = Math.max(0, toNumber(row.total_attraction_limit, 2));
    const attractionsUsed = Math.max(0, toNumber(row.attractions_used, 0));

    return {
      recorded: toBoolean(row.recorded, false),
      reason: typeof row.reason === 'string' ? row.reason : null,
      totalAttractionLimit,
      attractionsUsed,
      attractionsRemaining: Math.max(
        0,
        toNumber(row.attractions_remaining, totalAttractionLimit - attractionsUsed)
      ),
    };
  },
};
