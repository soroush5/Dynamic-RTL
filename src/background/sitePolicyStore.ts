import { readSync, writeSync, SyncStorage } from '../shared/storage';

export interface SitePolicy {
  defaultEnabled: boolean;
  disabledSites: string[];
  enabledSites: string[];
}

const DEFAULT_POLICY: SitePolicy = {
  defaultEnabled: true,
  disabledSites: [],
  enabledSites: []
};

function normalizeList(list?: unknown): string[] {
  if (!Array.isArray(list)) {
    return [];
  }
  return Array.from(new Set(list.filter((item): item is string => typeof item === 'string')));
}

export class SitePolicyStore {
  async ensureDefaults(): Promise<void> {
    const settings = await readSync(['defaultEnabled', 'disabledSites', 'enabledSites']);
    const updates: Partial<SyncStorage> = {};
    if (settings.defaultEnabled === undefined) {
      updates.defaultEnabled = DEFAULT_POLICY.defaultEnabled;
    }
    if (!Array.isArray(settings.disabledSites)) {
      updates.disabledSites = DEFAULT_POLICY.disabledSites;
    }
    if (!Array.isArray(settings.enabledSites)) {
      updates.enabledSites = DEFAULT_POLICY.enabledSites;
    }
    if (Object.keys(updates).length > 0) {
      await writeSync(updates);
    }
  }

  async getPolicy(): Promise<SitePolicy> {
    const settings = await readSync(['defaultEnabled', 'disabledSites', 'enabledSites']);
    return {
      defaultEnabled: settings.defaultEnabled ?? DEFAULT_POLICY.defaultEnabled,
      disabledSites: normalizeList(settings.disabledSites),
      enabledSites: normalizeList(settings.enabledSites)
    };
  }

  isSiteEnabled(hostname: string, policy: SitePolicy): boolean {
    if (policy.defaultEnabled) {
      return !policy.disabledSites.includes(hostname);
    }
    return policy.enabledSites.includes(hostname);
  }

  async updateSite(hostname: string, enabled: boolean): Promise<SitePolicy> {
    const policy = await this.getPolicy();
    if (policy.defaultEnabled) {
      const filtered = policy.disabledSites.filter((site) => site !== hostname);
      if (!enabled) {
        filtered.push(hostname);
      }
      policy.disabledSites = Array.from(new Set(filtered));
      await writeSync({ disabledSites: policy.disabledSites });
    } else {
      const filtered = policy.enabledSites.filter((site) => site !== hostname);
      if (enabled) {
        filtered.push(hostname);
      }
      policy.enabledSites = Array.from(new Set(filtered));
      await writeSync({ enabledSites: policy.enabledSites });
    }
    return policy;
  }

  async setDefaultEnabled(defaultEnabled: boolean): Promise<SitePolicy> {
    await writeSync({ defaultEnabled });
    const policy = await this.getPolicy();
    return {
      ...policy,
      defaultEnabled
    };
  }
}
