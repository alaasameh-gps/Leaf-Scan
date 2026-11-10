"""Insert PlantClassInfo entries for the newly added crops into src/lib/plant/classes.ts.

Idempotent: existing ids are left untouched. Run from the project root:
    py -3.12 ml/scripts/gen_classes_ts.py
"""

from __future__ import annotations

import re
from pathlib import Path

TS_PATH = Path(__file__).resolve().parents[2] / "src" / "lib" / "plant" / "classes.ts"

# (id, cropEn, cropAr, scientificName, fallbackGenus, conditionEn, conditionAr, conditionType, searchTerm)
H = "healthy"
HAR = "سليمة"

CROPS = {
    "Banana": ("Banana (plantain)", "موز", "Musa acuminata", "Musa"),
    "Cotton": ("Cotton", "قطن", "Gossypium hirsutum", "Gossypium"),
    "Guava": ("Guava", "جوافة", "Psidium guajava", "Psidium"),
    "Lemon": ("Lemon", "ليمون", "Citrus limon", "Citrus"),
    "Rice": ("Rice", "أرز", "Oryza sativa", "Oryza"),
    "Sugarcane": ("Sugarcane", "قصب السكر", "Saccharum officinarum", "Saccharum"),
    "Bitter_Gourd": ("Bitter gourd", "كارلا (قرع مر)", "Momordica charantia", "Momordica"),
    "Bottle_gourd": ("Bottle gourd", "دبّاء (قرع)", "Lagenaria siceraria", "Lagenaria"),
    "Cauliflower": ("Cauliflower", "قرنبيط", "Brassica oleracea", "Brassica"),
    "Cucumber": ("Cucumber", "خيار", "Cucumis sativus", "Cucumis"),
    "Eggplant": ("Eggplant (brinjal)", "باذنجان", "Solanum melongena", "Solanum"),
    "Tomato": ("Tomato", "طماطم", "Solanum lycopersicum", "Solanum"),
}

# id (crop___condition) is derived; only non-healthy conditions listed here.
# (crop, condition_key, conditionEn, conditionAr, type, searchTerm)
DISEASES = [
    ("Banana", "Sigatoka", "Yellow sigatoka (leaf spot)", "سيجاتوكا (تبقع أوراق الموز)", "fungal", "Yellow sigatoka"),
    ("Banana", "Xanthomonas_wilt", "Xanthomonas wilt (BXW)", "ذبول زانثوموناس", "bacterial", "Xanthomonas wilt banana"),
    ("Cotton", "Alternaria_leaf_spot", "Alternaria leaf spot", "تبقع الأوراق الألترناريا", "fungal", "Alternaria leaf spot cotton"),
    ("Cotton", "Bacterial_blight", "Bacterial blight", "اللفحة البكتيرية", "bacterial", "Bacterial blight cotton"),
    ("Cotton", "Fusarium_wilt", "Fusarium wilt", "ذبول الفيوزاريوم", "fungal", "Fusarium wilt cotton"),
    ("Cotton", "Verticillium_wilt", "Verticillium wilt", "ذبول الفيرتسيليوم", "fungal", "Verticillium wilt cotton"),
    ("Guava", "Anthracnose", "Anthracnose", "الأنثراكنوز", "fungal", "Anthracnose guava"),
    ("Guava", "Canker", "Canker", "التقرح", "fungal", "Guava canker"),
    ("Guava", "Dot", "Leaf spot (dot)", "تبقع نقطي", "fungal", "Guava leaf spot"),
    ("Guava", "Rust", "Rust", "الصدأ", "fungal", "Guava rust"),
    ("Guava", "Scab", "Scab", "الجرب", "fungal", "Guava scab"),
    ("Guava", "Stylar_end_rot", "Stylar end rot", "عفن القمة القلمية", "fungal", "Stylar end rot guava"),
    ("Lemon", "Anthracnose", "Anthracnose", "الأنثراكنوز", "fungal", "Citrus anthracnose"),
    ("Lemon", "Bacterial_blight", "Bacterial blight", "اللفحة البكتيرية", "bacterial", "Citrus bacterial blight"),
    ("Lemon", "Citrus_canker", "Citrus canker", "تقرح الحمضيات", "bacterial", "Citrus canker"),
    ("Lemon", "Curl_virus", "Leaf curl virus", "فيروس التجعد", "viral", "Citrus leaf curl virus"),
    ("Lemon", "Nutrient_deficiency", "Nutrient deficiency", "نقص العناصر الغذائية", "unknown", "Citrus nutrient deficiency"),
    ("Lemon", "Dry_leaf", "Dry leaf", "جفاف الأوراق", "unknown", "Citrus leaf drying"),
    ("Lemon", "Sooty_mould", "Sooty mould", "العفن الهبابي", "fungal", "Sooty mould"),
    ("Lemon", "Spider_mites", "Spider mites", "العنكبوت الأحمر (الأكاروس)", "pest", "Spider mites citrus"),
    ("Rice", "Bacterial_leaf_blight", "Bacterial leaf blight", "لفحة الأوراق البكتيرية", "bacterial", "Bacterial leaf blight rice"),
    ("Rice", "Brown_spot", "Brown spot", "التبقع البني", "fungal", "Brown spot rice"),
    ("Rice", "Leaf_blast", "Leaf blast", "لفحة الأوراق (البلاست)", "fungal", "Rice blast"),
    ("Rice", "Leaf_scald", "Leaf scald", "تقشر الأوراق", "fungal", "Rice leaf scald"),
    ("Rice", "Sheath_blight", "Sheath blight", "لفحة الغمد", "fungal", "Rice sheath blight"),
    ("Sugarcane", "Banded_chlorosis", "Banded chlorosis", "الاصفرار الشريطي", "viral", "Sugarcane banded chlorosis"),
    ("Sugarcane", "Brown_spot", "Brown spot", "التبقع البني", "fungal", "Sugarcane brown spot"),
    ("Sugarcane", "Brown_rust", "Brown rust", "الصدأ البني", "fungal", "Sugarcane rust"),
    ("Sugarcane", "Dried", "Dried leaves", "جفاف الأوراق", "unknown", "Sugarcane dried leaves"),
    ("Sugarcane", "Grassy_shoot", "Grassy shoot", "النمو العشبي", "unknown", "Sugarcane grassy shoot"),
    ("Sugarcane", "Pokkah_boeng", "Pokkah boeng", "بوكاه بونغ", "fungal", "Pokkah boeng"),
    ("Sugarcane", "Sett_rot", "Sett rot", "عفن الشتلات (العقل)", "fungal", "Sugarcane sett rot"),
    ("Sugarcane", "Smut", "Smut", "التفحم", "fungal", "Sugarcane smut"),
    ("Sugarcane", "Viral_disease", "Viral disease", "مرض فيروسي", "viral", "Sugarcane viral disease"),
    ("Sugarcane", "Yellow_leaf", "Yellow leaf syndrome", "متلازمة اصفرار الأوراق", "viral", "Sugarcane yellow leaf"),
    ("Bitter_Gourd", "Downy_mildew", "Downy mildew", "البياض الزغبي", "oomycete", "Downy mildew"),
    ("Bitter_Gourd", "Fusarium_wilt", "Fusarium wilt", "ذبول الفيوزاريوم", "fungal", "Fusarium wilt"),
    ("Bitter_Gourd", "Mosaic_virus", "Mosaic virus", "فيروس الموزاييك", "viral", "Mosaic virus"),
    ("Bottle_gourd", "Anthracnose", "Anthracnose", "الأنثراكنوز", "fungal", "Anthracnose"),
    ("Bottle_gourd", "Downy_mildew", "Downy mildew", "البياض الزغبي", "oomycete", "Downy mildew"),
    ("Cauliflower", "Black_rot", "Black rot", "العفن الأسود", "bacterial", "Black rot"),
    ("Cauliflower", "Downy_mildew", "Downy mildew", "البياض الزغبي", "oomycete", "Downy mildew"),
    ("Cucumber", "Anthracnose", "Anthracnose", "الأنثراكنوز", "fungal", "Anthracnose"),
    ("Cucumber", "Downy_mildew", "Downy mildew", "البياض الزغبي", "oomycete", "Downy mildew"),
    ("Eggplant", "Begomovirus", "Begomovirus", "فيروس البيجومو", "viral", "Begomovirus"),
    ("Eggplant", "Cercospora_leaf_spot", "Cercospora leaf spot", "تبقع سيركوسبورا", "fungal", "Cercospora leaf spot"),
    ("Eggplant", "Verticillium_wilt", "Verticillium wilt", "ذبول الفيرتسيليوم", "fungal", "Verticillium wilt"),
    ("Tomato", "Spotted_wilt", "Spotted wilt", "الذبول المبقع", "viral", "Tomato spotted wilt virus"),
]

HEALTHY_CROPS = ["Banana", "Cotton", "Guava", "Lemon", "Rice", "Sugarcane",
                 "Bitter_Gourd", "Bottle_gourd", "Cauliflower", "Cucumber", "Eggplant"]


def _entry(id_: str, crop: str, cond_en, cond_ar, ctype: str, search, healthy: bool) -> str:
    cropEn, cropAr, sci, genus = CROPS[crop]
    search_lit = "null" if not search else f'"{search}"'
    return f'''  "{id_}": {{
    id: "{id_}",
    cropEn: "{cropEn}",
    cropAr: "{cropAr}",
    scientificName: "{sci}",
    fallbackGenus: "{genus}",
    conditionEn: "{cond_en}",
    conditionAr: "{cond_ar}",
    conditionType: "{ctype}",
    diseaseSearchTerm: {search_lit},
    isBackground: false,
  }},
'''


def main() -> int:
    text = TS_PATH.read_text(encoding="utf-8")

    target_ids: set[str] = set()
    for crop in HEALTHY_CROPS:
        target_ids.add(f"{crop}___{H}")
        target_ids.add(f"{crop}___Healthy")  # legacy wrong-case variant
    for crop, cond, *_ in DISEASES:
        target_ids.add(f"{crop}___{cond}")

    # Remove any previously inserted entries (idempotent re-run).
    removed = 0
    for id_ in sorted(target_ids):
        pattern = re.compile(r'\n  "' + re.escape(id_) + r'": \{[^{}]*?\},\n')
        text, n = pattern.subn("\n", text)
        removed += n

    existing = set(re.findall(r'^\s*"([^"]+)"\s*:\s*\{', text, flags=re.M))

    blocks: list[str] = []
    for crop in HEALTHY_CROPS:
        cid = f"{crop}___{H}"
        if cid not in existing:
            blocks.append(_entry(cid, crop, "Healthy", HAR, "healthy", None, True))
    for crop, cond, cen, car, ctype, search in DISEASES:
        cid = f"{crop}___{cond}"
        if cid not in existing:
            blocks.append(_entry(cid, crop, cen, car, ctype, search, False))

    if not blocks:
        print(f"nothing to add (already present); removed {removed}")
        return 0

    marker = "\n};\n\nexport const SUPPORTED_CLASS_IDS"
    if marker not in text:
        raise SystemExit("could not find PLANT_CLASSES closing marker")
    insertion = "\n" + "".join(blocks) + "};\n\nexport const SUPPORTED_CLASS_IDS"
    text = text.replace(marker, insertion, 1)
    TS_PATH.write_text(text, encoding="utf-8")
    print(f"removed {removed}, inserted {len(blocks)} entries into {TS_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
