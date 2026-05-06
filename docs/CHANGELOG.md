# سجل التغييرات — SCVA Members System

جميع التغييرات الجوهرية في هذا المشروع موثّقة هنا.  
يتّبع هذا الملف مبدأ [Keep a Changelog](https://keepachangelog.com/) ومعايير [Semantic Versioning](https://semver.org/).

---

## [2.5.0] — 2026-05-01 — تكامل الذكاء الاصطناعي

### مُضاف
- حقلان `aiProvider` و `aiApiKey` في جدول `form_settings` — يخزّنان مزوّد AI والمفتاح.
- Endpoint جديد `POST /api/admin/test-ai` — يختبر صلاحية مفتاح API لـ OpenAI أو Gemini قبل الحفظ.
- عند تحميل ملف الـ Workflow، يُحقَن مفتاح AI ومزوّده تلقائياً في عقدة `Build AI Prompt`.
- دعم مزدوج في الـ Workflow: OpenAI (gpt-4o-mini) وGoogle Gemini (gemini-2.5-flash) بنفس الكود.
- بطاقة جديدة "إعدادات الذكاء الاصطناعي" في صفحة الإعدادات: اختيار المزوّد، إدخال المفتاح، زر الاختبار، زر الحفظ.
- عقدة AI في الـ Workflow تستخدم placeholders (`__SCVA_AI_PROVIDER__`, `__SCVA_AI_KEY__`) تُستبدَل عند التحميل.

### معدَّل
- ملف `scva-member-workflow.json` رُفع إلى v6.1.0 مع دعم كامل لكلا المزوّدَين.

---

## [2.0.0] — 2026-04-30 — تكامل n8n عبر HTTP API

### مُضاف
- Endpoint جديد `POST /api/public/append-excel` — يستقبل بيانات عضو ويضيفها لملف Excel المناسب (مؤمَّن بـ Bearer token).
- Endpoint جديد `GET /api/admin/excel-download?lang=ar|en` — يحمّل ملف Excel المحدَّث (للمدراء فقط).
- مفتاح API يُولَّد تلقائياً عند أول تشغيل ويُخزَّن في `form_settings.api_key`.
- يُضمَّن مفتاح API في ملف Workflow عند تحميله من صفحة الإعدادات.
- ملف Workflow النهائي `scva-member-workflow.json` (14 عقدة) يدعم التحقق من الرمز + تنسيق البيانات + AI + كتابة Excel + إشعار بريدي.
- صفحة الإعدادات: عرض مفتاح API + أزرار تحميل ملفات Excel من الخادم مباشرة.

### معدَّل
- استُبدلت عقد Read/Write File في n8n بعقدة HTTP Request واحدة تستدعي `/api/public/append-excel`.
- جدول `form_settings` موسَّع بحقول: `api_key`, `webhookUrl`, `notificationEmail`, `verificationCode`.

---

## [1.3.0] — 2026-04-29 — تحسينات الأداء وجودة الكود

### مُضاف
- `IStorage.getSubscriptionsByMemberIds(ids)` — استعلام `IN (...)` واحد بدلاً من N+1. يستخدمه `/api/members`, `/api/backup`, `/api/subscriptions/import`. قياس: ~7.7× تحسّن على 99 عضواً.

### معدَّل
- `client/src/lib/queryClient.ts`: `staleTime` من `Infinity` إلى `30 * 1000` (30 ثانية) على مستوى التطبيق — يُحدّث البيانات تلقائياً بعد 30 ثانية مع الاستفادة من الـ cache أثناء التنقّل.
- إصلاح 8 أخطاء TypeScript بإضافة فحوص دفاعية (`?? ""`, `?? "—"`) على الحقول الاختيارية التي قد تكون `null`:
  - `Home.tsx:133` — فهرسة بـ `m.specialty ?? "unknown"`.
  - `MemberDetails.tsx:283-284` — `(ar ?? "")` و `(en ?? "")` في `new Paragraph`.
  - `Members.tsx:69-73` — `(member.fullName ?? "").toLowerCase()` وما شابهها.
- `client/src/pages/AddMember.tsx`: ربط النموذج بـ `insertMemberSchema` من `@shared/schema` بدلاً من تعريف Zod محلي مكرر.

---

## [1.2.0] — 2026-04-29 — تصلّب الأمان الشامل

### مُضاف
- **Helmet**: 9 رؤوس أمان HTTP على جميع الاستجابات (HSTS, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, ...). CSP معطَّل في التطوير لإبقاء Vite HMR يعمل.
- **Rate Limiting**: `/api/login` مقيَّد بـ 10 محاولات لكل IP كل 15 دقيقة مع رسالة عربية واضحة.
- **CSRF Guard**: فحص `Origin`/`Referer` على جميع مسارات الكتابة `/api/*` في الإنتاج (يعفي `GET/HEAD/OPTIONS` و `/api/login`).
- **Body Size Limits**: 5MB لـ JSON, 1MB لـ `urlencoded` في `express.json` و `express.urlencoded`.
- **حماية آخر مسؤول**:
  - `DELETE /api/users/:id`: يرفض (409) حذف آخر مستخدم بدور `admin`.
  - `PATCH /api/users/:id`: يرفض (409) تنزيل دور آخر `admin` إلى `employee`.
  - واجهة Settings تُعطّل زرّ الحذف على آخر مسؤول وعلى المستخدم الحالي نفسه مع tooltip عربي.
  - `IStorage.countAdmins()` و `countOtherAdmins(excludingId)` مُضافتان.
- **كلمة مرور أوّلية عشوائية**:
  - حُذفت السلسلة الحرفية `"12345678"` من الكود نهائياً.
  - إن غاب `ADMIN_INITIAL_PASSWORD`: تُولَّد كلمة 24 حرفاً بـ `crypto.randomBytes` وتُطبع مرّة واحدة في إطار مميّز على `stderr`.
  - `mustChangePassword: true` يُجبر تغيير الكلمة عند أوّل دخول.
- **كوكي الجلسة**: `sameSite: "strict"` في الإنتاج, `"lax"` في التطوير.
- **PDF endpoint**: رسالة `503` ثنائية اللغة عند غياب Chromium بدلاً من `500` مبهمة.
- **PDF proxy fix**: استُبدل `page.setCookie({domain:"localhost"})` بـ `page.setExtraHTTPHeaders({Cookie: req.headers.cookie})` ليعمل خلف أي Proxy/HTTPS.
- سكربت `script/reset-admin-password.ts` لإعادة تعيين كلمة مرور أي مستخدم يدوياً من Shell.

### معدَّل
- `server/auth.ts`: إضافة `loginLimiter` على مسار `/api/login`.
- `server/index.ts`: ترتيب middleware بشكل صحيح (Helmet → Body Parsers → CSRF Guard → Routes).

---

## [1.1.0] — 2026-04-28 — استيراد Excel والنسخ الاحتياطي

### مُضاف
- Endpoint `POST /api/members/import` — استيراد جماعي للأعضاء من JSON مُحوَّل من Excel مع تقرير تفصيلي (نجاحات / إخفاقات / رسائل خطأ).
- Endpoint `GET /api/backup` (admin فقط) — تصدير نسخة احتياطية كاملة (أعضاء + اشتراكات + مستخدمون بدون كلمات مرور) بصيغة JSON موقّت بالتاريخ.
- صفحة الإعدادات: قسم "استيراد بيانات الأعضاء" (تحميل نموذج Excel + رفع ملف + عرض نتائج الاستيراد).
- صفحة الإعدادات: قسم "النسخ الاحتياطي" مع زر التصدير الفوري.
- قسم "استيراد الاشتراكات السنوية" مع وضع التحديث (update mode).
- إعادة تنظيم صفحة الإعدادات إلى أقسام واضحة بـ `Card` مع `Badge` لأدوار المستخدمين.

### معدَّل
- `shared/schema.ts`: جميع حقول `members` باستثناء `firstName` و `lastName` أصبحت اختيارية (`nullable()`).
- `client/src/pages/AddMember.tsx`: النموذج يقبل الحدّ الأدنى (الاسم الأول + الكنية) وباقي الحقول اختيارية.

---

## [1.0.0] — 2026-04-27 — الإصدار الأوّلي

### مُضاف
- نظام إدارة أعضاء كامل: إضافة / تعديل / حذف / بحث / ترقيم.
- لوحة تحكم تفاعلية مع إحصائيات ورسوم بيانية (Recharts).
- سجلّ اشتراكات سنوي لكل عضو.
- تصدير إلى Excel (xlsx) و Word (docx) مع دعم كامل للعربية.
- تصدير PDF من جانب الخادم عبر Puppeteer/Chromium.
- دعم RTL كامل وثنائي اللغة (عربي / إنجليزي) مع TanStack Query.
- مصادقة قائمة على الجلسات (Passport + bcrypt + connect-pg-simple).
- صلاحيات بدور: admin / employee.
- الوضع الفاتح / الداكن.
- نظام تسجيل الأعضاء الخارجي عبر n8n (نموذج HTML مستقل رباعي الخطوات).
- نظام التحقق برمز الدعوة مع قفل 3 محاولات.
- جدول `form_settings` في PostgreSQL لإعدادات النموذج.
- مسارات `/api/public/*` العامة للنموذج.
- واجهة إعدادات شاملة: إدارة المستخدمين + إعدادات النموذج + استيراد/تصدير.
