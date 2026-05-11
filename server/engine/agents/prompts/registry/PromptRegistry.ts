/**
 * PromptRegistry.ts — TutorBoard v6.0
 *
 * Implements a versioned, A/B testable prompt management system.
 * Allows switching identities, rules, and formats without redeploying code.
 */

import * as DefaultRegistry from '../registry.js';

interface PromptVersion {
  id: string;
  version: string;
  content: string;
  isDefault: boolean;
}

interface RegistryConfig {
  group?: 'A' | 'B';
  versionOverrides?: Record<string, string>;
}

class PromptRegistry {
  private static instance: PromptRegistry;
  private templates: Map<string, PromptVersion[]> = new Map();

  private constructor() {
    this.initializeDefaults();
  }

  public static getInstance(): PromptRegistry {
    if (!PromptRegistry.instance) {
      PromptRegistry.instance = new PromptRegistry();
    }
    return PromptRegistry.instance;
  }

  private initializeDefaults() {
    // Identity
    this.register('CORE_IDENTITY', '1.0.0', DefaultRegistry.CORE_IDENTITY, true);
    this.register('CORE_IDENTITY', '1.1.0-experimental', `You are TutorBoard AI v6 — a cinematic, expert teacher.`, false);

    // Personalization
    this.register('PERSONALIZATION_RULES', '1.0.0', DefaultRegistry.PERSONALIZATION_RULES, true);

    // Output Format
    this.register('OUTPUT_FORMAT_RULES', '1.0.0', DefaultRegistry.OUTPUT_FORMAT_RULES, true);

    // Ecosystem Behavior
    this.register('ECOSYSTEM_BEHAVIOR', '1.0.0', DefaultRegistry.ECOSYSTEM_BEHAVIOR, true);
  }

  public register(id: string, version: string, content: string, isDefault: boolean = false) {
    if (!this.templates.has(id)) this.templates.set(id, []);
    const versions = this.templates.get(id)!;
    
    if (isDefault) {
      versions.forEach(v => v.isDefault = false);
    }
    
    versions.push({ id, version, content, isDefault });
  }

  public get(id: string, config?: RegistryConfig): string {
    const versions = this.templates.get(id);
    if (!versions || versions.length === 0) return '';

    // 1. Check for explicit version override
    if (config?.versionOverrides?.[id]) {
      const v = versions.find(v => v.version === config.versionOverrides![id]);
      if (v) return v.content;
    }

    // 2. Simple A/B logic for specific prompts (example)
    if (config?.group === 'B' && id === 'CORE_IDENTITY') {
      const exp = versions.find(v => v.version.includes('experimental'));
      if (exp) return exp.content;
    }

    // 3. Fallback to default
    const def = versions.find(v => v.isDefault);
    return def ? def.content : versions[0].content;
  }

  /** Helpers for commonly used blocks */
  public getIdentity(config?: RegistryConfig) { return this.get('CORE_IDENTITY', config); }
  public getPersonalization(config?: RegistryConfig) { return this.get('PERSONALIZATION_RULES', config); }
  public getFormatRules(config?: RegistryConfig) { return this.get('OUTPUT_FORMAT_RULES', config); }
  public getEcosystemRules(config?: RegistryConfig) { return this.get('ECOSYSTEM_BEHAVIOR', config); }
}

export default PromptRegistry.getInstance();
