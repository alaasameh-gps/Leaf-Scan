import mongoose, { Schema, Document, Model } from "mongoose";

export interface IPlantAnalysis extends Document {
  user?: mongoose.Types.ObjectId;
  classId: string;
  displayName?: string;
  confidence: number;
  confident: boolean;
  alternatives?: Array<{ classId: string; score: number }>;
  warnings?: string[];
  language?: string;
  createdAt: Date;
}

const PlantAnalysisSchema: Schema = new Schema<IPlantAnalysis>(
  {
    user: { type: Schema.Types.ObjectId, ref: "User", index: true },
    classId: { type: String, required: true },
    displayName: { type: String },
    confidence: { type: Number, required: true },
    confident: { type: Boolean, default: false },
    alternatives: [{ classId: String, score: Number }],
    warnings: [{ type: String }],
    language: { type: String, default: "ar" },
  },
  { timestamps: true },
);

const PlantAnalysis: Model<IPlantAnalysis> =
  mongoose.models.PlantAnalysis || mongoose.model<IPlantAnalysis>("PlantAnalysis", PlantAnalysisSchema);

export default PlantAnalysis;
