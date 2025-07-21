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
      configs,
      total,
      page,
      totalPages: Math.ceil(total / limit),
      hasNextPage: page < Math.ceil(total / limit),
      hasPreviousPage: page > 1,
    };
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

      return config;
    } catch (error: any) {
      await AuditLogService.logAction({
        adminId: input.adminId,
        adminEmail: input.adminEmail,
        adminRole: input.adminRole,
        action: 'create_config',
        resource: 'system_config',
        success: false,
        errorMessage: error.message,
      });
      throw error;
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
      config.value = input.value;
      config.lastModifiedBy = input.adminId;
      config.lastModifiedAt = new Date();

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
          before: { value: oldValue },
          after: { value: config.value },
          fieldsChanged: ['value'],
        },
        success: true,
      });

      return config;
    } catch (error: any) {
      await AuditLogService.logAction({
        adminId: input.adminId,
        adminEmail: input.adminEmail,
        adminRole: input.adminRole,
        action: 'update_config',
        resource: 'system_config',
        resourceId: input.configId,
        success: false,
        errorMessage: error.message,
      });
      throw error;
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

      // Prevent deletion of critical configs
      if (config.category === 'critical' || config.key.includes('payment')) {
        throw new ErrorResponse(
          400,
          'Cannot delete critical system configuration'
        );
      }

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
          before: config.toObject(),
          fieldsChanged: ['deleted'],
        },
        success: true,
      });

      return { success: true, message: 'Configuration deleted successfully' };
    } catch (error: any) {
      await AuditLogService.logAction({
        adminId: adminData.adminId,
        adminEmail: adminData.adminEmail,
        adminRole: adminData.adminRole,
        action: 'delete_config',
        resource: 'system_config',
        resourceId: configId,
        success: false,
        errorMessage: error.message,
      });
      throw error;
    }
  }

  /**
   * Get configurations by category
   */
  static async getConfigsByCategory(category: string) {
    return await SystemConfig.find({ category }).sort({ key: 1 }).lean();
  }

  /**
   * Get single configuration value
   */
  static async getConfigValue(category: string, key: string) {
    const config = await SystemConfig.findOne({ category, key }).lean();
    return config?.value;
  }

  /**
   * Bulk update configurations
   */
  static async bulkUpdateConfigs(
    updates: Array<{ configId: string; value: any }>,
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
}

export default AdminSystemConfigService;
