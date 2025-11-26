// src/features/admin/admin-system-config.service.ts - Complete Service
import SystemConfig from './system-config.model';
import AuditLogService from './audit-log.service';
import { ErrorResponse } from '../../utils/responses';

interface SystemConfigInput {
  category: string;
  key: string;
  value: any;
  description?: string;
  isPublic?: boolean;
  adminId: string;
  adminEmail: string;
  adminRole: string;
}

interface ConfigUpdateInput {
  configId: string;
  value: any;
  adminId: string;
  adminEmail: string;
  adminRole: string;
}

class AdminSystemConfigService {
  /**
   * Get all system configurations with filtering
   */
  static async getSystemConfigs(filters: {
    category?: string;
    isPublic?: boolean;
    searchTerm?: string;
    page?: number;
    limit?: number;
  }) {
    const { category, isPublic, searchTerm, page = 1, limit = 50 } = filters;

    const query: any = {};

    if (category) query.category = category;
    if (isPublic !== undefined) query.isPublic = isPublic;
    if (searchTerm) {
      query.$or = [
        { key: { $regex: searchTerm, $options: 'i' } },
        { description: { $regex: searchTerm, $options: 'i' } },
      ];
    }

    const skip = (page - 1) * limit;

    const [configs, total] = await Promise.all([
      SystemConfig.find(query)
        .sort({ category: 1, key: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      SystemConfig.countDocuments(query),
    ]);

    return {
      configs: configs.map((config) => ({
        ...config,
        id: config._id,
      })),
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Get system config by ID
   */
  static async getConfigById(configId: string) {
    try {
      const config = await SystemConfig.findById(configId);

      if (!config) {
        throw new ErrorResponse(404, 'Configuration not found');
      }

      return {
        ...config.toObject(),
        id: config._id,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching configuration',
        error.message
      );
    }
  }

  /**
   * Get configurations by category
   */
  static async getConfigsByCategory(category: string) {
    try {
      const configs = await SystemConfig.find({ category })
        .sort({ key: 1 })
        .lean();

      return configs.map((config) => ({
        ...config,
        id: config._id,
      }));
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching configurations by category',
        error.message
      );
    }
  }

  /**
   * Create new system configuration
   */
  static async createConfig(input: SystemConfigInput) {
    try {
      // Check if config already exists
      const existingConfig = await SystemConfig.findOne({
        category: input.category,
        key: input.key,
      });

      if (existingConfig) {
        throw new ErrorResponse(400, 'Configuration already exists');
      }

      const config = new SystemConfig({
        category: input.category,
        key: input.key,
        value: input.value,
        description: input.description,
        isPublic: input.isPublic || false,
        lastModifiedBy: input.adminId,
        dataType: this.determineDataType(input.value),
      });

      await config.save();

      // Log the action
      await AuditLogService.logAction({
        adminId: input.adminId,
        adminEmail: input.adminEmail,
        adminRole: input.adminRole,
        action: 'create_config',
        resource: 'system_config',
        resourceId: config._id,
        changes: {
          after: config.toObject(),
          fieldsChanged: [
            'category',
            'key',
            'value',
            'description',
            'isPublic',
          ],
        },
        success: true,
      });

      return {
        ...config.toObject(),
        id: config._id,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error creating configuration',
        error.message
      );
    }
  }

  /**
   * Update system configuration
   */
  static async updateConfig(input: ConfigUpdateInput) {
    try {
      const config = await SystemConfig.findById(input.configId);

      if (!config) {
        throw new ErrorResponse(404, 'Configuration not found');
      }

      const oldValue = config.value;
      const oldDataType = config.dataType;

      config.value = input.value;
      config.dataType = this.determineDataType(input.value);
      config.lastModifiedBy = input.adminId;
      config.lastModifiedAt = new Date();
      config.version += 1;

      await config.save();

      // Log the action
      await AuditLogService.logAction({
        adminId: input.adminId,
        adminEmail: input.adminEmail,
        adminRole: input.adminRole,
        action: 'update_config',
        resource: 'system_config',
        resourceId: config._id,
        changes: {
          before: { value: oldValue, dataType: oldDataType },
          after: { value: config.value, dataType: config.dataType },
          fieldsChanged: ['value', 'dataType'],
        },
        success: true,
      });

      return {
        ...config.toObject(),
        id: config._id,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error updating configuration',
        error.message
      );
    }
  }

  /**
   * Delete system configuration
   */
  static async deleteConfig(
    configId: string,
    adminData: {
      adminId: string;
      adminEmail: string;
      adminRole: string;
    }
  ) {
    try {
      const config = await SystemConfig.findById(configId);

      if (!config) {
        throw new ErrorResponse(404, 'Configuration not found');
      }

      // Check if config is required
      if (config.isRequired) {
        throw new ErrorResponse(400, 'Cannot delete required configuration');
      }

      const configSnapshot = config.toObject();
      await SystemConfig.findByIdAndDelete(configId);

      // Log the action
      await AuditLogService.logAction({
        adminId: adminData.adminId,
        adminEmail: adminData.adminEmail,
        adminRole: adminData.adminRole,
        action: 'delete_config',
        resource: 'system_config',
        resourceId: configId,
        changes: {
          before: configSnapshot,
          after: null,
          fieldsChanged: ['deleted'],
        },
        success: true,
      });

      return {
        success: true,
        message: 'Configuration deleted successfully',
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error deleting configuration',
        error.message
      );
    }
  }

  /**
   * Bulk update configurations
   */
  static async bulkUpdateConfigs(
    updates: Array<{
      configId: string;
      value: any;
    }>,
    adminData: {
      adminId: string;
      adminEmail: string;
      adminRole: string;
    }
  ) {
    try {
      const results = [];

      for (const update of updates) {
        try {
          const result = await this.updateConfig({
            configId: update.configId,
            value: update.value,
            adminId: adminData.adminId,
            adminEmail: adminData.adminEmail,
            adminRole: adminData.adminRole,
          });
          results.push({
            configId: update.configId,
            success: true,
            config: result,
          });
        } catch (error: any) {
          results.push({
            configId: update.configId,
            success: false,
            error: error.message,
          });
        }
      }

      return results;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error in bulk update operation',
        error.message
      );
    }
  }

  /**
   * Get all configuration categories
   */
  static async getCategories() {
    const categories = await SystemConfig.distinct('category');
    return categories.sort();
  }

  /**
   * Get configuration by category and key
   */
  static async getConfigByKey(category: string, key: string) {
    try {
      const config = await SystemConfig.findOne({ category, key });

      if (!config) {
        return null;
      }

      return {
        ...config.toObject(),
        id: config._id,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching configuration',
        error.message
      );
    }
  }

  /**
   * Get public configurations (for client-side use)
   */
  static async getPublicConfigs() {
    try {
      const configs = await SystemConfig.find({ isPublic: true })
        .select('category key value description')
        .lean();

      // Group by category
      const groupedConfigs: { [category: string]: any[] } = {};

      configs.forEach((config) => {
        if (!groupedConfigs[config.category]) {
          groupedConfigs[config.category] = [];
        }
        groupedConfigs[config.category].push({
          key: config.key,
          value: config.value,
          description: config.description,
        });
      });

      return groupedConfigs;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error fetching public configurations',
        error.message
      );
    }
  }

  /**
   * Reset configuration to default value
   */
  static async resetConfigToDefault(
    configId: string,
    adminData: {
      adminId: string;
      adminEmail: string;
      adminRole: string;
    }
  ) {
    try {
      const config = await SystemConfig.findById(configId);

      if (!config) {
        throw new ErrorResponse(404, 'Configuration not found');
      }

      if (!config.defaultValue) {
        throw new ErrorResponse(
          400,
          'No default value available for this configuration'
        );
      }

      const oldValue = config.value;
      config.value = config.defaultValue;
      config.lastModifiedBy = adminData.adminId;
      config.lastModifiedAt = new Date();
      config.version += 1;

      await config.save();

      // Log the action
      await AuditLogService.logAction({
        adminId: adminData.adminId,
        adminEmail: adminData.adminEmail,
        adminRole: adminData.adminRole,
        action: 'reset_config',
        resource: 'system_config',
        resourceId: config._id,
        changes: {
          before: { value: oldValue },
          after: { value: config.value },
          fieldsChanged: ['value'],
        },
        success: true,
      });

      return {
        ...config.toObject(),
        id: config._id,
      };
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error resetting configuration',
        error.message
      );
    }
  }

  /**
   * Export configurations for backup
   */
  static async exportConfigs(adminData: {
    adminId: string;
    adminEmail: string;
    adminRole: string;
  }) {
    try {
      const configs = await SystemConfig.find({}).lean();

      await AuditLogService.logAction({
        adminId: adminData.adminId,
        adminEmail: adminData.adminEmail,
        adminRole: adminData.adminRole,
        action: 'export_configs',
        resource: 'system_config',
        success: true,
      });

      return {
        exportDate: new Date(),
        totalConfigs: configs.length,
        configs: configs.map((config: any) => ({
          category: config.category,
          key: config.key,
          value: config.value,
          description: config.description,
          isPublic: config.isPublic,
          dataType: config.dataType,
          isRequired: config.isRequired,
        })),
      };
    } catch (error: any) {
      await AuditLogService.logAction({
        adminId: adminData.adminId,
        adminEmail: adminData.adminEmail,
        adminRole: adminData.adminRole,
        action: 'export_configs',
        resource: 'system_config',
        success: false,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Import configurations from backup
   */
  static async importConfigs(
    configs: Array<{
      category: string;
      key: string;
      value: any;
      description?: string;
      isPublic?: boolean;
    }>,
    adminData: {
      adminId: string;
      adminEmail: string;
      adminRole: string;
    },
    options: {
      overwriteExisting?: boolean;
      skipExisting?: boolean;
    } = {}
  ) {
    try {
      const results = {
        imported: 0,
        skipped: 0,
        updated: 0,
        errors: [] as string[],
      };

      for (const configData of configs) {
        try {
          const existingConfig = await SystemConfig.findOne({
            category: configData.category,
            key: configData.key,
          });

          if (existingConfig) {
            if (options.overwriteExisting) {
              existingConfig.value = configData.value;
              existingConfig.description =
                configData.description || existingConfig.description;
              existingConfig.isPublic =
                configData.isPublic ?? existingConfig.isPublic;
              existingConfig.lastModifiedBy = adminData.adminId;
              existingConfig.lastModifiedAt = new Date();
              existingConfig.version += 1;

              await existingConfig.save();
              results.updated++;
            } else if (options.skipExisting) {
              results.skipped++;
            } else {
              results.errors.push(
                `Configuration ${configData.category}.${configData.key} already exists`
              );
            }
          } else {
            await this.createConfig({
              category: configData.category,
              key: configData.key,
              value: configData.value,
              description: configData.description,
              isPublic: configData.isPublic,
              adminId: adminData.adminId,
              adminEmail: adminData.adminEmail,
              adminRole: adminData.adminRole,
            });
            results.imported++;
          }
        } catch (error: any) {
          results.errors.push(
            `Error processing ${configData.category}.${configData.key}: ${error.message}`
          );
        }
      }

      // Log the import action
      await AuditLogService.logAction({
        adminId: adminData.adminId,
        adminEmail: adminData.adminEmail,
        adminRole: adminData.adminRole,
        action: 'import_configs',
        resource: 'system_config',
        metadata: {
          totalConfigs: configs.length,
          results,
        },
        success: results.errors.length === 0,
      });

      return results;
    } catch (error: any) {
      throw new ErrorResponse(
        500,
        'Error importing configurations',
        error.message
      );
    }
  }

  /**
   * Validate configuration value
   */
  static validateConfigValue(config: any, value: any): boolean {
    if (!config.validationRules) return true;

    const rules = config.validationRules;

    // Type validation
    if (rules.dataType && typeof value !== rules.dataType) {
      return false;
    }

    // Min/Max validation for numbers
    if (typeof value === 'number') {
      if (rules.min !== undefined && value < rules.min) return false;
      if (rules.max !== undefined && value > rules.max) return false;
    }

    // String length validation
    if (typeof value === 'string') {
      if (rules.minLength !== undefined && value.length < rules.minLength)
        return false;
      if (rules.maxLength !== undefined && value.length > rules.maxLength)
        return false;
    }

    // Allowed values validation
    if (rules.allowedValues && !rules.allowedValues.includes(value)) {
      return false;
    }

    // Regex validation
    if (rules.regex && typeof value === 'string') {
      const regex = new RegExp(rules.regex);
      if (!regex.test(value)) return false;
    }

    return true;
  }

  /**
   * Determine data type of a value
   */
  private static determineDataType(value: any): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    if (typeof value === 'object') return 'object';
    return typeof value;
  }
}

export default AdminSystemConfigService;
