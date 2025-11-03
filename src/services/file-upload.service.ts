import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { ENV } from "../config/env";
import { ErrorResponse } from "../utils/responses";
import { generateRandomString } from "../utils/general";
import Driver from "../features/driver/driver.model";
import Admin from "../features/admin/admin.model";
import Customer from "../features/customer/customer.model";

export enum FileAccessLevel {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

export enum FileCategory {
  PROFILE_PHOTO = "PROFILE_PHOTO",          
  DOCUMENTS = "DOCUMENTS",                
  DRIVER_LICENSE_FRONT = "DRIVER_LICENSE_FRONT",  
  DRIVER_LICENSE_BACK = "DRIVER_LICENSE_BACK", 
  VEHICLE_PHOTOS = "VEHICLE_PHOTOS",
  COMPLAINTS = "COMPLAINTS",
  COMMUNICATION = "COMMUNICATION",
  PRODUCTS = "PRODUCTS"
}

interface GenerateUploadUrlOptions {
  contentType: string;
  category: FileCategory;
  accessLevel: FileAccessLevel;
  generateThumbnail?: boolean;
  userId?: string;
}

interface UploadUrlResponse {
  uploadUrl: string;
  fileUrl: string;
  thumbnailUploadUrl?: string;
  thumbnailUrl?: string;
  key: string;
  thumbnailKey?: string;
}

class FileUploadService {



  private static s3Client = new S3Client({
    region: ENV.AWS_S3_REGION,
    credentials: {
      accessKeyId: ENV.AWS_ACCESS_KEY_ID,
      secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
    },
  });

  private static readonly ALLOWED_IMAGE_TYPES = [
    "image/jpeg",
    "image/jpg",
    "image/png",
    "image/webp",
  ];

  private static readonly ALLOWED_DOCUMENT_TYPES = [
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ];

  private static readonly MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  private static readonly THUMBNAIL_SIZE = { width: 300, height: 300 };


  /**
   * Map FileCategory to actual user model field names
   */
  private static readonly USER_FIELD_MAPPING: Record<FileCategory, string> = {
    [FileCategory.PROFILE_PHOTO]: 'profilePhoto',
    [FileCategory.DRIVER_LICENSE_FRONT]: 'driverLicenseFront', 
    [FileCategory.DRIVER_LICENSE_BACK]: 'driverLicenseBack',
    [FileCategory.VEHICLE_PHOTOS]: 'vehiclePhotos',
    [FileCategory.DOCUMENTS]: 'documents',
    [FileCategory.COMPLAINTS]: 'complaints',
    [FileCategory.COMMUNICATION]: 'communication',
    [FileCategory.PRODUCTS]: 'products'
  };



private static readonly ALLOWED_CATEGORIES = {
    DRIVER: [
      FileCategory.PROFILE_PHOTO,
      FileCategory.DRIVER_LICENSE_FRONT,
      FileCategory.DRIVER_LICENSE_BACK,
      FileCategory.VEHICLE_PHOTOS,
      FileCategory.DOCUMENTS
    ],
    CUSTOMER: [
      FileCategory.PROFILE_PHOTO,
      FileCategory.DOCUMENTS
    ],
    ADMIN: [
      FileCategory.PROFILE_PHOTO,
      FileCategory.DOCUMENTS,
      FileCategory.COMMUNICATION,
      FileCategory.PRODUCTS
    ]
  };

 /**
   * Generate upload URL and directly update user document WITHOUT auto-verification
   */
  static async generateUploadUrlAndUpdateUser(options: {
    contentType: string;
    category: FileCategory;
    accessLevel: FileAccessLevel;
    generateThumbnail?: boolean;
    userId: string;
  }): Promise<UploadUrlResponse & { userUpdated: boolean }> {
    const { userId, category } = options;

    // First generate the upload URL
    const uploadResponse = await this.generateUploadUrl(options);

    try {
      // Update user document with the file URL (NO auto-verification)
      await this.updateUserDocument(userId, category, uploadResponse.fileUrl);
      
      return {
        ...uploadResponse,
        userUpdated: true
      };
    } catch (error) {
      console.error('Failed to update user document:', error);
      return {
        ...uploadResponse,
        userUpdated: false
      };
    }
  }


/**
   * Directly update user document with file URL (NO verification flags)
   */
  private static async updateUserDocument(
    userId: string, 
    category: FileCategory, 
    fileUrl: string
  ): Promise<void> {
    // Get the field name from mapping
    const fieldName = this.USER_FIELD_MAPPING[category];
    if (!fieldName) {
      throw new Error(`No field mapping found for category: ${category}`);
    }

    // Find which model the user belongs to
    const { userModel, userType } = await this.findUserModel(userId);

    // Validate category is allowed for this user type
    this.validateCategoryForUserType(category, userType);

    // ONLY update the file URL field - NO verification flags
    const updateData: any = { [fieldName]: fileUrl };

    // Only set profilePhotoSet for profile photos (non-critical)
    if (category === FileCategory.PROFILE_PHOTO) {
      updateData.profilePhotoSet = true;
      updateData.personalInfoSet = true;
    }

    // Update user document
    await userModel.findByIdAndUpdate(userId, updateData, { new: true });
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

    throw new Error('User not found');
  }

  /**
   * Validate if category is allowed for user type
   */
  private static validateCategoryForUserType(category: FileCategory, userType: string): void {
    const allowedCategories = this.ALLOWED_CATEGORIES[userType as keyof typeof this.ALLOWED_CATEGORIES];
    
    if (!allowedCategories || !allowedCategories.includes(category)) {
      throw new Error(`Category ${category} is not allowed for user type ${userType}`);
    }
  }


  /**
   * Validate file type based on content type
   */
  private static validateContentType(
    contentType: string,
    category: FileCategory
  ): void {
    const isImage = this.ALLOWED_IMAGE_TYPES.includes(contentType);
    const isDocument = this.ALLOWED_DOCUMENT_TYPES.includes(contentType);

    if (!isImage && !isDocument) {
      throw new ErrorResponse(400, "Unsupported file type");
    }

    // Certain categories only allow images
    const imageOnlyCategories = [
      FileCategory.PROFILE_PHOTO,
      FileCategory.VEHICLE_PHOTOS,
      FileCategory.PRODUCTS,
    ];

    if (imageOnlyCategories.includes(category) && !isImage) {
      throw new ErrorResponse(400, `${category} only accepts image files`);
    }
  }

  /**
   * Generate S3 key with proper structure
   */
  private static generateKey(
    category: FileCategory,
    accessLevel: FileAccessLevel,
    contentType: string,
    userId?: string
  ): string {
    const extension = contentType.split("/")[1];
    const randomString = generateRandomString(20);
    const timestamp = Date.now();

    // Structure: access-level/category/userId/timestamp-random.ext
    const userPath = userId ? `${userId}/` : "";
    return `${accessLevel}/${category}/${userPath}${timestamp}-${randomString}.${extension}`;
  }

  /**
   * Generate presigned URL for upload
   */
  private static async generatePresignedUploadUrl(
    key: string,
    contentType: string,
    accessLevel: FileAccessLevel,
    expiresIn: number = 3600
  ): Promise<string> {
    const commandParams: any = {
      Bucket: ENV.AWS_S3_ASSET_BUCKET,
      Key: key,
      ContentType: contentType,
    };

    if (accessLevel === FileAccessLevel.PUBLIC) {
      commandParams.ACL = "public-read";
    }

    const command = new PutObjectCommand(commandParams);

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Generate presigned URL for download (private files only)
   */
  static async generatePresignedDownloadUrl(
    key: string,
    expiresIn: number = 3600
  ): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: ENV.AWS_S3_ASSET_BUCKET,
      Key: key,
    });

    return await getSignedUrl(this.s3Client, command, { expiresIn });
  }

  /**
   * Get public URL for a file
   */
  private static getPublicUrl(key: string): string {
    return `${ENV.AWS_S3_ASSET_HOSTNAME}/${key}`;
  }

  /**
   * Main method to generate upload URLs
   */
  static async generateUploadUrl(
    options: GenerateUploadUrlOptions
  ): Promise<UploadUrlResponse> {
    const { contentType, category, accessLevel, generateThumbnail, userId } =
      options;

    // Validate content type
    this.validateContentType(contentType, category);

    // Generate main file key
    const key = this.generateKey(category, accessLevel, contentType, userId);

    // Generate upload URL (now passes accessLevel)
    const uploadUrl = await this.generatePresignedUploadUrl(
      key,
      contentType,
      accessLevel
    );

    // Generate file access URL
    const fileUrl =
      accessLevel === FileAccessLevel.PUBLIC ? this.getPublicUrl(key) : key;
    const response: UploadUrlResponse = {
      uploadUrl,
      fileUrl,
      key,
    };

    // Generate thumbnail URLs if requested and file is an image
    if (generateThumbnail && this.ALLOWED_IMAGE_TYPES.includes(contentType)) {
      const thumbnailKey = key.replace(/(\.[^.]+)$/, "-thumb$1");
      const thumbnailUploadUrl = await this.generatePresignedUploadUrl(
        thumbnailKey,
        contentType,
        accessLevel
      );

      response.thumbnailUploadUrl = thumbnailUploadUrl;
      response.thumbnailKey = thumbnailKey;
      response.thumbnailUrl =
        accessLevel === FileAccessLevel.PUBLIC
          ? this.getPublicUrl(thumbnailKey)
          : thumbnailKey;
    }

    return response;
  }

  /**
   * Generate thumbnail from uploaded image (to be called via Lambda or background job)
   * This is a placeholder - actual implementation would be in Lambda
   */
  static async generateThumbnail(sourceKey: string): Promise<string> {
    // This would typically be handled by AWS Lambda on S3 upload trigger
    // For now, return the thumbnail key that should be created
    return sourceKey.replace(/(\.[^.]+)$/, "-thumb$1");
  }

  /**
   * Delete file from S3
   */
  static async deleteFile(key: string): Promise<void> {
    const { DeleteObjectCommand } = require("@aws-sdk/client-s3");
    const command = new DeleteObjectCommand({
      Bucket: ENV.AWS_S3_ASSET_BUCKET,
      Key: key,
    });

    await this.s3Client.send(command);
  }
}

export default FileUploadService;
