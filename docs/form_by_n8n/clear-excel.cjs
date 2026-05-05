const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const base = path.resolve(__dirname);

const AR = [
  'الاسم الأول','الكنية','الاسم بالعربية','اسم الأب',
  'الاسم بالإنجليزية','تاريخ الميلاد','الجنس','التخصص',
  'البريد الإلكتروني','رقم الهاتف','المدينة','عنوان العمل',
  'تاريخ الانضمام','نوع العضوية','معرّف الجمعية الأوروبية','تاريخ التسجيل',
];
const EN = [
  'First name','Last name','Full name (Arabic)',"Father's name",
  'Full name (English)','Date of birth','Gender','Specialty',
  'Email','Phone','City','Work address',
  'Join date','Membership type','ESC ID','Submitted at',
];

const files = [
  { file: 'نموذج-الأعضاء-عربي.xlsx',       headers: AR, sheet: 'الأعضاء' },
  { file: 'SCVA-Members-Template-EN.xlsx', headers: EN, sheet: 'Members'  },
];

files.forEach(({ file, headers, sheet }) => {
  const filePath = path.join(base, file);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([headers]), sheet);
  fs.writeFileSync(filePath, XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }));
  console.log('✓ تم مسح البيانات من:', file);
});
