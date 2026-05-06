# دراسة جدوى مشروع نموذج تسجيل مستضاف على Google Drive
## تحليل تقني احترافي — مقارنة وتوصيات

---

> **نوع الوثيقة:** دراسة جدوى + توصية تقنية
> **التاريخ:** مايو 2026
> **الهدف:** تقييم إمكانية بناء نظام مماثل لـ SCVA باستخدام Google Drive / Google Sheets / Gmail
> **القرار النهائي:** في نهاية الوثيقة

---

## جدول المحتويات

1. [فهم المتطلبات](#1-فهم-المتطلبات)
2. [التقنيات المتاحة من Google](#2-التقنيات-المتاحة)
3. [البنية المقترحة المثلى](#3-البنية-المقترحة)
4. [شرح كل مكوّن](#4-شرح-كل-مكوّن)
5. [مقارنة مع نظام SCVA الحالي](#5-مقارنة-مع-scva)
6. [المزايا والقيود](#6-المزايا-والقيود)
7. [خطة التنفيذ المرحلية](#7-خطة-التنفيذ)
8. [الأمان والخصوصية](#8-الأمان)
9. [إمكانية دمج الذكاء الاصطناعي](#9-الذكاء-الاصطناعي)
10. [التكلفة المتوقعة](#10-التكلفة)
11. [توصيتي الاحترافية النهائية](#11-التوصية-النهائية)

---

## 1. فهم المتطلبات

### ما يريده العميل:

```
صفحة HTML موجودة في Google Drive
        ↓
يشارك رابطها مع العملاء
        ↓
العميل يعبئ البيانات ويضغط "إرسال"
        ↓
البيانات تُكتب تلقائياً في ملف Excel على Google Drive
        ↓
إشعار بريدي للمسؤول + تأكيد للعميل
```

### ما يبدو بسيطاً لكنه يستوجب التدقيق:

السؤال الجوهري: **كيف تُكتب البيانات في الإكسل؟**

ملف HTML ثابت في Google Drive لا يملك أي قدرة على الكتابة أو إرسال البريد بذاته.
يجب أن يكون هناك **طرف ثالث** يستقبل البيانات ويُنفّذ المنطق.

هذا الطرف الثالث هو **Google Apps Script**.

---

## 2. التقنيات المتاحة من Google

### 2.1 Google Drive — تخزين الملفات

| الإمكانية | التفاصيل |
|-----------|---------|
| تخزين HTML | ✅ يمكن رفع ملف HTML |
| مشاركة رابط | ✅ رابط مشاركة عام |
| تشغيل HTML كصفحة ويب | ⚠️ محدود — "Preview" فقط، لا يدعم JavaScript المعقّد |
| استضافة فعلية | ❌ Drive ليس web server |

> **ملاحظة مهمة:** عند فتح ملف HTML من Google Drive، يعمل في iframe محدود. الكثير من APIs الحديثة (fetch، localStorage) قد لا تعمل بشكل كامل.

### 2.2 Google Apps Script — المحرك الحقيقي

منصة تطوير مجانية من Google تعمل على سحابة Google مباشرة:

| الإمكانية | التفاصيل |
|-----------|---------|
| **Web App** | نشر كـ API endpoint يستقبل POST/GET |
| **Google Sheets** | قراءة وكتابة مباشرة في أي Spreadsheet |
| **Gmail** | إرسال بريد إلكتروني باسم حساب Google |
| **Drive API** | رفع ملفات وإدارتها |
| **Triggers** | تشغيل كود عند أحداث معينة |
| **المجانية** | مجانية تماماً ضمن حصص Google |

### 2.3 Google Sheets — قاعدة البيانات

| الإمكانية | التفاصيل |
|-----------|---------|
| تعادل ملف Excel | ✅ يمكن تصدير xlsx في أي وقت |
| تحديث فوري | ✅ البيانات تظهر فوراً لكل من يملك الرابط |
| مشاركة متعددة | ✅ عدة أشخاص يرون البيانات |
| تاريخ التعديلات | ✅ سجل كامل بكل تغيير |
| الصيغ والفلاتر | ✅ كل إمكانيات Excel |

### 2.4 Google Sites — الاستضافة الصحيحة

بديل أفضل من Drive لاستضافة النموذج:

| الإمكانية | التفاصيل |
|-----------|---------|
| نشر صفحة ويب حقيقية | ✅ رابط sites.google.com/... |
| تضمين HTML مخصص | ✅ عبر "Embed" |
| مجاني | ✅ ضمن Google Workspace |
| لا يحتاج خبرة تقنية | ✅ واجهة سحب وإفلات |

---

## 3. البنية المقترحة المثلى

بعد تحليل جميع الخيارات، هذه البنية التقنية المثلى لتحقيق المتطلبات:

```
┌─────────────────────────────────────────────────────────────┐
│                    البنية المقترحة                          │
│                                                             │
│  ┌─────────────────────────────────┐                       │
│  │     صفحة HTML (النموذج)         │                       │
│  │  مستضافة على Google Sites       │  ← رابط قابل للمشاركة │
│  │  أو رفعها على أي CDN مجاني      │                       │
│  └──────────────┬──────────────────┘                       │
│                 │ fetch POST (JavaScript)                   │
│                 ▼                                           │
│  ┌─────────────────────────────────┐                       │
│  │   Google Apps Script Web App    │  ← المحرك الحقيقي    │
│  │   (نشره كـ API endpoint)        │                       │
│  │                                 │                       │
│  │  doPost(e) {                    │                       │
│  │    const data = JSON.parse(...) │                       │
│  │    writeToSheet(data)           │                       │
│  │    sendAdminEmail(data)         │                       │
│  │    sendClientEmail(data)        │                       │
│  │    return success               │                       │
│  │  }                              │                       │
│  └────┬──────────┬─────────────────┘                       │
│       │          │          │                              │
│       ▼          ▼          ▼                              │
│  ┌─────────┐ ┌───────┐ ┌─────────┐                        │
│  │ Google  │ │ Gmail │ │ Gmail   │                        │
│  │ Sheets  │ │ Admin │ │ Client  │                        │
│  │(الإكسل) │ │ Email │ │ Email   │                        │
│  └─────────┘ └───────┘ └─────────┘                        │
└─────────────────────────────────────────────────────────────┘
```

---

## 4. شرح كل مكوّن

### 4.1 النموذج (HTML + JavaScript)

ملف HTML يُستضاف على Google Sites أو أي خدمة مجانية (Netlify، GitHub Pages):

```html
<!-- النموذج يرسل البيانات مباشرة لـ Apps Script -->
<form id="registrationForm">
  <input type="text" name="fullName" required />
  <input type="email" name="email" />
  <!-- ... -->
  <button type="submit">إرسال</button>
</form>

<script>
document.getElementById('registrationForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(e.target));
  
  const response = await fetch('APPS_SCRIPT_WEB_APP_URL', {
    method: 'POST',
    body: JSON.stringify(data)
  });
  
  const result = await response.json();
  if (result.status === 'success') {
    // عرض صفحة التأكيد
  }
});
</script>
```

### 4.2 Google Apps Script (القلب النابض)

```javascript
// Code.gs — يُنشر كـ Web App

const SPREADSHEET_ID = 'YOUR_GOOGLE_SHEET_ID';
const ADMIN_EMAIL    = 'admin@example.com';

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    
    // 1. الكتابة في Google Sheets
    writeToSheet(data);
    
    // 2. إرسال إيميل للمسؤول
    sendAdminEmail(data);
    
    // 3. إرسال تأكيد للعميل (إذا أعطى بريده)
    if (data.email) {
      sendClientEmail(data);
    }
    
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'success' }))
      .setMimeType(ContentService.MimeType.JSON);
      
  } catch(err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function writeToSheet(data) {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getActiveSheet();
  
  sheet.appendRow([
    new Date(),           // تاريخ الإرسال
    data.fullName,
    data.email,
    data.phone,
    data.city,
    // ... باقي الحقول
  ]);
}

function sendAdminEmail(data) {
  GmailApp.sendEmail(
    ADMIN_EMAIL,
    'طلب جديد: ' + data.fullName,
    '',  // نص عادي (فارغ)
    {
      htmlBody: buildAdminEmailHtml(data),
      name: 'نظام التسجيل'
    }
  );
}

function sendClientEmail(data) {
  GmailApp.sendEmail(
    data.email,
    'تم استلام طلبك بنجاح',
    '',
    {
      htmlBody: buildClientEmailHtml(data),
      name: 'نظام التسجيل'
    }
  );
}
```

### 4.3 Google Sheets (قاعدة البيانات)

- Spreadsheet مُشترك مع من يحتاج الاطلاع عليه
- كل إرسال يُضيف صفاً جديداً تلقائياً
- يمكن تصديره كـ Excel (.xlsx) في أي وقت
- يمكن ربطه بـ Google Data Studio للرسوم البيانية

---

## 5. مقارنة مع نظام SCVA الحالي

| الجانب | نظام SCVA (n8n + Replit) | النظام المقترح (Google) |
|--------|--------------------------|------------------------|
| **الاستضافة** | Replit (مدفوع للإنتاج) | Google (مجاني تماماً) |
| **قاعدة البيانات** | PostgreSQL | Google Sheets |
| **منطق العمل** | n8n Workflow | Google Apps Script |
| **البريد الإلكتروني** | SMTP خارجي | Gmail مباشر |
| **الذكاء الاصطناعي** | Gemini / OpenAI | Gemini / OpenAI (نفس) |
| **التخصيص** | عالٍ جداً | متوسط إلى عالٍ |
| **التعقيد التقني** | عالٍ (n8n + سيرفر) | منخفض إلى متوسط |
| **التكلفة** | ~$7-25/شهر | مجاني |
| **الصيانة** | تحتاج خبرة تقنية | أبسط نسبياً |
| **الأمان** | عالٍ (JWT + bcrypt) | جيد (Google Auth) |
| **لوحة التحكم** | تطبيق ويب متكامل | Google Sheets مباشر |
| **النسخ الاحتياطي** | يدوي أو cron | تلقائي من Google |
| **الحد من الطلبات** | غير محدود | 20,000 طلب/يوم (مجاني) |

---

## 6. المزايا والقيود

### ✅ المزايا

**1. مجاني تماماً**
Google Apps Script + Google Sheets + Gmail = لا تكلفة شهرية إطلاقاً
(ضمن حصص الاستخدام المجانية التي تكفي للغالبية العظمى من المشاريع الصغيرة والمتوسطة)

**2. لا حاجة لسيرفر**
كل شيء يعمل على سحابة Google — لا يحتاج Replit أو VPS أو Heroku

**3. Gmail بدون إعداد SMTP**
إرسال البريد مباشر عبر GmailApp — لا credentials، لا ports، لا TLS config

**4. Google Sheets كقاعدة بيانات**
- يراها المسؤول مباشرة — لا تطبيق ويب مستقل
- تصدير Excel بضغطة واحدة
- فلاتر، مخططات، pivot tables مدمجة
- مشاركة مع الفريق فورياً

**5. سرعة التطوير**
يمكن بناء نظام عمل كامل في يوم واحد أو يومين

**6. لا صيانة للسيرفر**
Google تتولى التحديثات والأمان والـ uptime

---

### ⚠️ القيود الحقيقية (يجب أخذها بجدية)

**1. استضافة HTML على Google Drive — إشكالية حقيقية**

```
المشكلة:
Google Drive يعرض HTML كـ "Preview" في iframe
هذا الـ iframe يمنع:
  - fetch() للنطاقات الخارجية (CORS)
  - localStorage
  - بعض JavaScript APIs
  - cookies
```

**الحل:** لا تستضيف HTML في Drive. استخدم إحدى البدائل:
- **Google Sites** (مجاني، ضمن Google Workspace)
- **GitHub Pages** (مجاني تماماً)
- **Netlify** (مجاني لـ 100GB/شهر)
- **Cloudflare Pages** (مجاني بلا حدود تقريباً)

**2. Gmail فقط — لا email مخصص**

البريد يُرسَل من حساب Gmail الخاص بصاحب الـ Apps Script:
```
من: yourname@gmail.com
```
وليس من:
```
من: noreply@yourcompany.com
```

**الحل للبريد المخصص:** استخدام SendGrid أو Resend (مجانية للكميات الصغيرة) أو Google Workspace ($6/شهر للبريد المؤسسي)

**3. حصص الاستخدام المجانية**

| الخدمة | الحد اليومي المجاني |
|--------|-------------------|
| Apps Script executions | 20,000 |
| Gmail emails | 100 إيميل/يوم |
| Spreadsheet rows | غير محدود |

> 100 إيميل/يوم يكفي لمعظم المشاريع. إذا توقعت أكثر → Google Workspace ($6/شهر) يرفعه لـ 1,500/يوم

**4. لا تحكم كامل في البريد**

Gmail قد يُصنّف رسائل Apps Script كـ Spam أحياناً. الحل: إضافة SPF/DKIM أو استخدام خدمة بريد مخصصة.

**5. رمز التحقق — يحتاج Apps Script أيضاً**

التحقق من رمز الدعوة يتم في Apps Script (وليس في النموذج) — هذا جيد، لكن يعني أن الكود موجود في Google وليس تحت تحكمك الكامل.

---

## 7. خطة التنفيذ المرحلية

### المرحلة الأولى — الأساس (يوم 1-2)

```
✅ إنشاء Google Spreadsheet بالأعمدة المطلوبة
✅ كتابة Google Apps Script الأساسي (doPost + writeToSheet)
✅ نشره كـ Web App ("Execute as: Me", "Access: Anyone")
✅ اختبار الـ endpoint بـ Postman أو curl
```

### المرحلة الثانية — النموذج (يوم 2-3)

```
✅ بناء ملف HTML بنفس أسلوب نموذج SCVA (4 خطوات، RTL/LTR، dark mode)
✅ ربط زر الإرسال بـ Apps Script URL
✅ رفعه على GitHub Pages أو Netlify
✅ اختبار الإرسال الكامل
```

### المرحلة الثالثة — الإشعارات (يوم 3-4)

```
✅ إضافة sendAdminEmail() مع HTML جميل
✅ إضافة sendClientEmail() مع رسالة ترحيب
✅ اختبار الإيميلات
✅ التأكد من وصولها (وليس Spam)
```

### المرحلة الرابعة — التحسينات (يوم 4-5)

```
✅ رمز التحقق في Apps Script
✅ منع التكرار (التحقق من الإيميل في الشيت)
✅ حماية من البريد المزعج (honeypot field)
✅ aiLog للتشخيص
✅ (اختياري) Gemini API للتحليل الذكي
```

---

## 8. الأمان والخصوصية

### نقاط الأمان المهمة

**1. رمز التحقق**
يُخزَّن في Apps Script Properties (وليس في الكود مباشرة):
```javascript
const expectedCode = PropertiesService.getScriptProperties()
                       .getProperty('VERIFICATION_CODE');
```

**2. منع إرسال عشوائي (Rate Limiting)**
Apps Script لا يدعم rate limiting مدمجاً.
الحلول:
- Honeypot field في النموذج (حقل مخفي — الروبوتات تملؤه)
- reCAPTCHA v3 من Google (مجاني)
- فحص المدة الزمنية (رفض الطلبات أسرع من 3 ثوانٍ)

**3. CORS**
Web App يجب أن يُعيد الـ headers الصحيحة:
```javascript
return ContentService.createTextOutput(JSON.stringify(result))
  .setMimeType(ContentService.MimeType.JSON);
// Apps Script يُضيف CORS headers تلقائياً عند النشر بـ "Anyone"
```

**4. البيانات الحساسة**
- لا تضع أرقام هويات أو معلومات طبية حساسة في Google Sheets بدون تشفير
- للبيانات الحساسة جداً: استخدم سيرفر مستقل مع تشفير

---

## 9. إمكانية دمج الذكاء الاصطناعي

يمكن دمج نفس منطق AI المستخدم في SCVA مباشرة في Apps Script:

```javascript
function callGemini(prompt) {
  const API_KEY = PropertiesService.getScriptProperties()
                    .getProperty('GEMINI_API_KEY');
  
  const response = UrlFetchApp.fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=' + API_KEY,
    {
      method: 'POST',
      contentType: 'application/json',
      payload: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    }
  );
  
  const json = JSON.parse(response.getContentText());
  return json.candidates?.[0]?.content?.parts?.[0]?.text || '';
}
```

> **ملاحظة:** `UrlFetchApp` هو الـ `fetch` الخاص بـ Apps Script — يعمل بدون قيود على الطلبات الخارجية (على عكس n8n Code node).

**النتيجة:** لا حاجة لـ HTTP Request node المنفصل كما في n8n — كل شيء في مكان واحد.

---

## 10. التكلفة المتوقعة

### السيناريو المجاني الكامل

| المكوّن | التكلفة |
|---------|---------|
| Google Apps Script | مجاني |
| Google Sheets | مجاني |
| Gmail (100 إيميل/يوم) | مجاني |
| GitHub Pages (استضافة HTML) | مجاني |
| Gemini API (مستوى مجاني) | مجاني |
| **المجموع** | **$0/شهر** |

### السيناريو الاحترافي (إذا نما المشروع)

| المكوّن | التكلفة |
|---------|---------|
| Google Workspace (بريد مؤسسي + 1,500 إيميل/يوم) | $6/شهر |
| Netlify Pro (استضافة HTML سريعة) | $0 (مجاني) |
| Gemini API (حجم كبير) | $0.075 لكل مليون token |
| **المجموع** | **~$6/شهر** |

---

## 11. التوصية الاحترافية النهائية

### رأيي المباشر:

**نعم — هذا النظام قابل للتنفيذ وعملي جداً** لمشاريع صغيرة ومتوسطة.

لكن هناك فارق جوهري واحد يجب أن تفهمه:

```
┌──────────────────────────────────────────────────────────────┐
│                    الفارق الجوهري                            │
│                                                              │
│  نظام SCVA                   النظام المقترح                 │
│  ───────────                  ────────────                   │
│  تطبيق ويب متكامل             أدوات Google مربوطة ببعض      │
│  قاعدة بيانات خاصة            Google Sheets = قاعدة بياناتك │
│  تحكم كامل                    تحت شروط Google               │
│  يحتاج سيرفر                  لا يحتاج سيرفر                │
│  تكلفة شهرية                  مجاني تقريباً                  │
└──────────────────────────────────────────────────────────────┘
```

### متى تختار هذا النظام؟

**✅ مثالي إذا:**
- المشروع صغير أو متوسط (أقل من 5,000 تسجيل/شهر)
- الميزانية محدودة أو معدومة
- الفريق غير تقني ويريد رؤية البيانات في Sheets مباشرة
- السرعة في التنفيذ أولوية
- لا تحتاج لوحة تحكم متكاملة

**❌ تجنّبه إذا:**
- البيانات حساسة طبياً أو قانونياً (استخدم سيرفر مخصص)
- تحتاج تحكماً كاملاً في البنية التحتية
- ترسل أكثر من 100 إيميل يومياً (ادفع $6/شهر لـ Workspace)
- المشروع مؤسسي كبير

### الخطوات التقنية الفعلية للبدء:

```
1. أنشئ Google Spreadsheet → احفظ الـ ID من الرابط
2. افتح Google Apps Script (script.google.com)
3. اكتب doPost() + writeToSheet() + sendAdminEmail()
4. انشره كـ Web App (Execute: Me | Access: Anyone)
5. انسخ URL الـ Web App
6. أنشئ HTML form مع fetch POST لهذا الـ URL
7. ارفعه على GitHub Pages (مجاناً)
8. شاركه مع عملائك
```

### خلاصة التقييم:

| المعيار | التقييم |
|---------|---------|
| **الجدوى التقنية** | ✅ ممكن تماماً |
| **التكلفة** | ✅ ممتاز (مجاني) |
| **سرعة التنفيذ** | ✅ ممتاز (2-5 أيام) |
| **الاستدامة** | ✅ جيد (طالما Google موجود) |
| **الأمان** | ⚠️ جيد لكن ليس مثالياً |
| **المرونة** | ⚠️ محدود مقارنة بسيرفر مخصص |
| **التحكم الكامل** | ❌ أنت تحت شروط Google |

**التقييم الإجمالي: 8/10 — نظام ممتاز للمشاريع الصغيرة والمتوسطة**

---

### ما أنصح ببنائه تحديداً:

```
HTML (GitHub Pages / Netlify)
    ↓ fetch POST
Google Apps Script Web App
    ├─→ Google Sheets (تسجيل البيانات)
    ├─→ Gmail (إشعار المسؤول بـ HTML جميل)
    ├─→ Gmail (تأكيد العميل بلغته)
    └─→ Gemini API (تحليل ذكي — اختياري)
```

هذا النظام يعطيك 90% من قدرات نظام SCVA الكامل بـ 10% من التعقيد التقني وبتكلفة صفر.

---

*وثيقة تقنية احترافية — تحليل جدوى مشروع Google Drive Form*
*مايو 2026*
