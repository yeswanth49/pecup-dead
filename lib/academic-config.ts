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
      // Convert string keys to numbers
      const mappings: Record<number, number> = {};
      for (const [key, value] of Object.entries(data.config_value as any)) {
        mappings[parseInt(key)] = value as number;
      }
      this.yearMappings = mappings;
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

    // Fallback: assume older = graduated (Year 4)
    return 4;
  }

  /**
   * Update year mappings (admin only)
   */
  async updateYearMappings(newMappings: Record<number, number>): Promise<void> {
    const supabase = getSupabaseAdmin();

    const { error } = await supabase
      .from('academic_config')
      .upsert({
        config_key: 'year_mappings',
        config_value: newMappings,
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

  clearCache(): void {
    this.yearMappings = null;
    this.cacheExpiry = 0;
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