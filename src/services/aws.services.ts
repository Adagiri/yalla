import { ENV } from '../config/env';
import {
  S3Client,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

interface Coordinates {
  lat: number;
  lng: number;
}

interface Bounds {
  northeast: Coordinates;
  southwest: Coordinates;
}

export interface LocationData {
  lat: number;
  lng: number;
  bounds: Bounds | null;
  address?: string;
}

class AWSServices {
  /**
   * Generates a pre-signed URL for S3 uploads.
   * @param key - The S3 object key.
   * @param contentType - The MIME type of the file.
   * @returns A signed URL as a string or null in case of error.
   */
  static async generateS3SignedUrl(
    key: string,
    contentType: string
  ): Promise<string | null> {
    try {
      const s3Client = new S3Client({
        region: ENV.AWS_REGION,
        credentials: {
          accessKeyId: ENV.AWS_ACCESS_KEY_ID,
          secretAccessKey: ENV.AWS_SECRET_ACCESS_KEY,
        },
      });

      const command = new PutObjectCommand({
        Bucket: ENV.AWS_S3_ASSET_UPLOAD_BUCKET,
        Key: key,
        ContentType: contentType,
      });

      const signedUrl = await getSignedUrl(s3Client, command, {
        expiresIn: 3600,
      });
      return signedUrl;
    } catch (error: any) {
      console.error('Error generating S3 signed URL:', error);
      return null;
    }
  }
}

export default AWSServices;
