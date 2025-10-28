import { getSupabaseAdmin } from './supabase';

/**
 * Simple year mapping: batch_year → academic_year
 * Update this once a year!
 */
const DEFAULT_YEAR_MAPPINGS: Record<number, number> = {
  2025: 1,  // Joined 2025 = 1st year (current freshers)
  2024: 2,  // Joined 2024 = 2nd year
  2023: 3,  // Joined 2023 = 3rd year
  2022: 4,  // Joined 2022 = 4th year (final year)
  2021: 4,  // Graduated but still in system
};

export class AcademicConfigManager {
  private static instance: AcademicConfigManager | null = null;
  private yearMappings: Record<number, number> | null = null;
  private cacheExpiry: number = 0;
  private _cachedProgramConfig: { programLength: number } | null = null;
  private _cachedProgramConfigExpiry: number = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  static getInstance(): AcademicConfigManager {
    if (!AcademicConfigManager.instance) {
      AcademicConfigManager.instance = new AcademicConfigManager();
    }
    return AcademicConfigManager.instance;
  }

  /**
   * Get year mappings from database or use defaults
   */
  async getYearMappings(): Promise<Record<number, number>> {
    const now = Date.now();

    if (this.yearMappings && now < this.cacheExpiry) {
      return this.yearMappings;
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('academic_config')
      .select('config_value')
      .eq('config_key', 'year_mappings')
      .maybeSingle();

    if (error || !data?.config_value) {
      console.info('[academic-config] Using default year mappings');
      this.yearMappings = DEFAULT_YEAR_MAPPINGS;
    } else {
      // Validate that config_value is a plain object and process valid entries
      if (typeof data.config_value !== 'object' || Array.isArray(data.config_value) || data.config_value === null) {
        console.warn('[academic-config] Invalid config_value structure, falling back to defaults');
        this.yearMappings = DEFAULT_YEAR_MAPPINGS;
      } else {
        const mappings: Record<number, number> = {};
        let hasValidEntries = false;
        for (const [key, value] of Object.entries(data.config_value as any)) {
          const parsedKey = parseInt(key);
          if (isNaN(parsedKey)) continue;
          const coercedValue = Number(value);
          if (!isNaN(coercedValue) && isFinite(coercedValue)) {
            mappings[parsedKey] = coercedValue;
            hasValidEntries = true;
          }
        }
        if (!hasValidEntries) {
          console.warn('[academic-config] No valid mappings found, falling back to defaults');
          this.yearMappings = DEFAULT_YEAR_MAPPINGS;
        } else {
          this.yearMappings = mappings;
        }
      }
    }

    this.cacheExpiry = now + this.CACHE_DURATION;
    return this.yearMappings;
  }

  /**
   * Get academic year for a batch year - Simple lookup!
   */
  async calculateAcademicYear(batchYear: number | undefined): Promise<number> {
    if (!batchYear) return 1;

    const mappings = await this.getYearMappings();

    // Direct lookup
    if (mappings[batchYear]) {
      return mappings[batchYear];
    }

    // Fallback: if batchYear is in the future, return 1 (freshman), otherwise 4 (graduated)
    const currentYear = new Date().getFullYear();
    return batchYear > currentYear ? 1 : 4;
  }

  /**
   * Update year mappings (admin only)
   */
  async updateYearMappings(newMappings: Record<number, number>): Promise<void> {
    // Validation rules: newMappings must be a non-empty plain object,
    // each key must be an integer 1900-2100 (batch year), each value an integer 1-4 (academic year).
    // Normalize string keys/values to numbers, reject duplicates, undefined values, or extra keys.
    if (!newMappings || typeof newMappings !== 'object' || Array.isArray(newMappings) || Object.keys(newMappings).length === 0) {
      throw new Error('newMappings must be a non-empty plain object');
    }

    const normalizedMappings: Record<number, number> = {};
    const seenBatchYears = new Set<number>();
    const seenAcademicYears = new Set<number>();

    for (const [key, value] of Object.entries(newMappings)) {
      const batchYear = parseInt(key);
      if (isNaN(batchYear) || batchYear < 1900 || batchYear > 2100) {
        throw new Error(`Invalid batch year: ${key}. Must be an integer between 1900 and 2100`);
      }
      if (seenBatchYears.has(batchYear)) {
        throw new Error(`Duplicate batch year: ${batchYear}`);
      }
      seenBatchYears.add(batchYear);

      const academicYear = Number(value);
      if (isNaN(academicYear) || !isFinite(academicYear) || academicYear < 1 || academicYear > 4) {
        throw new Error(`Invalid academic year: ${value}. Must be an integer between 1 and 4`);
      }
      if (seenAcademicYears.has(academicYear)) {
        throw new Error(`Duplicate academic year: ${academicYear}`);
      }
      seenAcademicYears.add(academicYear);

      normalizedMappings[batchYear] = academicYear;
    }

    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('academic_config')
      .upsert({
        config_key: 'year_mappings',
        config_value: normalizedMappings,
        updated_at: new Date().toISOString()
      }, { onConflict: 'config_key' });

    if (error) {
      throw new Error(`Failed to update year mappings: ${error.message}`);
    }

    this.clearCache();
  }

  /**
   * Promote all students by one year
   * Simply shift the mappings!
   */
  async promoteAllStudents(): Promise<void> {
    const currentMappings = await this.getYearMappings();
    const newMappings: Record<number, number> = {};

    // Shift everyone up by 1 year
    for (const [batchYear, academicYear] of Object.entries(currentMappings)) {
      const year = parseInt(batchYear);
      // Year 1→2, Year 2→3, Year 3→4, Year 4 stays at 4
      newMappings[year] = Math.min(4, academicYear + 1);
    }

    await this.updateYearMappings(newMappings);
  }

  /**
   * Demote all students by one year
   */
  async demoteAllStudents(): Promise<void> {
    const currentMappings = await this.getYearMappings();
    const newMappings: Record<number, number> = {};

    for (const [batchYear, academicYear] of Object.entries(currentMappings)) {
      const year = parseInt(batchYear);
      // Year 2→1, Year 3→2, Year 4→3, Year 1 stays at 1
      newMappings[year] = Math.max(1, academicYear - 1);
    }

    await this.updateYearMappings(newMappings);
  }

  /**
   * Get program configuration settings
   */
  async getConfig(): Promise<{ programLength: number }> {
    const now = Date.now();

    if (this._cachedProgramConfig && now < this._cachedProgramConfigExpiry) {
      return this._cachedProgramConfig;
    }

    const supabase = getSupabaseAdmin();

    const { data, error } = await supabase
      .from('academic_config')
      .select('config_value')
      .eq('config_key', 'program_settings')
      .maybeSingle();

    if (error || !data?.config_value) {
      console.warn('[academic-config] Using default program settings');
      this._cachedProgramConfig = { programLength: 4 };
    } else {
      // Validate that data?.config_value is an object and that config_value.programLength is a finite positive number
      if (typeof data.config_value !== 'object' || Array.isArray(data.config_value) || data.config_value === null) {
        console.warn('[academic-config] Invalid config_value structure, falling back to programLength = 4');
        this._cachedProgramConfig = { programLength: 4 };
      } else {
        const config = data.config_value as any;
        const programLength = config.programLength;
        if (typeof programLength !== 'number' || !isFinite(programLength) || programLength <= 0) {
          console.warn('[academic-config] Invalid programLength, falling back to programLength = 4');
          this._cachedProgramConfig = { programLength: 4 };
        } else {
          this._cachedProgramConfig = { programLength };
        }
      }
    }

    this._cachedProgramConfigExpiry = now + this.CACHE_DURATION;
    return this._cachedProgramConfig;
  }

  /**
   * Convert academic year level to batch year
   */
  async academicYearToBatchYear(academicYearLevel: number): Promise<number> {
    if (academicYearLevel < 1 || academicYearLevel > 4) {
      throw new Error('Invalid academic year level');
    }

    const mappings = await this.getYearMappings();

    // Inverse lookup: find the batch year key whose mapped academic year equals the input
    for (const [batchYear, academicYear] of Object.entries(mappings)) {
      if (academicYear === academicYearLevel) {
        return parseInt(batchYear);
      }
    }

    // If no mapping exists for the requested academic year, throw a clear error
    throw new Error(`No mapping exists for academic year level ${academicYearLevel}`);
  }

  clearCache(): void {
    this.yearMappings = null;
    this.cacheExpiry = 0;
    this._cachedProgramConfig = null;
    this._cachedProgramConfigExpiry = 0;
  }
}

// Export singleton
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