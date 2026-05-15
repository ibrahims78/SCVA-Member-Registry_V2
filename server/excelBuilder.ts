import type { FormSubmission } from "@shared/schema";

const AR_HEADERS = [
  "الاسم الأول", "الكنية", "الاسم بالعربية", "اسم الأب",
  "الاسم بالإنجليزية", "تاريخ الميلاد", "الجنس", "التخصص",
  "البريد الإلكتروني", "رقم الهاتف", "المدينة", "عنوان العمل",
  "تاريخ الانضمام", "نوع العضوية", "معرّف الجمعية الأوروبية", "تاريخ التسجيل",
];

const EN_HEADERS = [
  "First name", "Last name", "Full name (Arabic)", "Father's name",
  "Full name (English)", "Date of birth", "Gender", "Specialty",
  "Email", "Phone", "City", "Work address",
  "Join date", "Membership type", "ESC ID", "Submitted at",
];

const AR_GENDER:     Record<string, string> = { male: "ذكر",               female: "أنثى" };
const AR_SPECIALTY:  Record<string, string> = { cardiology: "قلبية داخلية", cardiac_surgery: "جراحة قلب" };
const AR_MEMBERSHIP: Record<string, string> = { original: "عضو أصيل",      associate: "عضو مشارك" };
const EN_GENDER:     Record<string, string> = { male: "Male",               female: "Female" };
const EN_SPECIALTY:  Record<string, string> = { cardiology: "Cardiology",   cardiac_surgery: "Cardiac Surgery" };
const EN_MEMBERSHIP: Record<string, string> = { original: "Original Member", associate: "Associate Member" };

function rowToAr(r: FormSubmission): unknown[] {
  return [
    r.firstName, r.lastName, r.fullName, r.fatherName, r.englishName,
    r.birthDate,
    AR_GENDER[r.genderRaw]         || r.gender,
    AR_SPECIALTY[r.specialtyRaw]   || r.specialty,
    r.email, r.phone, r.city, r.workAddress, r.joinDate,
    AR_MEMBERSHIP[r.membershipTypeRaw] || r.membershipType,
    r.escId, r.submittedAt,
  ];
}

function rowToEn(r: FormSubmission): unknown[] {
  return [
    r.firstName, r.lastName, r.fullName, r.fatherName, r.englishName,
    r.birthDate,
    EN_GENDER[r.genderRaw]         || r.gender,
    EN_SPECIALTY[r.specialtyRaw]   || r.specialty,
    r.email, r.phone, r.city, r.workAddress, r.joinDate,
    EN_MEMBERSHIP[r.membershipTypeRaw] || r.membershipType,
    r.escId, r.submittedAt,
  ];
}

export function buildExcelBuffers(rows: FormSubmission[]): { arBuffer: Buffer; enBuffer: Buffer } {
  const XLSX = require("xlsx");

  const arWb = XLSX.utils.book_new();
  const arData = [AR_HEADERS, ...rows.map(rowToAr)];
  const arWs = XLSX.utils.aoa_to_sheet(arData);
  XLSX.utils.book_append_sheet(arWb, arWs, "الأعضاء");
  const arBuffer = Buffer.from(XLSX.write(arWb, { type: "buffer", bookType: "xlsx" }));

  const enWb = XLSX.utils.book_new();
  const enData = [EN_HEADERS, ...rows.map(rowToEn)];
  const enWs = XLSX.utils.aoa_to_sheet(enData);
  XLSX.utils.book_append_sheet(enWb, enWs, "Members");
  const enBuffer = Buffer.from(XLSX.write(enWb, { type: "buffer", bookType: "xlsx" }));

  return { arBuffer, enBuffer };
}
