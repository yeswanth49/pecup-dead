import { getSupabaseAdmin } from './supabase';

interface AcademicConfig {
  programLength: number;
  startMonth: number;
  currentAcademicYear: number;
  yearMappings: Record<number, number>;
}

interface ProgramSettings {
  program_length: number;
  start_month: number;
  current_academic_year: number;
}

interface YearMappings {
  [key: string]: number;
}

/**
 * Type guard to validate ProgramSettings
 */
function isValidProgramSettings(value: any): value is ProgramSettings {
  return (
    value &&
    typeof value === 'object' &&
    typeof value.program_length === 'number' &&
    typeof value.start_month === 'number' &&
    typeof value.current_academic_year === 'number' &&
    Number.isFinite(value.program_length) &&
    Number.isFinite(value.start_month) &&
    Number.isFinite(value.current_academic_year)
  );
}

/**
 * Type guard to validate YearMappings
 */
function isValidYearMappings(value: any): value is YearMappings {
  return (
    value &&
    typeof value === 'object' &&
    Object.keys(value).every(key => typeof value[key] === 'number' && Number.isFinite(value[key]))
  );
}

/**
 * Academic Configuration Manager
 * Handles dynamic academic year calculations and caching
 */
export class AcademicConfigManager {
  private static instance: AcademicConfigManager | null = null;
  private config: AcademicConfig | null = null;
  private configCacheExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): AcademicConfigManager {
    // Lazy initialization to prevent client-side initialization
    if (!AcademicConfigManager.instance) {
      AcademicConfigManager.instance = new AcademicConfigManager();
    }
    return AcademicConfigManager.instance;
  }

  /**
   * Get the current academic configuration with caching
   */
  async getConfig(): Promise<AcademicConfig> {
    const now = Date.now();

    if (this.config && now < this.configCacheExpiry) {
      return this.config;
    }

    const supabase = getSupabaseAdmin();

    // Fetch both program settings and year mappings
    const { data: configs, error } = await supabase
      .from('academic_config')
      .select('config_key, config_value')
      .in('config_key', ['program_settings', 'year_mappings']);

    if (error) {
      console.error('Failed to load academic configuration:', error);
      // Return default configuration on error
      return this.getDefaultConfig();
    }

    const programSettings = configs?.find(c => c.config_key === 'program_settings');
    const yearMappings = configs?.find(c => c.config_key === 'year_mappings');

    // Validate program settings
    let settings: ProgramSettings | null = null;
    if (programSettings?.config_value != null) {
      if (isValidProgramSettings(programSettings.config_value)) {
        settings = programSettings.config_value;
      } else {
        console.warn('Invalid program settings found in database, using defaults');
      }
    }

    // Validate year mappings
    let mappings: YearMappings = {};
    if (yearMappings?.config_value != null) {
      if (isValidYearMappings(yearMappings.config_value)) {
        mappings = yearMappings.config_value;
      } else {
        console.warn('Invalid year mappings found in database, using empty mappings');
      }
    }

    this.config = {
      programLength: settings?.program_length ?? 4,
      startMonth: settings?.start_month ?? 6,
      currentAcademicYear: settings?.current_academic_year ?? new Date().getFullYear(),
      yearMappings: this.convertMappingsToNumbers(mappings)
    };

    this.configCacheExpiry = now + this.CACHE_DURATION;
    return this.config;
  }

  /**
   * Calculate academic year level from batch year
   */
  async calculateAcademicYear(batchYear: number | undefined): Promise<number> {
    if (!batchYear) return 1;

    const config = await this.getConfig();

    // Validate and normalize batchYear
    if (!Number.isFinite(batchYear) || batchYear < 0 || !Number.isInteger(batchYear)) {
      console.warn(`Invalid batchYear: ${batchYear}, must be a non-negative integer`);
      return 1;
    }

    // Check if we have an explicit mapping
    if (config.yearMappings[batchYear]) {
      return config.yearMappings[batchYear];
    }

    // Dynamic calculation based on current date
    const currentDate = new Date();
    const currentYear = currentDate.getFullYear();
    const currentMonth = currentDate.getMonth() + 1;

    // Adjust for academic year (if we're before start month, we're still in previous academic year)
    const adjustedYear = currentMonth >= config.startMonth ? currentYear : currentYear - 1;

    // Handle future batch years (students who haven't started yet)
    if (batchYear > adjustedYear) {
      return 1; // Future batches start at year 1
    }

    const academicYear = adjustedYear - batchYear + 1;

    // Clamp within valid range
    return Math.max(1, Math.min(academicYear, config.programLength));
  }

  /**
   * Get all academic year mappings
   */
  async getYearMappings(): Promise<Record<number, number>> {
    const config = await this.getConfig();
    return config.yearMappings;
  }

  /**
   * Update academic configuration (admin function)
   */
  async updateConfig(updates: Partial<AcademicConfig>): Promise<void> {
    const supabase = getSupabaseAdmin();
    const currentConfig = await this.getConfig();

    const newConfig = { ...currentConfig, ...updates };

    // Update program settings
    const programSettings = {
      program_length: newConfig.programLength,
      start_month: newConfig.startMonth,
      current_academic_year: newConfig.currentAcademicYear
    };

    const { error: programError } = await supabase
      .from('academic_config')
      .upsert({
        config_key: 'program_settings',
        config_value: programSettings,
        updated_at: new Date().toISOString()
      });

    if (programError) {
      throw new Error(`Failed to update program settings: ${programError.message}`);
    }

    // Update year mappings
    const { error: mappingsError } = await supabase
      .from('academic_config')
      .upsert({
        config_key: 'year_mappings',
        config_value: newConfig.yearMappings,
        updated_at: new Date().toISOString()
      });

    if (mappingsError) {
      // Consider rolling back the first update or logging the inconsistency
      console.error('Failed to update year mappings after program settings were updated:', mappingsError);
      throw new Error(`Failed to update year mappings: ${mappingsError.message}`);
    }

    // Clear cache to force reload only after successful updates
    this.config = null;
    this.configCacheExpiry = 0;
  }

  /**
   * Convert string keys to numbers for year mappings
   */
  private convertMappingsToNumbers(mappings: YearMappings): Record<number, number> {
    const result: Record<number, number> = {};
    for (const [key, value] of Object.entries(mappings)) {
      const parsed = parseInt(key, 10);
      if (Number.isNaN(parsed)) {
        console.warn(`Skipping invalid year mapping key "${key}" - not a valid number`);
        continue;
      }
      result[parsed] = value;
    }
    return result;
  }

  /**
   * Get default configuration when database is unavailable
   */
  private getDefaultConfig(): AcademicConfig {
    return {
      programLength: 4,
      startMonth: 6, // June
      currentAcademicYear: new Date().getFullYear(),
      yearMappings: {
        2024: 1,
        2023: 2,
        2022: 3,
        2021: 4,
        [new Date().getFullYear()]: 1
      }
    };
  }

  /**
   * Clear cache (useful for testing or forced refresh)
   */
  clearCache(): void {
    this.config = null;
    this.configCacheExpiry = 0;
  }
}

// Lazy-loaded instance to prevent client-side initialization
let academicConfigInstance: AcademicConfigManager | null = null;

function getAcademicConfig(): AcademicConfigManager {
  if (!academicConfigInstance) {
    academicConfigInstance = AcademicConfigManager.getInstance();
  }
  return academicConfigInstance;
}

export const academicConfig = new Proxy({} as AcademicConfigManager, {
  get(target, prop) {
    const instance = getAcademicConfig();
    const value = instance[prop as keyof AcademicConfigManager];
    return typeof value === 'function' ? value.bind(instance) : value;
  }
});

/**
 * Legacy function for backward compatibility
 * @deprecated Use academicConfig.calculateAcademicYear() instead
 */
export async function calculateYearLevel(batchYear: number | undefined): Promise<number> {
  return getAcademicConfig().calculateAcademicYear(batchYear);
}
