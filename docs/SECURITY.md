# سياسة الأمان / Security Policy

## النسخ المدعومة / Supported Versions

نقدّم تحديثات أمنية للنسخة الأحدث على فرع `main` فقط.

We provide security updates for the latest version on the `main` branch only.

| النسخة / Version | مدعومة / Supported |
|---|---|
| النسخة الأخيرة / Latest (`main`) | ✅ |
| الأقدم / Older | ❌ |

---

## 🔐 الإبلاغ عن ثغرة / Reporting a Vulnerability

إذا اكتشفتَ ثغرة أمنية، **يرجى عدم فتحها كـ GitHub Issue عام**. بدلاً من ذلك:

If you discover a security vulnerability, **please do not open a public GitHub issue**. Instead:

### الطريقة المُفضّلة / Preferred method
استخدم خاصية **Private Vulnerability Reporting** في GitHub:
1. اذهب إلى تبويب **Security** في المستودع.
2. اضغط **Report a vulnerability**.
3. املأ التفاصيل بصدق ودقّة.

### الطريقة البديلة / Alternative
أرسل بريداً إلكترونياً إلى المشرف على المشروع مع:
- وصف مفصّل للثغرة
- خطوات إعادة الإنتاج (steps to reproduce)
- التأثير المحتمل (impact)
- اقتراح إصلاح إن وُجد

---

## ⏱️ ما الذي يمكن توقّعه / What to Expect

| المرحلة | المهلة |
|---|---|
| تأكيد استلام البلاغ | خلال **48 ساعة** |
| تقييم أولي وتصنيف الخطورة | خلال **5 أيام عمل** |
| إصدار إصلاح للثغرات الحرجة | خلال **14 يوماً** |
| إفصاح عام منسَّق (CVE إن لزم) | بعد إصدار الإصلاح |

نلتزم بالتواصل الشفّاف معك في كل مرحلة.

---

## 🛡️ نطاق العمل / Scope

تنطبق هذه السياسة على:
- ✅ كود المستودع الرئيسي (`server/`, `client/`, `shared/`).
- ✅ الاعتمادات (dependencies) المباشرة.
- ✅ ملفات الـ Docker وإعدادات النشر.

**خارج النطاق:**
- ❌ ثغرات في خدمات سحابية تابعة لطرف ثالث (PostgreSQL، استضافة، n8n) — أبلغ المزوّد مباشرة.
- ❌ هجمات الهندسة الاجتماعية على المستخدمين.
- ❌ هجمات DoS التطوعية.

---

## 🔒 ممارسات الأمان المُطبَّقة / Implemented Security Practices

### المصادقة والتفويض
- جميع كلمات المرور مُجزَّأة بـ **bcrypt** (10 rounds).
- لا توجد كلمة مرور افتراضية مُضمَّنة في الكود — عند غياب `ADMIN_INITIAL_PASSWORD` تُولَّد كلمة عشوائية قوية (24 حرفاً) وتُطبع مرّة واحدة في سجلّ التشغيل.
- `mustChangePassword: true` يُجبر تغيير الكلمة عند أوّل دخول.
- جميع مسارات `/api/*` (عدا `/api/login` و `/api/user`) تتطلب جلسة مصادَقة.
- `/api/users*` والعمليات الإدارية تتطلب دور `admin`.

### كوكي الجلسة
- `httpOnly: true` — لا يمكن الوصول إليه من JavaScript.
- `sameSite: "strict"` في الإنتاج، `"lax"` في التطوير (لإبقاء معاينة Replit تعمل).
- `secure: true` في الإنتاج — HTTPS فقط.

### رؤوس أمان HTTP (Helmet)
مُطبَّق عبر `helmet()` على جميع الاستجابات:
- `Strict-Transport-Security` (HSTS)
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: SAMEORIGIN`
- `Referrer-Policy: no-referrer`
- `X-DNS-Prefetch-Control: off`
- `X-Download-Options: noopen`
- `X-Permitted-Cross-Domain-Policies: none`
- `Cross-Origin-Opener-Policy: same-origin`
- `Cross-Origin-Resource-Policy: same-origin`

*ملاحظة: CSP معطَّل في التطوير لإبقاء Vite HMR والـ runtime overlay يعملان.*

### الحماية من هجمات القوة الغاشمة
- `express-rate-limit` على `/api/login`: **10 محاولات لكل IP كل 15 دقيقة** مع رسالة عربية واضحة.
- Headers استجابة: `RateLimit-Limit`, `RateLimit-Remaining`, `RateLimit-Reset`.

### حماية CSRF
- طبقة أساسية: `sameSite: "strict"` تمنع معظم هجمات CSRF.
- طبقة إضافية (في الإنتاج): فحص `Origin`/`Referer` على جميع طلبات الكتابة `/api/*` — يرفض الطلبات ذات مصدر مختلف عن host الطلب.

### حدود حجم الطلبات
- JSON: **5MB** (`express.json({ limit: "5mb" })`).
- URL-encoded: **1MB** (`express.urlencoded({ limit: "1mb" })`).
- يحمي من هجمات استنزاف الذاكرة.

### حماية آخر مسؤول
- `DELETE /api/users/:id`: يرفض بـ **409 Conflict** حذف آخر مستخدم بدور `admin`.
- `PATCH /api/users/:id`: يرفض بـ **409 Conflict** تنزيل دور آخر `admin` إلى `employee`.
- لا اعتماد على اسم المستخدم (`"admin"`) — الفحص يعتمد على عدد المدراء في قاعدة البيانات.

### تنظيف البيانات الحساسة
- حقل `password` يُحذف من جميع استجابات API (`/api/login`, `/api/user`, قوائم المستخدمين).
- حقل `password` يُعاد كـ `"[redacted]"` في سجلّات الـ logging.

### التحقق من المدخلات
- جميع طلبات الكتابة تُتحقَّق بـ **Zod** من `@shared/schema`.
- المخطط مشترك بين الواجهة الأمامية والخادم — مصدر حقيقة واحد.

### API العام (Bearer Token)
- `POST /api/public/append-excel` مؤمَّن بـ Bearer token يُولَّد عشوائياً ويُخزَّن في `form_settings.api_key`.
- المفتاح يُحقَن تلقائياً في ملف الـ Workflow عند تحميله.

### الاعتمادات (Dependencies)
- **Dependabot** مفعَّل لمراقبة ثغرات الاعتمادات.
- **Secret Scanning** مفعَّل لمنع تسريب الأسرار في الـ commits.
- **CodeQL** مُعدَّ للفحص الاستاتيكي.

---

## 🏆 شكر وتقدير / Acknowledgements

نُقدّر المساهمين الذين يبلّغون عن ثغرات بشكل مسؤول، وسنذكرهم في قسم الشكر بعد إصلاح الثغرة (مع الإذن).

We appreciate responsible disclosure and will credit reporters in our acknowledgements (with permission) after a fix is released.
