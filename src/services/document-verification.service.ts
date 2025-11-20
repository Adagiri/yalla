import { ErrorResponse } from '../utils/responses';
import Driver from '../features/driver/driver.model';
import Customer from '../features/customer/customer.model';
import Admin from '../features/admin/admin.model';
import { VerificationStatus, DocumentType } from '../features/general/general.types';


interface VerificationAction {
  documentType: DocumentType;
  status: VerificationStatus;
  adminId: string;
}

export class DocumentVerificationService {
  
  /**
   * Verify/Reject a user's document using ONLY existing fields
   */
  static async verifyDocument(
    userId: string,
    action: VerificationAction
  ): Promise<{ success: boolean; message: string }> {
    try {
      const { userModel, userType } = await this.findUserModel(userId);
      
      const user = await userModel.findById(userId);
      if (!user) {
        throw new ErrorResponse(404, 'User not found');
      }

      let updateData: any = {};
      let message = '';

      switch (action.documentType) {
        case 'DRIVER_LICENSE':
          // Check if both license sides are uploaded
          if (!user.driverLicenseFront || !user.driverLicenseBack) {
            throw new ErrorResponse(400, 'Both license front and back must be uploaded before verification');
          }
          
          updateData.driverLicenseVerified = action.status === 'APPROVED';
          message = `Driver license ${action.status.toLowerCase()}`;
          break;

        case 'PROFILE_PHOTO':
          // Just update the existing profilePhotoSet field
          updateData.profilePhotoSet = action.status === VerificationStatus.APPROVED;
          message = `Profile photo ${action.status.toLowerCase()}`;
          break;

        case 'VEHICLE_INSPECTION':
          if (userType !== 'DRIVER') {
            throw new ErrorResponse(400, 'Vehicle inspection is only for drivers');
          }
          updateData.vehicleInspectionDone = action.status === VerificationStatus.APPROVED;
          message = `Vehicle inspection ${action.status.toLowerCase()}`;
          break;

        default:
          throw new ErrorResponse(400, `Unsupported document type: ${action.documentType}`);
      }

      // Update user document with ONLY existing fields
      await userModel.findByIdAndUpdate(userId, updateData);

      return {
        success: true,
        message
      };

    } catch (error: any) {
      throw new ErrorResponse(
        error.statusCode || 500,
        error.message || 'Failed to verify document'
      );
    }
  }

  /**
   * Get user's document verification status using existing fields
   */
  static async getVerificationStatus(userId: string) {
    const { userModel, userType } = await this.findUserModel(userId);
    const user = await userModel.findById(userId);

    if (!user) {
      throw new ErrorResponse(404, 'User not found');
    }

    // Using ONLY fields that exist in your models
    const status: any = {
      driverLicense: {
        verified: user.driverLicenseVerified || false,
        frontUploaded: !!user.driverLicenseFront,
        backUploaded: !!user.driverLicenseBack,
        canBeVerified: !!(user.driverLicenseFront && user.driverLicenseBack) // Both sides uploaded
      },
      profile: {
        photoUploaded: user.profilePhotoSet || false,
        personalInfoSet: user.personalInfoSet || false
      }
    };

    // Only add vehicle inspection for drivers
    if (userType === 'DRIVER') {
      status.vehicle = {
        inspectionDone: user.vehicleInspectionDone || false
      };
    }

    return status;
  }

  /**
   * Toggle driver license verification (simple approve/reject)
   */
  static async toggleDriverLicenseVerification(
    userId: string,
    verified: boolean,
    adminId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await Driver.findById(userId);
      if (!user) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      // Check if both license sides are uploaded
      if (!user.driverLicenseFront || !user.driverLicenseBack) {
        throw new ErrorResponse(400, 'Both license front and back must be uploaded before verification');
      }

      await Driver.findByIdAndUpdate(userId, { 
        driverLicenseVerified: verified 
      });

      return {
        success: true,
        message: `Driver license ${verified ? 'approved' : 'rejected'}`
      };

    } catch (error: any) {
      throw new ErrorResponse(
        error.statusCode || 500,
        error.message || 'Failed to toggle license verification'
      );
    }
  }

  /**
   * Toggle vehicle inspection status
   */
  static async toggleVehicleInspection(
    userId: string,
    inspected: boolean,
    adminId: string
  ): Promise<{ success: boolean; message: string }> {
    try {
      const user = await Driver.findById(userId);
      if (!user) {
        throw new ErrorResponse(404, 'Driver not found');
      }

      await Driver.findByIdAndUpdate(userId, { 
        vehicleInspectionDone: inspected 
      });

      return {
        success: true,
        message: `Vehicle inspection ${inspected ? 'approved' : 'rejected'}`
      };

    } catch (error: any) {
      throw new ErrorResponse(
        error.statusCode || 500,
        error.message || 'Failed to toggle vehicle inspection'
      );
    }
  }

  /**
   * Find which model the user belongs to
   */
  private static async findUserModel(userId: string): Promise<{ userModel: any; userType: string }> {
    const [driver, customer, admin] = await Promise.all([
      Driver.findById(userId),
      Customer.findById(userId),
      Admin.findById(userId)
    ]);

    if (driver) return { userModel: Driver, userType: 'DRIVER' };
    if (customer) return { userModel: Customer, userType: 'CUSTOMER' };
    if (admin) return { userModel: Admin, userType: 'ADMIN' };

    throw new ErrorResponse(404, 'User not found');
  }
}

export default DocumentVerificationService;