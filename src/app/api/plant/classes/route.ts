import { NextResponse } from "next/server";
import { CONDITION_TYPE_LABEL, SUPPORTED_CLASS_IDS, PLANT_CLASSES } from "../../../../lib/plant/classes";

export const dynamic = "force-static";

export async function GET() {
  const classes = SUPPORTED_CLASS_IDS.map((id) => {
    const info = PLANT_CLASSES[id];
    return {
      id,
      cropEn: info.cropEn,
      cropAr: info.cropAr,
      conditionEn: info.conditionEn,
      conditionAr: info.conditionAr,
      conditionType: info.conditionType,
      conditionLabel: CONDITION_TYPE_LABEL[info.conditionType],
      isBackground: info.isBackground,
    };
  });
  return NextResponse.json({ success: true, data: { count: classes.length, classes } });
}
