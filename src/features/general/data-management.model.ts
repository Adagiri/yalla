import mongoose, { Schema, Document } from "mongoose";

export interface IDataExport extends Document {
  exportType: "TRIP_REPORTS" | "USERS_DATA" | "PAYMENT_RECORDS" | "ALL_DATA";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  fileUrl?: string;
  fileSizeMB?: number;
  recordCount: number;
  filters?: any; // JSON object for export filters
  requestedBy: mongoose.Types.ObjectId | string; // Admin ID
  requestedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

export interface IDataImport extends Document {
  importType: "DRIVER_DATA" | "CUSTOMER_DATA" | "VEHICLE_DATA";
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  fileName: string;
  fileSizeMB: number;
  recordCount: number;
  successfulImports: number;
  failedImports: number;
  importedBy: mongoose.Types.ObjectId | string;
  importedAt: Date;
  completedAt?: Date;
  errorMessage?: string;
}

const DataExportSchema = new Schema<IDataExport>(
  {
    exportType: {
      type: String,
      required: true,
      enum: ["TRIP_REPORTS", "USERS_DATA", "PAYMENT_RECORDS", "ALL_DATA"],
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    fileUrl: String,
    fileSizeMB: Number,
    recordCount: {
      type: Number,
      required: true,
      default: 0,
    },
    filters: Schema.Types.Mixed,
    requestedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    requestedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    errorMessage: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

const DataImportSchema = new Schema<IDataImport>(
  {
    importType: {
      type: String,
      required: true,
      enum: ["DRIVER_DATA", "CUSTOMER_DATA", "VEHICLE_DATA"],
    },
    status: {
      type: String,
      required: true,
      enum: ["PENDING", "PROCESSING", "COMPLETED", "FAILED"],
      default: "PENDING",
    },
    fileName: {
      type: String,
      required: true,
    },
    fileSizeMB: {
      type: Number,
      required: true,
      min: 0,
    },
    recordCount: {
      type: Number,
      required: true,
      default: 0,
    },
    successfulImports: {
      type: Number,
      default: 0,
    },
    failedImports: {
      type: Number,
      default: 0,
    },
    importedBy: {
      type: Schema.Types.ObjectId,
      ref: "Admin",
      required: true,
    },
    importedAt: {
      type: Date,
      default: Date.now,
    },
    completedAt: Date,
    errorMessage: String,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

export const DataExport = mongoose.model<IDataExport>(
  "DataExport",
  DataExportSchema
);
export const DataImport = mongoose.model<IDataImport>(
  "DataImport",
  DataImportSchema
);
