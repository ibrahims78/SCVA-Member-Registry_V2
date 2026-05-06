<div align="center">

# نظام إدارة الأعضاء — الرابطة السورية لأمراض وجراحة القلب
### SCVA Members Management System

نظام احترافي ثنائي اللغة (عربي / إنجليزي) لإدارة قاعدة بيانات أعضاء جمعية طبية، يدعم سجلّ الاشتراكات السنوية، تصدير التقارير، إدارة الصلاحيات، وتسجيل الأعضاء الجدد ذاتياً عبر نموذج خارجي متكامل مع n8n.

A bilingual (Arabic / English) full-stack member management platform for a medical association — with annual subscription tracking, report exports, role-based access, and a self-registration form integrated with n8n automation.

[![Made with TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![Express 5](https://img.shields.io/badge/Express-5-000000?logo=express&logoColor=white)](https://expressjs.com/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-15+-4169E1?logo=postgresql&logoColor=white)](https://www.postgresql.org/)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-C5F74F?logo=drizzle&logoColor=black)](https://orm.drizzle.team/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind-v4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

---

## 📑 جدول المحتويات / Table of Contents

- [الميزات / Features](#-الميزات--features)
- [المعمارية التقنية / Tech Stack](#-المعمارية-التقنية--tech-stack)
- [بنية المشروع / Project Structure](#-بنية-المشروع--project-structure)
- [البدء السريع / Quick Start](#-البدء-السريع--quick-start)
- [متغيرات البيئة / Environment Variables](#-متغيرات-البيئة--environment-variables)
- [الأوامر المتاحة / Available Scripts](#-الأوامر-المتاحة--available-scripts)
- [قاعدة البيانات / Database](#-قاعدة-البيانات--database)
- [نظام التسجيل الخارجي / External Registration](#-نظام-التسجيل-الخارجي--external-registration)
- [الأداء / Performance](#-الأداء--performance)
- [النشر / Deployment](#-النشر--deployment)
- [الأمان / Security](#-الأمان--security)
- [المساهمة / Contributing](#-المساهمة--contributing)
- [الترخيص / License](#-الترخيص--license)

---

## ✨ الميزات / Features

| 🇸🇦 العربية | 🇬🇧 English |
|---|---|
| لوحة تحكّم تفاعلية مع إحصائيات وأنواع العضوية | Interactive dashboard with stats & charts |
| إدارة كاملة للأعضاء (إضافة / تعديل / حذف / بحث) | Full members CRUD with search & filters |
| تصفّح مع ترقيم (10/25/50/100 سجل في الصفحة) | Pagination (10/25/50/100 rows per page) |
| سجلّ اشتراكات سنوي قابل للإضافة والتعديل والحذف | Annual subscription log (add/edit/delete) |
| استيراد جماعي ذكي من Excel مع وضع التحديث | Smart Excel bulk import with update mode |
| تصدير إلى Excel و Word و PDF بدعم كامل للعربية | Excel / Word / PDF export with Arabic shaping |
| دعم RTL كامل وثنائي اللغة (عربي / إنجليزي) | Full RTL & i18n support (AR / EN) |
| المظهر الفاتح والداكن (Light / Dark) | Light & Dark mode |
| مصادقة آمنة بالـ Sessions + bcrypt | Secure Session-based auth + bcrypt |
| صلاحيات بدور: مسؤول / موظف | Role-based access: admin / employee |
| إجبار تغيير كلمة مرور المسؤول عند أوّل دخول | Forced password change on first admin login |
| كلمة مرور أوّلية عشوائية قوية (24 حرفاً) | Strong random initial password (24 chars) |
| حماية "آخر مسؤول" من الحذف والتنزيل | Last-admin protection (delete & demote) |
| نموذج تسجيل خارجي مستقل مع rمز دعوة | Standalone external registration form with invite code |
| تكامل n8n لأتمتة معالجة التسجيلات | n8n workflow integration for registration automation |
| دعم الذكاء الاصطناعي (Gemini / OpenAI) | AI analysis support (Gemini / OpenAI) |
| نسخ احتياطي شامل بضغطة واحدة | One-click full data backup (JSON) |
| API عام مؤمَّن بـ Bearer token لاستيراد البيانات | Public API secured with Bearer token for data ingestion |

---

## 🧱 المعمارية التقنية / Tech Stack

### Frontend
- **React 19** + **TypeScript** + **Vite**
- **Wouter** للتوجيه (lightweight router)
- **shadcn/ui** على Radix UI primitives
- **Tailwind CSS v4** + متغيرات CSS + الوضع الداكن
- **TanStack Query v5** لإدارة حالة الخادم (`staleTime: 30s`)
- **React Hook Form** + **Zod** للتحقق من النماذج (مخطط مشترك مع الخادم)
- **Recharts** للرسوم البيانية، **xlsx** و **docx** للتصدير

### Backend
- **Express 5** + **TypeScript**
- **Passport (Local Strategy)** + **bcryptjs** للمصادقة
- **connect-pg-simple** لتخزين الجلسات في PostgreSQL
- **Drizzle ORM** + **node-postgres** للوصول لقاعدة البيانات
- **Zod** للتحقق من جميع طلبات الكتابة
- **Helmet** لرؤوس أمان HTTP
- **express-rate-limit** للحماية من هجمات القوة الغاشمة
- **Puppeteer / Chromium** لتوليد ملفات PDF (اختياري)

### Database
- **PostgreSQL 15+**
- جداول: `users`, `members`, `subscriptions`, `form_settings`, `session`

---

## 📁 بنية المشروع / Project Structure

```
.
├── client/                  # تطبيق الواجهة الأمامية React
│   ├── src/
│   │   ├── pages/           # صفحات التطبيق (Members, Home, Settings, ...)
│   │   ├── components/ui/   # مكونات shadcn/ui
│   │   ├── context/         # MembersContext, LanguageContext, ...
│   │   ├── hooks/           # use-toast, ...
│   │   └── lib/             # queryClient, utils, ...
│   └── index.html
│
├── server/                  # واجهة Express الخلفية
│   ├── index.ts             # نقطة الدخول + إعداد Helmet + body limits + CSRF guard
│   ├── routes.ts            # جميع مسارات الـ API
│   ├── storage.ts           # طبقة الوصول للبيانات (IStorage / DatabaseStorage)
│   ├── auth.ts              # إعداد Passport + rate-limit على /api/login
│   ├── seed.ts              # سكربت التحقق من وجود admin + ملخص DB
│   └── vite.ts              # تهيئة Vite في وضع التطوير
│
├── shared/
│   └── schema.ts            # مخطط Drizzle + Zod (مشترك بين العميل والخادم)
│
├── script/
│   ├── build.ts             # سكربت البناء للإنتاج
│   └── reset-admin-password.ts  # إعادة تعيين كلمة المرور يدوياً
│
├── docs/                    # توثيق شامل (CHANGELOG, SECURITY, CODE_REVIEW, ...)
│   └── form_by_n8n/         # نموذج التسجيل الخارجي + ملف workflow
├── drizzle.config.ts
├── vite.config.ts
├── tsconfig.json
├── package.json
└── README.md
```

---

## 🚀 البدء السريع / Quick Start

### المتطلبات / Prerequisites
- **Node.js 20+**
- **PostgreSQL 15+** (محلي أو Cloud — Neon / Supabase / Railway)
- **Chromium** (اختياري، فقط لتصدير PDF من جانب الخادم)

### 1) استنساخ المستودع / Clone

```bash
git clone https://github.com/<your-username>/scva-members.git
cd scva-members
```

### 2) تثبيت الاعتمادات / Install dependencies

```bash
npm install
```

### 3) إعداد متغيرات البيئة / Configure env

```bash
cp .env.example .env
# عدّل القيم في ملف .env بما يناسب بيئتك
```

### 4) إنشاء جداول قاعدة البيانات / Push DB schema

```bash
npm run db:push
```

### 5) تشغيل بيئة التطوير / Run dev server

```bash
npm run dev
```

افتح المتصفّح على: **http://localhost:5000**

> 🔐 **أوّل تشغيل:** يُنشأ حساب `admin` تلقائياً. إن لم يُضبط `ADMIN_INITIAL_PASSWORD`، تُطبع كلمة مرور عشوائية قوية (24 حرفاً) مرّة واحدة في سجلّ التشغيل. سيُطلب تغييرها فور تسجيل الدخول.
>
> 🔑 **نسيت كلمة المرور؟** استخدم `npx tsx script/reset-admin-password.ts` — راجع [`docs/ADMIN_PASSWORD_RESET.md`](docs/ADMIN_PASSWORD_RESET.md).

---

## 🔐 متغيرات البيئة / Environment Variables

| المتغيّر / Variable | إلزامي / Required | الوصف / Description |
|---|---|---|
| `DATABASE_URL` | ✅ Always | سلسلة اتصال PostgreSQL |
| `SESSION_SECRET` | ✅ Production | مفتاح توقيع جلسات الكوكيز (32+ بايت عشوائياً) |
| `ADMIN_INITIAL_PASSWORD` | ⚠️ First boot | كلمة مرور المسؤول الافتراضي (≥ 8 أحرف) — تُستخدم مرّة واحدة. إن غابت، تُولَّد كلمة عشوائية وتُطبع في سجلّ التشغيل. |
| `CHROME_PATH` | ⛔ Optional | مسار Chromium لتصدير PDF (افتراضي: `/usr/bin/chromium`). بدونه يُرجع endpoint الـ PDF `503` مع رسالة عربية. |
| `PORT` | ⛔ Optional | منفذ الخادم (افتراضي: `5000`) |
| `NODE_ENV` | ⛔ Optional | `development` أو `production` — يؤثر على أمان الكوكيز وحماية CSRF |

> 💡 لتوليد `SESSION_SECRET` آمن:
> ```bash
> node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
> ```

---

## 📜 الأوامر المتاحة / Available Scripts

| الأمر / Script | الوظيفة / Purpose |
|---|---|
| `npm run dev` | تشغيل خادم التطوير (Express + Vite middleware) على المنفذ 5000 |
| `npm run build` | بناء حزمة الإنتاج إلى `dist/` |
| `npm start` | تشغيل تطبيق الإنتاج بعد البناء (`node dist/index.cjs`) |
| `npm run check` | فحص أنواع TypeScript |
| `npm run db:push` | مزامنة مخطط Drizzle مع PostgreSQL |
| `npm run seed` | التحقق من وجود admin وعرض ملخص قاعدة البيانات |

---

## 🗄️ قاعدة البيانات / Database

النظام يستخدم **Drizzle ORM**. جميع تعديلات المخطط تتم في `shared/schema.ts` ثم تُطبَّق بـ:

```bash
npm run db:push
```

### الجداول الرئيسية

| الجدول | الغرض |
|---|---|
| `users` | مستخدمو النظام (admin / employee) |
| `members` | بيانات الأعضاء (الاسم، الاختصاص، نوع العضوية، ...) |
| `subscriptions` | سجلّ الاشتراكات السنوية لكل عضو |
| `form_settings` | إعدادات نموذج التسجيل الخارجي (رمز الدعوة، webhook، API key، إعدادات AI) |
| `session` | جلسات Express (تُنشأ تلقائياً بواسطة connect-pg-simple) |

### استيراد جماعي من Excel
يدعم النظام رفع ملفات `.xlsx` للأعضاء والاشتراكات من صفحة الإعدادات، مع وضع **«تحديث القيود الموجودة»** لمنع التكرار وتطبيق التغييرات بأمان.

---

## 📋 نظام التسجيل الخارجي / External Registration

يتيح النظام للأعضاء الجدد تسجيل أنفسهم ذاتياً دون الحاجة لحساب في النظام.

### المكونات
| المكوّن | الوصف |
|---|---|
| `/form` | نموذج HTML مستقل رباعي الخطوات (تحقق → بيانات → تواصل → مراجعة) |
| `POST /api/public/append-excel` | يستقبل بيانات العضو من n8n ويضيفها لملف Excel المناسب (مؤمَّن بـ Bearer token) |
| `GET /api/admin/excel-download` | تحميل ملف Excel المحدَّث (`?lang=ar` أو `?lang=en`) |
| `GET /api/public/verify-code` | التحقق من رمز الدعوة |
| `GET /api/public/form-config` | يُرجع webhook URL للنموذج |
| `GET/PUT /api/form-settings` | إدارة الإعدادات (للمدراء فقط) |

### ميزات النموذج
- 4 خطوات: التحقق من رمز الدعوة ← البيانات الأساسية ← التواصل والمهنة ← المراجعة والإرسال
- ثنائي اللغة (عربي RTL / إنجليزي LTR) مع تبديل فوري
- الوضع الداكن / الفاتح مع حفظ في localStorage
- تحقق فوري من كل حقل مع أيقونات ✅/❌
- حفظ تلقائي كل 30 ثانية + استعادة عند الرجوع
- قفل 3 محاولات خاطئة للرمز (5 دقائق مع عداد تنازلي)
- صفحة تأكيد مع ملخص كامل + دعم الطباعة

### إعداد التكامل مع n8n (مرّة واحدة)
1. حدّد رمز الدعوة، بريد الإشعارات، ورابط webhook في صفحة الإعدادات
2. (اختياري) أضف مفتاح API لـ Gemini أو OpenAI لتحليل التسجيلات بالذكاء الاصطناعي
3. حمّل ملف `scva-member-workflow.json` وافتحه في n8n — جميع الإعدادات تُحقَن تلقائياً
4. شارك رابط `/form` + رمز الدعوة مع الأعضاء الجدد

> 📖 للتوثيق الكامل: [`docs/form_by_n8n/دراسة-نموذج-تسجيل-الأعضاء.md`](docs/form_by_n8n/دراسة-نموذج-تسجيل-الأعضاء.md)

---

## ⚡ الأداء / Performance

- **استعلام واحد** لجلب اشتراكات أعضاء متعددين (`getSubscriptionsByMemberIds`) بدلاً من N+1 — يُقدَّر بتحسّن ~7.7× على 99 عضواً ويزداد مع البيانات الأكبر.
- **TanStack Query `staleTime: 30s`** — البيانات تُحدَّث تلقائياً كل 30 ثانية بدل الإبقاء قديمة إلى ما لا نهاية.
- **استعلام واحد للإحصاءات** في `/api/members` و `/api/backup` و `/api/subscriptions/import` لتجنّب أنماط N+1.

---

## 🚢 النشر / Deployment

### الخيار 1: Replit Deployments (موصى به)
المشروع مُهيّأ مسبقاً لنشر **Autoscale**:
- Build: `npm run build`
- Run: `node ./dist/index.cjs`
- Port: `5000`

### الخيار 2: Docker
```bash
docker compose up --build
```
> ⚠️ **قبل الدفع للمستودع**: راجع `docker-compose.yml` وأزل أي توكنات / أسرار مكشوفة، وانقلها إلى ملف `.env` غير مُتعقَّب.

### الخيار 3: VPS تقليدي
```bash
npm install --production=false
npm run build
NODE_ENV=production npm start
```
استخدم **PM2** أو **systemd** لإبقاء العملية حيّة، وضع **Nginx** كـ reverse proxy أمامها.

### الخيار 4: منصّات سحابيّة
متوافق مع: **Railway**، **Render**، **Fly.io**، **Vercel** (للواجهة الأمامية فقط مع backend منفصل).

---

## 🛡️ الأمان / Security

| الإجراء | التفاصيل |
|---|---|
| ✅ المصادقة | جميع مسارات `/api/*` (عدا `/api/login`) تتطلب جلسة مصادَقة |
| ✅ التحكم بالصلاحيات | `/api/users*` والعمليات الإدارية تتطلب دور `admin` |
| ✅ bcrypt | كلمات المرور مُجزَّأة بـ 10 rounds |
| ✅ كوكي الجلسة | `httpOnly`, `sameSite: strict` (إنتاج) / `lax` (تطوير), `secure` في الإنتاج |
| ✅ Helmet | 9 رؤوس أمان HTTP: HSTS, X-Content-Type-Options, X-Frame-Options, Referrer-Policy, ... |
| ✅ Rate Limiting | `/api/login`: 10 محاولات لكل IP كل 15 دقيقة |
| ✅ CSRF Guard | فحص `Origin`/`Referer` على جميع مسارات الكتابة في الإنتاج |
| ✅ Body Size Limits | 5MB لـ JSON، 1MB لـ urlencoded |
| ✅ حماية آخر مسؤول | الخادم يرفض (409) حذف أو تنزيل آخر مسؤول |
| ✅ كلمة مرور عشوائية | لا توجد كلمة مرور افتراضية مُضمَّنة في الكود |
| ✅ تنظيف السجلات | حقل `password` يُحذف من جميع استجابات API والـ logs |
| ✅ Zod | تحقق على جميع طلبات الكتابة (مخطط مشترك بين الواجهة والخادم) |
| ✅ Bearer Token | `/api/public/append-excel` مؤمَّن بمفتاح API عشوائي |

> إذا اكتشفت ثغرة أمنية، يرجى عدم فتح Issue عام — راجع [`docs/SECURITY.md`](docs/SECURITY.md).

---

## 🤝 المساهمة / Contributing

نرحّب بالمساهمات! راجع [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) للتفاصيل الكاملة.

الخطوات السريعة:

1. اعمل **Fork** للمستودع.
2. أنشئ فرعاً جديداً: `git checkout -b feat/my-feature`.
3. التزم بالتغييرات: `git commit -m "feat: add my feature"` (نتّبع [Conventional Commits](https://www.conventionalcommits.org/)).
4. ادفع الفرع: `git push origin feat/my-feature`.
5. افتح **Pull Request** مع وصف واضح للتغييرات.

### معايير الكود
- TypeScript strict mode — تجنّب `any`
- جميع طلبات البيانات عبر TanStack Query
- جميع مسارات الخادم الجديدة تمرّ بـ `requireAuth`
- جميع النصوص في كلا اللغتين (`isAr ? "..." : "..."`)
- التأكد من نجاح `npm run check` قبل الدفع

---

## 📄 الترخيص / License

هذا المشروع مرخّص بموجب **MIT License** — راجع ملف [LICENSE](LICENSE) للتفاصيل.

This project is licensed under the **MIT License** — see the [LICENSE](LICENSE) file for details.

---

<div align="center">

صُنع بعناية للرابطة السورية لأمراض وجراحة القلب 🫀<br>
Built with care for the Syrian Cardiovascular Association

</div>
