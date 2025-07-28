// Service for managing global measurement settings like default units

export const measurementGlobalSettingsService = {
  // Get global measurement settings
  async getSettings() {
    try {
      const savedSettings = localStorage.getItem('measurementGlobalSettings');
      if (savedSettings) {
        return JSON.parse(savedSettings);
      }
      
      // Return default settings if none found
      return {
        defaultUnit: 'inches'
      };
    } catch (error) {
      console.error('Error loading global measurement settings:', error);
      return {
        defaultUnit: 'inches'
      };
    }
  },

  // Save global measurement settings
  async saveSettings(settings) {
    try {
      localStorage.setItem('measurementGlobalSettings', JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('Error saving global measurement settings:', error);
      return false;
    }
  },

  // Get the default unit for measurements
  async getDefaultUnit() {
    const settings = await this.getSettings();
    return settings.defaultUnit || 'inches';
  },

  // Set the default unit for measurements
  async setDefaultUnit(unit) {
    const settings = await this.getSettings();
    settings.defaultUnit = unit;
    return await this.saveSettings(settings);
  },

  // Get available units
  getAvailableUnits() {
    return [
      { value: 'inches', label: 'Inches (in)', shortLabel: 'in' },
      { value: 'cm', label: 'Centimeters (cm)', shortLabel: 'cm' },
      { value: 'mm', label: 'Millimeters (mm)', shortLabel: 'mm' },
      { value: 'feet', label: 'Feet (ft)', shortLabel: 'ft' },
      { value: 'meters', label: 'Meters (m)', shortLabel: 'm' }
    ];
  },

  // Get unit display info
  getUnitInfo(unitValue) {
    const units = this.getAvailableUnits();
    return units.find(unit => unit.value === unitValue) || units[0]; // Default to inches
  }
};
