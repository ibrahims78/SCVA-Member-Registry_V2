import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { insertUserSchema, insertFormSettingsSchema, type User, type FormSettings } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/context/LanguageContext";
import {
  Loader2, UserPlus, Pencil, Trash2, ShieldCheck,
  FileSpreadsheet, Download, Upload, DatabaseBackup,
  CheckCircle2, AlertCircle, X, Receipt,
  Link2, Mail, KeyRound, Eye, EyeOff, Copy, ClipboardCheck, Workflow, Sparkles, Send,
} from "lucide-react";
import { MEMBER_COLUMNS, SUBSCRIPTION_COLUMNS, buildHeaderIndex } from "@/lib/importColumns";
import { useState, useRef, useEffect } from "react";
import { z } from "zod";
import * as XLSX from "xlsx";

function buildUserSchema(isAr: boolean) {
  return insertUserSchema.extend({
    password: z
      .string()
      .min(
        6,
        isAr
          ? "كلمة المرور يجب أن تكون 6 أحرف على الأقل"
          : "Password must be at least 6 characters",
      )
      .optional()
      .or(z.literal("")),
    role: z.enum(["admin", "employee"]),
  });
}
type UserFormValues = z.infer<ReturnType<typeof buildUserSchema>>;

// IMPORT_COLUMNS and SUB_IMPORT_COLUMNS are now in @/lib/importColumns (shared with export)
// Alias them locally for backward-compat with the rest of this file.
const IMPORT_COLUMNS = MEMBER_COLUMNS;
const SUB_IMPORT_COLUMNS = SUBSCRIPTION_COLUMNS;

interface ImportResult {
  success: number;
  failed: number;
  skipped?: number;
  updated?: number;
  errors: string[];
}

export default function Settings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { language } = useLanguage();
  const isAr = language === "ar";

  // ---- Localised UI strings ----
  const L = {
    title:        isAr ? "إعدادات النظام" : "System settings",
    subtitle:     isAr ? "إعداد التكاملات، إدارة البيانات والمستخدمين، والنسخ الاحتياطي." : "Configure integrations, manage data and users, and handle backups.",
    success:      isAr ? "تم النجاح" : "Success",
    error:        isAr ? "خطأ" : "Error",
    // Users
    usersTitle:   isAr ? "إدارة المستخدمين" : "User management",
    usersDesc:    isAr ? "إضافة وتعديل وحذف حسابات النظام." : "Add, edit, or remove system accounts.",
    addUser:      isAr ? "إضافة مستخدم" : "Add user",
    username:     isAr ? "اسم المستخدم" : "Username",
    role:         isAr ? "الدور" : "Role",
    actions:      isAr ? "الإجراءات" : "Actions",
    admin:        isAr ? "مدير" : "Admin",
    employee:     isAr ? "موظف" : "Employee",
    cantDelSelf:  isAr ? "لا يمكنك حذف حسابك الخاصّ" : "You cannot delete your own account",
    cantDelLast:  isAr ? "لا يمكن حذف آخر مدير في النظام" : "You cannot delete the last admin",
    delUser:      isAr ? "حذف المستخدم" : "Delete user",
    confirmDel:   isAr ? "هل أنت متأكد من حذف هذا المستخدم؟" : "Are you sure you want to delete this user?",
    addUserOk:    isAr ? "تم إضافة المستخدم بنجاح" : "User added successfully",
    updUserOk:    isAr ? "تم تحديث بيانات المستخدم" : "User updated",
    delUserOk:    isAr ? "تم حذف المستخدم" : "User deleted",
    editUser:     isAr ? "تعديل مستخدم" : "Edit user",
    addUserNew:   isAr ? "إضافة مستخدم جديد" : "Add new user",
    pwd:          isAr ? "كلمة المرور" : "Password",
    pwdEdit:      isAr ? "كلمة مرور جديدة (اتركها فارغة لعدم التغيير)" : "New password (leave blank to keep current)",
    pickRole:     isAr ? "اختر الدور" : "Select role",
    save:         isAr ? "تحديث" : "Update",
    add:          isAr ? "إضافة" : "Add",
    // Imports
    impMembers:   isAr ? "استيراد بيانات الأعضاء" : "Import members",
    impMembersD:  isAr ? "رفع ملف Excel يحتوي على بيانات الأعضاء لإضافتهم دفعةً واحدة." : "Upload an Excel file with member data to add them in bulk.",
    steps:        isAr ? "الخطوات:" : "Steps:",
    step1:        isAr ? "حمّل نموذج Excel الرسمي بالضغط على الزر أدناه." : "Download the official Excel template using the button below.",
    step2:        isAr ? "أدخل بيانات الأعضاء في الملف (الاسم الأول والكنية إلزاميان، باقي الحقول اختيارية)." : "Fill in the member data (first and last name are required, the rest are optional).",
    step3:        isAr ? "ارفع الملف المعبّأ لبدء الاستيراد التلقائي." : "Upload the completed file to start the automatic import.",
    dlTemplate:   isAr ? "تحميل نموذج Excel" : "Download Excel template",
    importing:    isAr ? "جارٍ الاستيراد..." : "Importing...",
    uploadFile:   isAr ? "رفع ملف الاستيراد" : "Upload import file",
    updExisting:  isAr ? "تحديث بيانات الأعضاء الموجودين" : "Update existing members",
    updExHelp:    isAr ? "عند تفعيله، يُحدِّث بيانات أي عضو يتطابق اسمه (الأول + الكنية) بدلاً من تجاهله." : "When enabled, updates any member whose name (first + last) matches instead of skipping it.",
    importRes:    isAr ? "نتائج الاستيراد" : "Import results",
    succeeded:    isAr ? "تمّ بنجاح:" : "Succeeded:",
    failed:       isAr ? "فشل:" : "Failed:",
    updated:      isAr ? "تمّ التحديث:" : "Updated:",
    skipped:      isAr ? "تمّ تجاهل (موجود مسبقاً):" : "Skipped (already exists):",
    emptyFile:    isAr ? "الملف فارغ" : "Empty file",
    noData:       isAr ? "لا توجد بيانات في الملف." : "No data found in the file.",
    readErr:      isAr ? "خطأ في قراءة الملف" : "Failed to read file",
    importDone:   isAr ? "اكتمل الاستيراد" : "Import complete",
    addedN:       isAr ? "أُضيف" : "Added",
    updatedN:     isAr ? "حُدِّث" : "Updated",
    failedN:      isAr ? "فشل" : "Failed",
    sep:          isAr ? "، " : ", ",
    tplDl:        isAr ? "تم تحميل النموذج" : "Template downloaded",
    tplDlD:       isAr ? "يمكنك الآن ملء البيانات واستيرادها." : "You can now fill in the data and import it.",
    // Subscriptions import
    impSubs:      isAr ? "استيراد الاشتراكات السنوية" : "Import annual subscriptions",
    impSubsD:     isAr ? "رفع ملف Excel يحتوي على اشتراكات الأعضاء وربطها تلقائياً بسجلاتهم." : "Upload an Excel file with member payments to link them to their records.",
    matchTitle:   isAr ? "طريقة المطابقة مع الأعضاء:" : "Matching method:",
    matchById:    isAr ? "الأدق والأسرع (موصى به)" : "Most accurate and fastest (recommended)",
    matchByName:  isAr ? "بديل تلقائي" : "Automatic fallback",
    membershipNo: isAr ? "رقم العضوية" : "Membership number",
    nameCombo:    isAr ? "الاسم الأول + الكنية" : "First name + last name",
    requiredCols: isAr ? "الحقول المطلوبة في الملف:" : "Required fields in the file:",
    fNoOrName:    isAr ? "رقم العضوية أو الاسم" : "Membership number or name",
    fNoOrNameD:   isAr ? "للمطابقة" : "for matching",
    fYear:        isAr ? "سنة الاشتراك" : "Subscription year",
    fYearD:       isAr ? "مثل 2024" : "e.g. 2024",
    fAmount:      isAr ? "المبلغ" : "Amount",
    fAmountD:     isAr ? "رقم صحيح" : "integer",
    fDate:        isAr ? "تاريخ الدفع" : "Payment date",
    fDateD:       "YYYY-MM-DD",
    dlSubTpl:     isAr ? "تحميل نموذج الاشتراكات" : "Download subscriptions template",
    uploadSub:    isAr ? "رفع ملف الاشتراكات" : "Upload subscriptions file",
    updSubExist:  isAr ? "تحديث الاشتراكات الموجودة" : "Update existing subscriptions",
    updSubHelp:   isAr ? "عند تفعيله، يُحدِّث المبلغ والتاريخ والملاحظات لأي اشتراك موجود لنفس العضو ونفس السنة بدلاً من تجاهله." : "When enabled, updates amount, date and notes for any existing payment for the same member and year instead of skipping.",
    subResults:   isAr ? "نتائج استيراد الاشتراكات" : "Subscriptions import results",
    subTplDl:     isAr ? "تم تحميل نموذج الاشتراكات" : "Subscriptions template downloaded",
    subImpDone:   isAr ? "اكتمل استيراد الاشتراكات" : "Subscriptions import complete",
    // Subscriptions export
    expSubs:      isAr ? "تصدير الاشتراكات" : "Export subscriptions",
    expSubsD:     isAr ? "تصدير جميع اشتراكات الأعضاء في ملف Excel قابل لإعادة الاستيراد." : "Export all member subscriptions to an Excel file that can be re-imported.",
    expSubsBtn:   isAr ? "تصدير Excel للاشتراكات" : "Export subscriptions Excel",
    expSubsOk:    isAr ? "تم تصدير الاشتراكات" : "Subscriptions exported",
    expSubsOkD:   isAr ? "تم تحميل ملف الاشتراكات بنجاح." : "Subscriptions file downloaded successfully.",
    expSubsErr:   isAr ? "خطأ في تصدير الاشتراكات" : "Subscriptions export failed",
    expSubsEmpty: isAr ? "لا توجد اشتراكات للتصدير" : "No subscriptions to export",
    expMembers:   isAr ? "تصدير الأعضاء" : "Export members",
    expMembersD:  isAr ? "تصدير قائمة الأعضاء في ملف Excel قابل لإعادة الاستيراد." : "Export the members list to an Excel file that can be re-imported.",
    expMembersBtn:isAr ? "تصدير Excel للأعضاء" : "Export members Excel",
    expMembersOk: isAr ? "تم تصدير الأعضاء" : "Members exported",
    expMembersOkD:isAr ? "تم تحميل ملف الأعضاء بنجاح." : "Members file downloaded successfully.",
    expMembersErr:isAr ? "خطأ في التصدير" : "Export failed",
    exporting:    isAr ? "جارٍ التصدير..." : "Exporting...",
    // Workflow download
    dlWorkflow:       isAr ? "تحميل ملف Workflow لـ n8n" : "Download n8n Workflow",
    dlWorkflowD:      isAr ? "حمّل ملف الـ Workflow الجاهز — رمز التحقق والبريد ومسارات ملفات Excel كلها مُدمجة تلقائياً." : "Download the ready-to-import workflow file — verification code, email, and Excel paths are all pre-filled automatically.",
    dlWorkflowBtn:    isAr ? "تحميل Workflow" : "Download Workflow",
    dlWorkflowOk:     isAr ? "تم تحميل ملف Workflow" : "Workflow downloaded",
    dlWorkflowOkD:    isAr ? "استورد الملف في n8n عبر: Settings › Import Workflow." : "Import the file in n8n via: Settings › Import Workflow.",
    dlWorkflowErr:    isAr ? "خطأ في تحميل Workflow" : "Workflow download failed",
    dlWorkflowNoSettings: isAr
      ? "يجب حفظ الإعدادات (البريد الإلكتروني ورابط Webhook) قبل تحميل ملف Workflow."
      : "Please save your settings (notification email and webhook URL) before downloading the workflow.",
    // Form URL
    formUrlTitle: isAr ? "رابط نموذج التسجيل" : "Registration Form URL",
    formUrlDesc:  isAr ? "شارك هذا الرابط مع الأعضاء الراغبين في التسجيل." : "Share this link with members who want to register.",
    formUrlCopied:isAr ? "تم نسخ الرابط" : "Link copied",
    formUrlOpen:  isAr ? "فتح النموذج" : "Open form",
    // Backup
    backupTitle:  isAr ? "النسخ الاحتياطي" : "Backup",
    backupDesc:   isAr ? "تصدير نسخة احتياطية كاملة لجميع بيانات النظام (الأعضاء، الاشتراكات، المستخدمين)." : "Export a full backup of all system data (members, subscriptions, users).",
    backupIncl:   isAr ? "تشمل النسخة الاحتياطية:" : "The backup includes:",
    backupAllM:   isAr ? "بيانات جميع الأعضاء" : "All member data",
    backupAllS:   isAr ? "سجلّات الاشتراكات السنوية" : "Annual subscription records",
    backupUsers:  isAr ? "قائمة المستخدمين (بدون كلمات المرور)" : "User list (without passwords)",
    backupNote:   isAr ? "يُحفظ الملف بصيغة JSON ويمكن الاستفادة منه للأرشفة أو استعادة البيانات مستقبلاً." : "The file is saved as JSON and can be used for archiving or future restore.",
    exportBackup: isAr ? "تصدير نسخة احتياطية" : "Export backup",
    exportOk:     isAr ? "تم التصدير" : "Export complete",
    exportOkD:    isAr ? "تم تحميل النسخة الاحتياطية بنجاح." : "Backup downloaded successfully.",
    exportErr:    isAr ? "خطأ في التصدير" : "Export failed",
    // Access denied
    notAllowed:   isAr ? "غير مسموح بالدخول" : "Access denied",
    notAllowedD:  isAr ? "عذراً، صفحة الإعدادات متاحة للمدراء فقط." : "Sorry, the settings page is available to admins only.",
  };

  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [memberUpdateExisting, setMemberUpdateExisting] = useState(false);
  const [subUpdateExisting, setSubUpdateExisting] = useState(false);
  const [subImportResult, setSubImportResult] = useState<ImportResult | null>(null);
  const [isSubImporting, setIsSubImporting] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isExportingMembers, setIsExportingMembers] = useState(false);
  const [isExportingSubs, setIsExportingSubs] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [isSavingFormSettings, setIsSavingFormSettings] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);
  const [apiKeyCopied, setApiKeyCopied] = useState(false);
  const [isDownloadingWorkflow, setIsDownloadingWorkflow] = useState(false);
  const [formUrlCopied, setFormUrlCopied] = useState(false);
  const [isDownloadingArExcel, setIsDownloadingArExcel] = useState(false);
  const [isDownloadingEnExcel, setIsDownloadingEnExcel] = useState(false);
  const [aiProvider, setAiProvider] = useState<"openai" | "gemini">("openai");
  const [aiApiKey, setAiApiKey] = useState("");
  const [showAiKey, setShowAiKey] = useState(false);
  const [isTestingAi, setIsTestingAi] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingAiSettings, setIsSavingAiSettings] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState("");
  const [telegramChatId, setTelegramChatId] = useState("");
  const [showTelegramToken, setShowTelegramToken] = useState(false);
  const [isTestingTelegram, setIsTestingTelegram] = useState(false);
  const [telegramTestResult, setTelegramTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSavingTelegramSettings, setIsSavingTelegramSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const subFileInputRef = useRef<HTMLInputElement>(null);

  const userFormSchema = buildUserSchema(isAr);

  const { data: users, isLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: currentUser } = useQuery<User>({ queryKey: ["/api/user"] });
  const { data: formSettingsData, isLoading: isLoadingFormSettings } = useQuery<FormSettings>({
    queryKey: ["/api/form-settings"],
  });

  useEffect(() => {
    if (formSettingsData) {
      setAiProvider((formSettingsData.aiProvider as "openai" | "gemini") || "openai");
      setAiApiKey(formSettingsData.aiApiKey || "");
      setTelegramBotToken(formSettingsData.telegramBotToken || "");
      setTelegramChatId(formSettingsData.telegramChatId || "");
    }
  }, [formSettingsData]);

  const formSettingsForm = useForm({
    resolver: zodResolver(insertFormSettingsSchema),
    defaultValues: { notificationEmail: "", webhookUrl: "", verificationCode: "SCVA-2026", arExcelPath: "", enExcelPath: "" },
    values: formSettingsData
      ? {
          notificationEmail: formSettingsData.notificationEmail ?? "",
          webhookUrl: formSettingsData.webhookUrl ?? "",
          verificationCode: formSettingsData.verificationCode ?? "SCVA-2026",
          arExcelPath: formSettingsData.arExcelPath ?? "",
          enExcelPath: formSettingsData.enExcelPath ?? "",
        }
      : undefined,
  });

  const handleSaveFormSettings = async (data: { notificationEmail?: string; webhookUrl?: string; verificationCode?: string; arExcelPath?: string; enExcelPath?: string }) => {
    setIsSavingFormSettings(true);
    try {
      const res = await apiRequest("PUT", "/api/form-settings", data);
      if (!res.ok) throw new Error(isAr ? "فشل الحفظ" : "Save failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/form-settings"] });
      toast({
        title: isAr ? "تم الحفظ" : "Saved",
        description: isAr ? "تم حفظ إعدادات نموذج التسجيل بنجاح." : "Registration form settings saved successfully.",
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "";
      toast({
        title: isAr ? "خطأ في الحفظ" : "Save failed",
        description: msg || undefined,
        variant: "destructive",
      });
    } finally {
      setIsSavingFormSettings(false);
    }
  };

  const handleCopyCode = () => {
    const code = formSettingsForm.getValues("verificationCode") ?? "";
    navigator.clipboard.writeText(code).then(() => {
      setCodeCopied(true);
      setTimeout(() => setCodeCopied(false), 2000);
    });
  };

  const handleDownloadExcel = async (lang: "ar" | "en") => {
    const setter = lang === "ar" ? setIsDownloadingArExcel : setIsDownloadingEnExcel;
    setter(true);
    try {
      const res = await apiRequest("GET", `/api/admin/excel-download?lang=${lang}`);
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = lang === "ar" ? "نموذج-الأعضاء-عربي.xlsx" : "SCVA-Members-Template-EN.xlsx";
      a.click();
      URL.revokeObjectURL(url);
      toast({
        title: isAr ? "تم التحميل" : "Downloaded",
        description: isAr
          ? `تم تحميل ملف Excel ${lang === "ar" ? "العربي" : "الإنجليزي"} بنجاح.`
          : `${lang === "ar" ? "Arabic" : "English"} Excel file downloaded successfully.`,
      });
    } catch {
      toast({ title: isAr ? "خطأ في التحميل" : "Download failed", variant: "destructive" });
    } finally {
      setter(false);
    }
  };

  const handleTestAi = async () => {
    if (!aiApiKey.trim()) {
      toast({
        title: isAr ? "مطلوب" : "Required",
        description: isAr ? "يرجى إدخال مفتاح API أولاً" : "Please enter an API key first",
        variant: "destructive",
      });
      return;
    }
    setIsTestingAi(true);
    setAiTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/admin/test-ai", { provider: aiProvider, apiKey: aiApiKey });
      const data = await res.json() as { success: boolean; message: string };
      setAiTestResult(data);
    } catch {
      setAiTestResult({ success: false, message: isAr ? "فشل الاتصال بالخادم" : "Failed to connect to server" });
    } finally {
      setIsTestingAi(false);
    }
  };

  const handleSaveAiSettings = async () => {
    setIsSavingAiSettings(true);
    try {
      const res = await apiRequest("PUT", "/api/form-settings", { aiProvider, aiApiKey });
      if (!res.ok) throw new Error(isAr ? "فشل الحفظ" : "Save failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/form-settings"] });
      toast({
        title: isAr ? "تم الحفظ" : "Saved",
        description: isAr ? "تم حفظ إعدادات الذكاء الاصطناعي بنجاح. حمّل ملف Workflow مجدداً لتضمين المفتاح." : "AI settings saved. Re-download the Workflow file to embed the key.",
      });
    } catch {
      toast({ title: isAr ? "خطأ في الحفظ" : "Save failed", variant: "destructive" });
    } finally {
      setIsSavingAiSettings(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramBotToken.trim() || !telegramChatId.trim()) {
      toast({
        title: isAr ? "مطلوب" : "Required",
        description: isAr ? "يرجى إدخال التوكن ومعرّف المحادثة أولاً" : "Please enter bot token and chat ID first",
        variant: "destructive",
      });
      return;
    }
    setIsTestingTelegram(true);
    setTelegramTestResult(null);
    try {
      const res = await apiRequest("POST", "/api/admin/test-telegram", {
        botToken: telegramBotToken,
        chatId: telegramChatId,
      });
      const data = await res.json() as { success: boolean; message: string };
      setTelegramTestResult(data);
    } catch {
      setTelegramTestResult({ success: false, message: isAr ? "فشل الاتصال بالخادم" : "Failed to connect to server" });
    } finally {
      setIsTestingTelegram(false);
    }
  };

  const handleSaveTelegramSettings = async () => {
    setIsSavingTelegramSettings(true);
    try {
      const res = await apiRequest("PUT", "/api/form-settings", { telegramBotToken, telegramChatId });
      if (!res.ok) throw new Error(isAr ? "فشل الحفظ" : "Save failed");
      await queryClient.invalidateQueries({ queryKey: ["/api/form-settings"] });
      toast({
        title: isAr ? "تم الحفظ" : "Saved",
        description: isAr
          ? "تم حفظ إعدادات Telegram بنجاح. حمّل ملف Workflow مجدداً لتضمين البيانات."
          : "Telegram settings saved. Re-download the Workflow file to embed them.",
      });
    } catch {
      toast({ title: isAr ? "خطأ في الحفظ" : "Save failed", variant: "destructive" });
    } finally {
      setIsSavingTelegramSettings(false);
    }
  };

  const handleDownloadWorkflow = async () => {
    const email = formSettingsData?.notificationEmail ?? "";
    if (!email) {
      toast({
        title: L.dlWorkflowErr,
        description: isAr
          ? "يجب حفظ البريد الإلكتروني للإشعارات قبل تحميل ملف Workflow."
          : "Please save the notification email before downloading the workflow.",
        variant: "destructive",
      });
      return;
    }
    setIsDownloadingWorkflow(true);
    try {
      const res = await apiRequest("GET", "/api/admin/workflow");
      if (!res.ok) throw new Error("fetch failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "scva-member-workflow.json";
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: L.dlWorkflowOk, description: L.dlWorkflowOkD });
    } catch {
      toast({ title: L.dlWorkflowErr, variant: "destructive" });
    } finally {
      setIsDownloadingWorkflow(false);
    }
  };

  // Number of admins; used to disable destructive actions on the last admin.
  const adminCount = (users ?? []).filter((u) => u.role === "admin").length;

  const onMutationError = (err: Error) => {
    toast({ title: L.error, description: err.message, variant: "destructive" });
  };

  const createUserMutation = useMutation({
    mutationFn: async (data: UserFormValues) => {
      const res = await apiRequest("POST", "/api/users", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: L.success, description: L.addUserOk });
      setIsDialogOpen(false);
    },
    onError: onMutationError,
  });

  const updateUserMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<UserFormValues> }) => {
      const res = await apiRequest("PATCH", `/api/users/${id}`, data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: L.success, description: L.updUserOk });
      setIsDialogOpen(false);
    },
    onError: onMutationError,
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: string) => {
      await apiRequest("DELETE", `/api/users/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: L.success, description: L.delUserOk });
    },
    onError: onMutationError,
  });

  const form = useForm<UserFormValues>({
    resolver: zodResolver(userFormSchema),
    defaultValues: { username: "", password: "", role: "employee" },
  });

  const onSubmit = (data: UserFormValues) => {
    if (editingUser) {
      const updates = { ...data };
      if (!updates.password) delete updates.password;
      updateUserMutation.mutate({ id: editingUser.id, data: updates });
    } else {
      createUserMutation.mutate(data);
    }
  };

  const startEdit = (user: User) => {
    setEditingUser(user);
    form.reset({
      username: user.username,
      password: "",
      role: user.role as "admin" | "employee",
    });
    setIsDialogOpen(true);
  };

  const startAdd = () => {
    setEditingUser(null);
    form.reset({ username: "", password: "", role: "employee" });
    setIsDialogOpen(true);
  };

  // ---- Excel template download ----
  const downloadTemplate = () => {
    const headers = IMPORT_COLUMNS.map((c) => (isAr ? c.labelAr : c.labelEn));
    const example = IMPORT_COLUMNS.map((c) => (isAr ? c.exampleAr : c.exampleEn));
    const notes = IMPORT_COLUMNS.map((c) => {
      if (c.key === "gender")
        return isAr ? "القيم: male أو female" : "Values: male or female";
      if (c.key === "membershipType")
        return isAr ? "القيم: original أو associate" : "Values: original or associate";
      if (c.key === "specialty")
        return isAr
          ? "القيم: cardiology أو cardiac_surgery"
          : "Values: cardiology or cardiac_surgery";
      if (c.key === "birthDate" || c.key === "joinDate")
        return isAr ? "الصيغة: YYYY-MM-DD" : "Format: YYYY-MM-DD";
      return "";
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, example, notes]);
    ws["!cols"] = headers.map(() => ({ wch: 22 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, isAr ? "نموذج الاستيراد" : "Import template");
    XLSX.writeFile(
      wb,
      isAr ? "نموذج-استيراد-الاعضاء.xlsx" : "members-import-template.xlsx",
    );
    toast({ title: L.tplDl, description: L.tplDlD });
  };

  // ---- Excel file import ----
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);
    setIsImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rawRows.length < 2) {
        toast({ title: L.emptyFile, description: L.noData, variant: "destructive" });
        setIsImporting(false);
        return;
      }

      const headerRow = rawRows[0] as string[];
      const dataRows = rawRows.slice(1).filter((r) => r.some((c) => c !== undefined && c !== ""));

      // Accept either Arabic or English headers, regardless of current UI language.
      const colIndexMap = buildHeaderIndex(headerRow, IMPORT_COLUMNS);

      const members = dataRows.map((row) => {
        const obj: Record<string, string> = {};
        IMPORT_COLUMNS.forEach((col) => {
          const idx = colIndexMap[col.key];
          if (idx !== undefined && row[idx] !== undefined && row[idx] !== "") {
            obj[col.key] = String(row[idx]).trim();
          }
        });
        return obj;
      });

      const res = await apiRequest("POST", "/api/members/import", {
        rows: members,
        updateExisting: memberUpdateExisting,
      });
      const result: ImportResult = await res.json();
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      if (result.success > 0 || (result.updated ?? 0) > 0) {
        const parts: string[] = [];
        if (result.success > 0) parts.push(`${L.addedN} ${result.success}`);
        if ((result.updated ?? 0) > 0) parts.push(`${L.updatedN} ${result.updated}`);
        if (result.failed > 0) parts.push(`${L.failedN} ${result.failed}`);
        toast({
          title: L.importDone,
          description: parts.join(L.sep),
        });
      }
    } catch {
      toast({ title: L.readErr, variant: "destructive" });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // ---- Subscriptions template download ----
  const downloadSubTemplate = () => {
    const headers = SUB_IMPORT_COLUMNS.map((c) => (isAr ? c.labelAr : c.labelEn));
    const example = SUB_IMPORT_COLUMNS.map((c) => (isAr ? c.exampleAr : c.exampleEn));
    const notes = SUB_IMPORT_COLUMNS.map((c) => {
      if (c.key === "year")
        return isAr ? "رقم السنة الميلادية مثل 2024" : "Gregorian year, e.g. 2024";
      if (c.key === "amount")
        return isAr ? "رقم صحيح بالليرة السورية" : "Integer in Syrian Pounds";
      if (c.key === "date")
        return isAr ? "الصيغة: YYYY-MM-DD" : "Format: YYYY-MM-DD";
      if (c.key === "membershipNumber")
        return isAr ? "مُفضَّل للمطابقة الدقيقة" : "Preferred for exact matching";
      if (c.key === "firstName" || c.key === "lastName")
        return isAr
          ? "بديل عند غياب رقم العضوية"
          : "Used as fallback if membership number is missing";
      return "";
    });
    const ws = XLSX.utils.aoa_to_sheet([headers, example, notes]);
    ws["!cols"] = [{ wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 22 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(
      wb,
      ws,
      isAr ? "نموذج الاشتراكات" : "Subscriptions template",
    );
    XLSX.writeFile(
      wb,
      isAr ? "نموذج-استيراد-الاشتراكات.xlsx" : "subscriptions-import-template.xlsx",
    );
    toast({ title: L.subTplDl });
  };

  // ---- Subscriptions file import ----
  const handleSubFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSubImportResult(null);
    setIsSubImporting(true);
    try {
      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer);
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rawRows.length < 2) {
        toast({ title: L.emptyFile, variant: "destructive" });
        setIsSubImporting(false);
        return;
      }

      const headerRow = rawRows[0] as string[];
      const dataRows = rawRows.slice(1).filter((r) => r.some((c) => c !== undefined && c !== ""));

      // Accept either Arabic or English headers, regardless of current UI language.
      const colIndexMap = buildHeaderIndex(headerRow, SUB_IMPORT_COLUMNS);

      const rows = dataRows.map((row) => {
        const obj: Record<string, any> = {};
        SUB_IMPORT_COLUMNS.forEach((col) => {
          const idx = colIndexMap[col.key];
          if (idx !== undefined && row[idx] !== undefined && row[idx] !== "") {
            obj[col.key] = col.key === "year" || col.key === "amount"
              ? Number(row[idx])
              : String(row[idx]).trim();
          }
        });
        return obj;
      });

      const res = await apiRequest("POST", "/api/subscriptions/import", {
        rows,
        updateExisting: subUpdateExisting,
      });
      const result: ImportResult = await res.json();
      setSubImportResult(result);
      queryClient.invalidateQueries({ queryKey: ["/api/members"] });
      if (result.success > 0 || (result.updated ?? 0) > 0) {
        const parts: string[] = [];
        if (result.success > 0) parts.push(`${L.addedN} ${result.success}`);
        if ((result.updated ?? 0) > 0) parts.push(`${L.updatedN} ${result.updated}`);
        if (result.failed > 0) parts.push(`${L.failedN} ${result.failed}`);
        toast({
          title: L.subImpDone,
          description: parts.join(L.sep),
        });
      }
    } catch {
      toast({ title: L.readErr, variant: "destructive" });
    } finally {
      setIsSubImporting(false);
      if (subFileInputRef.current) subFileInputRef.current.value = "";
    }
  };

  // ---- Members Excel export ----
  const handleExportMembers = async () => {
    setIsExportingMembers(true);
    try {
      const res = await apiRequest("GET", "/api/members");
      const members: Record<string, unknown>[] = await res.json();
      if (!members.length) {
        toast({ title: L.expMembersOk, description: L.expSubsEmpty });
        return;
      }
      const colDefs = IMPORT_COLUMNS.map((c) => ({
        key: c.key,
        label: (isAr ? c.labelAr : c.labelEn).replace(" *", ""),
      }));
      const data = members.map((m) => {
        const row: Record<string, unknown> = {};
        for (const { key, label } of colDefs) {
          row[label] = m[key] ?? "";
        }
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = colDefs.map(() => ({ wch: 22 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isAr ? "الأعضاء" : "Members");
      XLSX.writeFile(wb, isAr ? "اعضاء-SCVA.xlsx" : "SCVA-Members.xlsx");
      toast({ title: L.expMembersOk, description: L.expMembersOkD });
    } catch {
      toast({ title: L.expMembersErr, variant: "destructive" });
    } finally {
      setIsExportingMembers(false);
    }
  };

  // ---- Subscriptions Excel export ----
  const handleExportSubs = async () => {
    setIsExportingSubs(true);
    try {
      const res = await apiRequest("GET", "/api/subscriptions/export");
      const rows: Record<string, unknown>[] = await res.json();
      if (!rows.length) {
        toast({ title: L.expSubsOk, description: L.expSubsEmpty });
        return;
      }
      const colDefs = SUB_IMPORT_COLUMNS.map((c) => ({
        key: c.key,
        label: (isAr ? c.labelAr : c.labelEn).replace(" *", ""),
      }));
      const data = rows.map((r) => {
        const row: Record<string, unknown> = {};
        for (const { key, label } of colDefs) {
          row[label] = r[key] ?? "";
        }
        return row;
      });
      const ws = XLSX.utils.json_to_sheet(data);
      ws["!cols"] = colDefs.map(() => ({ wch: 22 }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, isAr ? "الاشتراكات" : "Subscriptions");
      XLSX.writeFile(wb, isAr ? "اشتراكات-SCVA.xlsx" : "SCVA-Subscriptions.xlsx");
      toast({ title: L.expSubsOk, description: L.expSubsOkD });
    } catch {
      toast({ title: L.expSubsErr, variant: "destructive" });
    } finally {
      setIsExportingSubs(false);
    }
  };

  // ---- Backup download ----
  const handleBackup = async () => {
    setIsBackingUp(true);
    try {
      const res = await apiRequest("GET", "/api/backup");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `scva-backup-${new Date().toISOString().split("T")[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: L.exportOk, description: L.exportOkD });
    } catch {
      toast({ title: L.exportErr, variant: "destructive" });
    } finally {
      setIsBackingUp(false);
    }
  };

  if (isLoading) return <Loader2 className="h-8 w-8 animate-spin mx-auto mt-20" />;

  if (currentUser?.role !== "admin") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 text-center">
        <div className="h-20 w-20 rounded-full bg-destructive/10 flex items-center justify-center">
          <ShieldCheck className="h-10 w-10 text-destructive" />
        </div>
        <h2 className="text-2xl font-bold">{L.notAllowed}</h2>
        <p className="text-muted-foreground max-w-sm">{L.notAllowedD}</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">{L.title}</h1>
        <p className="text-muted-foreground mt-1">{L.subtitle}</p>
      </div>

      {/* ===== Registration Form Settings ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
              <Link2 className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {isAr ? "إعدادات نموذج التسجيل الخارجي" : "External Registration Form Settings"}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? "اضبط رمز الدعوة وبريد الإشعارات ورابط n8n لتفعيل نموذج تسجيل الأعضاء."
                  : "Configure the invitation code, notification email, and n8n webhook to enable the member registration form."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoadingFormSettings ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isAr ? "جارٍ التحميل..." : "Loading..."}
            </div>
          ) : (
            <>
            <form
              onSubmit={formSettingsForm.handleSubmit(handleSaveFormSettings)}
              className="space-y-5"
            >
              {/* Invitation Code */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  {isAr ? "رمز الدعوة العام" : "General Invitation Code"}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      {...formSettingsForm.register("verificationCode")}
                      type={showCode ? "text" : "password"}
                      placeholder={isAr ? "مثال: SCVA-2026" : "Example: SCVA-2026"}
                      className="pe-10 font-mono"
                      data-testid="input-verification-code"
                    />
                    <button
                      type="button"
                      onClick={() => setShowCode((v) => !v)}
                      className="absolute inset-y-0 end-2 flex items-center px-1 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showCode ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCode}
                    title={isAr ? "نسخ الرمز" : "Copy code"}
                    data-testid="button-copy-code"
                  >
                    {codeCopied ? (
                      <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {formSettingsData?.codeUpdatedAt && (
                  <p className="text-xs text-muted-foreground">
                    {isAr ? "آخر تغيير: " : "Last changed: "}
                    {new Date(formSettingsData.codeUpdatedAt).toLocaleDateString(
                      isAr ? "ar-SY" : "en-GB",
                      { year: "numeric", month: "long", day: "numeric" },
                    )}
                  </p>
                )}
                {formSettingsForm.formState.errors.verificationCode && (
                  <p className="text-sm text-destructive">
                    {formSettingsForm.formState.errors.verificationCode.message}
                  </p>
                )}
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400">
                  ⚠️{" "}
                  {isAr
                    ? "عند تغيير الرمز يُصبح الرمز القديم غير صالح فوراً. أعطِ الرمز للأعضاء الجدد فقط."
                    : "Changing the code immediately invalidates the old one. Share the new code only with intended members."}
                </div>
              </div>

              {/* Notification Email */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-3.5 w-3.5 text-primary" />
                  {isAr ? "البريد الإلكتروني للإشعارات" : "Notification Email"}
                </Label>
                <Input
                  {...formSettingsForm.register("notificationEmail")}
                  type="email"
                  placeholder={isAr ? "admin@scva.org" : "admin@scva.org"}
                  data-testid="input-notification-email"
                />
                {formSettingsForm.formState.errors.notificationEmail && (
                  <p className="text-sm text-destructive">
                    {formSettingsForm.formState.errors.notificationEmail.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "سيصلك إشعار بريدي في كل مرة يُرسل عضو بياناته عبر النموذج."
                    : "You'll receive an email notification each time a member submits the registration form."}
                </p>
              </div>

              {/* Webhook URL */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  {isAr ? "رابط Webhook (من n8n)" : "Webhook URL (from n8n)"}
                </Label>
                <Input
                  {...formSettingsForm.register("webhookUrl")}
                  type="url"
                  placeholder="https://your-n8n.com/webhook/scva-member-register"
                  dir="ltr"
                  className="font-mono text-sm"
                  data-testid="input-webhook-url"
                />
                {formSettingsForm.formState.errors.webhookUrl && (
                  <p className="text-sm text-destructive">
                    {formSettingsForm.formState.errors.webhookUrl.message}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "انسخ رابط Webhook من عقدة Webhook في n8n والصقه هنا."
                    : "Copy the Webhook URL from the Webhook node in n8n and paste it here."}
                </p>
              </div>

              {/* API Key */}
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  {isAr ? "مفتاح API — لـ n8n" : "API Key — for n8n"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "يُستخدم هذا المفتاح من قِبَل n8n لكتابة بيانات الأعضاء مباشرةً في ملفات Excel على هذا السيرفر. يُضمَّن تلقائياً في ملف Workflow عند تحميله."
                    : "This key is used by n8n to write member data directly to Excel files on this server. It is automatically embedded in the Workflow file when downloaded."}
                </p>
                <div className="flex gap-2">
                  <code className="flex-1 rounded-md border bg-background px-3 py-2 text-sm font-mono truncate select-all" dir="ltr">
                    {formSettingsData?.apiKey || "—"}
                  </code>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    title={isAr ? "نسخ المفتاح" : "Copy key"}
                    onClick={() => {
                      const key = formSettingsData?.apiKey ?? "";
                      navigator.clipboard.writeText(key).then(() => {
                        setApiKeyCopied(true);
                        setTimeout(() => setApiKeyCopied(false), 2000);
                      });
                    }}
                  >
                    {apiKeyCopied ? (
                      <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-400">
                  ✅{" "}
                  {isAr
                    ? "ملفات Excel محفوظة على هذا السيرفر — n8n يكتب فيها مباشرةً عبر HTTP دون الحاجة لنسخها."
                    : "Excel files are stored on this server — n8n writes to them directly via HTTP with no need to copy them."}
                </div>
              </div>

              {/* Excel Files Download */}
              <div className="rounded-md border border-border bg-muted/30 p-4 space-y-3">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  {isAr ? "تحميل ملفات Excel المحدَّثة" : "Download updated Excel files"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "حمّل ملفات Excel بعد اكتمال تسجيلات الأعضاء لمراجعة البيانات."
                    : "Download the Excel files after member registrations are complete to review the data."}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleDownloadExcel("ar")}
                    disabled={isDownloadingArExcel}
                  >
                    {isDownloadingArExcel ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {isAr ? "تحميل ملف Excel العربي" : "Download Arabic Excel"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleDownloadExcel("en")}
                    disabled={isDownloadingEnExcel}
                  >
                    {isDownloadingEnExcel ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Download className="h-3.5 w-3.5" />
                    )}
                    {isAr ? "تحميل ملف Excel الإنجليزي" : "Download English Excel"}
                  </Button>
                </div>
              </div>

              <Button
                type="submit"
                disabled={isSavingFormSettings}
                className="gap-2"
                data-testid="button-save-form-settings"
              >
                {isSavingFormSettings ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSavingFormSettings
                  ? (isAr ? "جارٍ الحفظ..." : "Saving...")
                  : (isAr ? "حفظ الإعدادات" : "Save settings")}
              </Button>
            </form>

            {/* ── Form URL ── */}
            <div className="mt-6 pt-5 border-t space-y-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Link2 className="h-3.5 w-3.5 text-primary" />
                  {L.formUrlTitle}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{L.formUrlDesc}</p>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded-md border bg-muted/40 px-3 py-2 text-sm font-mono truncate select-all dir-ltr" dir="ltr">
                  {typeof window !== "undefined" ? `${window.location.origin}/form` : "/form"}
                </code>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  title={isAr ? "نسخ الرابط" : "Copy link"}
                  onClick={() => {
                    const url = `${window.location.origin}/form`;
                    navigator.clipboard.writeText(url).then(() => {
                      setFormUrlCopied(true);
                      setTimeout(() => setFormUrlCopied(false), 2000);
                    });
                  }}
                >
                  {formUrlCopied ? (
                    <ClipboardCheck className="h-4 w-4 text-emerald-600" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-2 shrink-0"
                  onClick={() => window.open("/form", "_blank")}
                >
                  <X className="h-3.5 w-3.5 rotate-45" />
                  {L.formUrlOpen}
                </Button>
              </div>
            </div>

            {/* ── Workflow Download ── */}
            <div className="mt-6 pt-5 border-t space-y-3">
              <div>
                <p className="text-sm font-medium flex items-center gap-2">
                  <Workflow className="h-3.5 w-3.5 text-primary" />
                  {L.dlWorkflow}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{L.dlWorkflowD}</p>
              </div>
              {!formSettingsData?.notificationEmail && (
                <div className="rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 px-3 py-2 text-xs text-amber-700 dark:text-amber-400 flex items-start gap-2">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
                  <span>
                    {isAr
                      ? "يجب حفظ البريد الإلكتروني للإشعارات أولاً."
                      : "Please save the notification email first."}
                  </span>
                </div>
              )}
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={handleDownloadWorkflow}
                disabled={isDownloadingWorkflow || !formSettingsData?.notificationEmail}
                data-testid="button-download-workflow"
              >
                {isDownloadingWorkflow ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                {isDownloadingWorkflow ? (isAr ? "جارٍ التحميل..." : "Downloading...") : L.dlWorkflowBtn}
              </Button>
            </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== AI Settings ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
              <Sparkles className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {isAr ? "إعدادات الذكاء الاصطناعي" : "AI Settings"}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? "أدخل مفتاح API لتفعيل التحليل الذكي للطلبات وكتابة رسائل ترحيب احترافية للأعضاء."
                  : "Enter an API key to enable smart analysis of applications and professional welcome emails."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoadingFormSettings ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isAr ? "جارٍ التحميل..." : "Loading..."}
            </div>
          ) : (
            <>
              {/* Provider selector */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {isAr ? "مزوّد الذكاء الاصطناعي" : "AI Provider"}
                </Label>
                <Select
                  value={aiProvider}
                  onValueChange={(v) => {
                    setAiProvider(v as "openai" | "gemini");
                    setAiTestResult(null);
                  }}
                >
                  <SelectTrigger className="w-64">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">OpenAI</span>
                        <span className="text-xs text-muted-foreground">gpt-4o-mini</span>
                      </span>
                    </SelectItem>
                    <SelectItem value="gemini">
                      <span className="flex items-center gap-2">
                        <span className="font-medium">Google Gemini</span>
                        <span className="text-xs text-muted-foreground">gemini-2.5-flash</span>
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* API Key input */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-3.5 w-3.5 text-primary" />
                  {isAr ? "مفتاح API" : "API Key"}
                </Label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Input
                      type={showAiKey ? "text" : "password"}
                      value={aiApiKey}
                      onChange={(e) => {
                        setAiApiKey(e.target.value);
                        setAiTestResult(null);
                      }}
                      placeholder={
                        aiProvider === "openai"
                          ? "sk-proj-..."
                          : "AIzaSy..."
                      }
                      dir="ltr"
                      className="pe-10 font-mono text-sm"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAiKey((v) => !v)}
                      className="absolute inset-y-0 end-2 flex items-center px-1 text-muted-foreground hover:text-foreground"
                      tabIndex={-1}
                    >
                      {showAiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {aiProvider === "openai"
                    ? (isAr ? "احصل على المفتاح من: platform.openai.com/api-keys" : "Get your key from: platform.openai.com/api-keys")
                    : (isAr ? "احصل على المفتاح من: aistudio.google.com/app/apikey" : "Get your key from: aistudio.google.com/app/apikey")}
                </p>
              </div>

              {/* Test button + result */}
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleTestAi}
                  disabled={isTestingAi || !aiApiKey.trim()}
                >
                  {isTestingAi ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  {isTestingAi
                    ? (isAr ? "جارٍ الاختبار..." : "Testing...")
                    : (isAr ? "اختبار المفتاح" : "Test API Key")}
                </Button>

                {aiTestResult && (
                  <div className={`rounded-md border px-4 py-3 text-sm flex items-start gap-2.5 ${
                    aiTestResult.success
                      ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                      : "border-destructive/30 bg-destructive/5 text-destructive"
                  }`}>
                    {aiTestResult.success
                      ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                      : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                    <div>
                      <p className="font-medium text-xs mb-0.5">
                        {aiTestResult.success
                          ? (isAr ? "✅ المفتاح يعمل بشكل صحيح" : "✅ API key is working")
                          : (isAr ? "❌ فشل الاختبار" : "❌ Test failed")}
                      </p>
                      <p className="text-xs opacity-80">{aiTestResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* How it works info */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  {isAr ? "كيف يعمل؟" : "How it works"}
                </p>
                <ul className="space-y-1.5 list-disc list-inside">
                  <li>{isAr ? "عند استلام طلب عضوية جديد، يحلّل الـ AI بيانات الطلب ويكتب ملاحظات للمسؤول." : "When a new membership request arrives, AI analyses the data and writes admin notes."}</li>
                  <li>{isAr ? "يُولَّد أيضاً رسالة ترحيب شخصية ترسَل للعضو تلقائياً عبر البريد الإلكتروني." : "A personalised welcome message is also generated and sent to the member automatically."}</li>
                  <li>{isAr ? "المفتاح يُحقَن تلقائياً في ملف Workflow عند تحميله — لا تعديل يدوي في n8n." : "The key is automatically injected into the Workflow file on download — no manual edits in n8n."}</li>
                  <li>{isAr ? "الخدمة اختيارية: الـ workflow يعمل بشكل طبيعي حتى بدون مفتاح AI." : "The service is optional: the workflow works normally even without an AI key."}</li>
                </ul>
              </div>

              {/* Save button */}
              <Button
                onClick={handleSaveAiSettings}
                disabled={isSavingAiSettings}
                className="gap-2"
              >
                {isSavingAiSettings ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSavingAiSettings
                  ? (isAr ? "جارٍ الحفظ..." : "Saving...")
                  : (isAr ? "حفظ إعدادات الذكاء الاصطناعي" : "Save AI settings")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== Telegram Settings ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-[#2AABEE]/10 text-[#2AABEE] flex items-center justify-center ring-1 ring-[#2AABEE]/20">
              <Send className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {isAr ? "إشعارات Telegram" : "Telegram Notifications"}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? "ربط بوت Telegram لإرسال إشعار فوري للمسؤول عند تسجيل عضو جديد عبر النموذج."
                  : "Connect a Telegram bot to send instant admin alerts when a new member registers via the form."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          {isLoadingFormSettings ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm py-4">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isAr ? "جارٍ التحميل..." : "Loading..."}
            </div>
          ) : (
            <>
              {/* How to get token info */}
              <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground flex items-center gap-1.5">
                  <Send className="h-3.5 w-3.5 text-[#2AABEE]" />
                  {isAr ? "كيف تنشئ بوت Telegram؟" : "How to create a Telegram bot?"}
                </p>
                <ol className="space-y-1 list-decimal list-inside">
                  <li>{isAr ? "افتح Telegram وابحث عن @BotFather" : "Open Telegram and search for @BotFather"}</li>
                  <li>{isAr ? "أرسل /newbot واتبع التعليمات للحصول على التوكن" : "Send /newbot and follow instructions to get the token"}</li>
                  <li>{isAr ? "أضف البوت لمجموعة أو محادثة وابدأ الحوار معه" : "Add the bot to a group or chat and start a conversation"}</li>
                  <li>
                    {isAr
                      ? "للحصول على Chat ID: أرسل رسالة للبوت ثم افتح الرابط:"
                      : "To get Chat ID: send a message to the bot then open:"}
                    {" "}
                    <span className="font-mono text-foreground">api.telegram.org/bot&lt;TOKEN&gt;/getUpdates</span>
                  </li>
                </ol>
              </div>

              {/* Bot Token */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <KeyRound className="h-3.5 w-3.5 text-[#2AABEE]" />
                  {isAr ? "توكن البوت (Bot Token)" : "Bot Token"}
                </Label>
                <div className="relative">
                  <Input
                    type={showTelegramToken ? "text" : "password"}
                    value={telegramBotToken}
                    onChange={(e) => {
                      setTelegramBotToken(e.target.value);
                      setTelegramTestResult(null);
                    }}
                    placeholder="123456789:AAF..."
                    dir="ltr"
                    className="pe-10 font-mono text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowTelegramToken((v) => !v)}
                    className="absolute inset-y-0 end-2 flex items-center px-1 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                  >
                    {showTelegramToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              {/* Chat ID */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2 text-sm font-medium">
                  <Mail className="h-3.5 w-3.5 text-[#2AABEE]" />
                  {isAr ? "معرّف المحادثة (Chat ID)" : "Chat ID"}
                </Label>
                <Input
                  type="text"
                  value={telegramChatId}
                  onChange={(e) => {
                    setTelegramChatId(e.target.value);
                    setTelegramTestResult(null);
                  }}
                  placeholder="-1001234567890"
                  dir="ltr"
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  {isAr
                    ? "يمكن أن يكون معرّف مستخدم أو مجموعة (يبدأ بـ - للمجموعات)"
                    : "Can be a user ID or group ID (groups start with -)"}
                </p>
              </div>

              {/* Test button + result */}
              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  onClick={handleTestTelegram}
                  disabled={isTestingTelegram || !telegramBotToken.trim() || !telegramChatId.trim()}
                >
                  {isTestingTelegram ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {isTestingTelegram
                    ? (isAr ? "جارٍ الإرسال..." : "Sending...")
                    : (isAr ? "إرسال رسالة اختبار" : "Send test message")}
                </Button>

                {telegramTestResult && (
                  <div className={`rounded-md border px-4 py-3 text-sm flex items-start gap-2.5 ${
                    telegramTestResult.success
                      ? "border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300"
                      : "border-destructive/30 bg-destructive/5 text-destructive"
                  }`}>
                    {telegramTestResult.success
                      ? <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
                      : <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />}
                    <div>
                      <p className="font-medium text-xs mb-0.5">
                        {telegramTestResult.success
                          ? (isAr ? "✅ تم الإرسال بنجاح!" : "✅ Sent successfully!")
                          : (isAr ? "❌ فشل الإرسال" : "❌ Send failed")}
                      </p>
                      <p className="text-xs opacity-80">{telegramTestResult.message}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Save button */}
              <Button
                onClick={handleSaveTelegramSettings}
                disabled={isSavingTelegramSettings}
                className="gap-2"
              >
                {isSavingTelegramSettings ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {isSavingTelegramSettings
                  ? (isAr ? "جارٍ الحفظ..." : "Saving...")
                  : (isAr ? "حفظ إعدادات Telegram" : "Save Telegram settings")}
              </Button>
            </>
          )}
        </CardContent>
      </Card>

      {/* ===== User Management ===== */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
          <div>
            <CardTitle className="text-lg">{L.usersTitle}</CardTitle>
            <CardDescription>{L.usersDesc}</CardDescription>
          </div>
          <Button onClick={startAdd} size="sm">
            <UserPlus className="ms-2 h-4 w-4" />
            {L.addUser}
          </Button>
        </CardHeader>
        <CardContent className="p-0">
          <div className="rounded-b-lg overflow-hidden border-t">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className={`${isAr ? "text-right" : "text-left"} font-semibold`}>{L.username}</TableHead>
                  <TableHead className={`${isAr ? "text-right" : "text-left"} font-semibold`}>{L.role}</TableHead>
                  <TableHead className={`${isAr ? "text-left" : "text-right"} font-semibold w-24`}>{L.actions}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.map((user) => {
                  const isSelf = currentUser?.id === user.id;
                  const isLastAdmin = user.role === "admin" && adminCount <= 1;
                  const cannotDelete = isSelf || isLastAdmin;
                  const deleteTitle = isSelf
                    ? L.cantDelSelf
                    : isLastAdmin
                    ? L.cantDelLast
                    : L.delUser;
                  return (
                    <TableRow key={user.id} data-testid={`row-user-${user.id}`}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>
                        <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                          {user.role === "admin" ? L.admin : L.employee}
                        </Badge>
                      </TableCell>
                      <TableCell className={isAr ? "text-left" : "text-right"}>
                        <div className={`flex gap-1 ${isAr ? "justify-end" : "justify-start"}`}>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => startEdit(user)}
                            className="h-8 w-8"
                            data-testid={`button-edit-user-${user.id}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            disabled={cannotDelete}
                            title={deleteTitle}
                            aria-label={deleteTitle}
                            className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10 disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-auto"
                            onClick={() => {
                              if (cannotDelete) return;
                              if (confirm(L.confirmDel)) {
                                deleteUserMutation.mutate(user.id);
                              }
                            }}
                            data-testid={`button-delete-user-${user.id}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ===== Data Import (Members + Subscriptions) ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
              <Upload className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {isAr ? "استيراد البيانات" : "Import Data"}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? "استيراد بيانات الأعضاء والاشتراكات من ملفات Excel دفعةً واحدة."
                  : "Import members and subscriptions from Excel files in bulk."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* ── Members Import ── */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-1">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">{L.impMembers}</h3>
              <Badge variant="outline" className="text-xs ms-1">
                {isAr ? "أعضاء" : "Members"}
              </Badge>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">{L.steps}</p>
              <ol className="text-sm text-muted-foreground space-y-1.5 list-decimal list-inside">
                <li>{L.step1}</li>
                <li>{L.step2}</li>
                <li>{L.step3}</li>
              </ol>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={downloadTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                {L.dlTemplate}
              </Button>
              <div className="relative">
                <Button
                  variant="default"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isImporting}
                  className="gap-2"
                >
                  {isImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isImporting ? L.importing : L.uploadFile}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleFileImport}
                />
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 cursor-pointer">
              <Checkbox
                id="member-update-existing"
                checked={memberUpdateExisting}
                onCheckedChange={(c) => setMemberUpdateExisting(c === true)}
                data-testid="checkbox-member-update-existing"
                className="mt-0.5"
              />
              <div className="space-y-0.5 text-sm">
                <span className="font-medium">{L.updExisting}</span>
                <p className="text-xs text-muted-foreground">{L.updExHelp}</p>
              </div>
            </label>

            {importResult && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{L.importRes}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setImportResult(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{L.succeeded} <strong>{importResult.success}</strong></span>
                  </div>
                  {importResult.failed > 0 && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{L.failed} <strong>{importResult.failed}</strong></span>
                    </div>
                  )}
                  {importResult.updated !== undefined && importResult.updated > 0 && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{L.updated} <strong>{importResult.updated}</strong></span>
                    </div>
                  )}
                  {importResult.skipped !== undefined && importResult.skipped > 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>{L.skipped} <strong>{importResult.skipped}</strong></span>
                    </div>
                  )}
                </div>
                {importResult.errors.length > 0 && (
                  <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 space-y-1 max-h-40 overflow-y-auto">
                    {importResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive font-mono">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="border-t" />

          {/* ── Subscriptions Import ── */}
          <div className="space-y-5">
            <div className="flex items-center gap-2 pb-1">
              <Receipt className="h-4 w-4 text-primary" />
              <h3 className="font-semibold text-sm">{L.impSubs}</h3>
              <Badge variant="outline" className="text-xs ms-1">
                {isAr ? "اشتراكات" : "Subscriptions"}
              </Badge>
            </div>

            <div className="rounded-lg border bg-muted/30 p-4 space-y-3">
              <p className="text-sm font-medium">{L.matchTitle}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-muted-foreground">
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">①</span>
                  <span><strong>{L.membershipNo}</strong> — {L.matchById}</span>
                </div>
                <div className="flex items-start gap-2">
                  <span className="text-primary font-bold mt-0.5">②</span>
                  <span><strong>{L.nameCombo}</strong> — {L.matchByName}</span>
                </div>
              </div>
              <div className="border-t pt-3">
                <p className="text-sm font-medium mb-1.5">{L.requiredCols}</p>
                <div className="flex flex-wrap gap-2">
                  {[
                    { label: L.fNoOrName, note: L.fNoOrNameD },
                    { label: L.fYear,     note: L.fYearD },
                    { label: L.fAmount,   note: L.fAmountD },
                    { label: L.fDate,     note: L.fDateD },
                  ].map((f) => (
                    <span key={f.label} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs">
                      <strong>{f.label}</strong>
                      <span className="text-muted-foreground">({f.note})</span>
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={downloadSubTemplate} className="gap-2">
                <Download className="h-4 w-4" />
                {L.dlSubTpl}
              </Button>
              <div className="relative">
                <Button
                  variant="default"
                  onClick={() => subFileInputRef.current?.click()}
                  disabled={isSubImporting}
                  className="gap-2"
                >
                  {isSubImporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {isSubImporting ? L.importing : L.uploadSub}
                </Button>
                <input
                  ref={subFileInputRef}
                  type="file"
                  accept=".xlsx,.xls"
                  className="hidden"
                  onChange={handleSubFileImport}
                />
              </div>
            </div>

            <label className="flex items-start gap-2 rounded-lg border bg-muted/30 p-3 cursor-pointer">
              <Checkbox
                id="sub-update-existing"
                checked={subUpdateExisting}
                onCheckedChange={(c) => setSubUpdateExisting(c === true)}
                data-testid="checkbox-sub-update-existing"
                className="mt-0.5"
              />
              <div className="space-y-0.5 text-sm">
                <span className="font-medium">{L.updSubExist}</span>
                <p className="text-xs text-muted-foreground">{L.updSubHelp}</p>
              </div>
            </label>

            {subImportResult && (
              <div className="rounded-lg border p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-sm">{L.subResults}</p>
                  <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setSubImportResult(null)}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>
                <div className="flex gap-4 flex-wrap">
                  <div className="flex items-center gap-2 text-sm text-emerald-600">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>{L.succeeded} <strong>{subImportResult.success}</strong></span>
                  </div>
                  {subImportResult.failed > 0 && (
                    <div className="flex items-center gap-2 text-sm text-destructive">
                      <AlertCircle className="h-4 w-4" />
                      <span>{L.failed} <strong>{subImportResult.failed}</strong></span>
                    </div>
                  )}
                  {subImportResult.updated !== undefined && subImportResult.updated > 0 && (
                    <div className="flex items-center gap-2 text-sm text-blue-600">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>{L.updated} <strong>{subImportResult.updated}</strong></span>
                    </div>
                  )}
                  {subImportResult.skipped !== undefined && subImportResult.skipped > 0 && (
                    <div className="flex items-center gap-2 text-sm text-amber-600">
                      <AlertCircle className="h-4 w-4" />
                      <span>{L.skipped} <strong>{subImportResult.skipped}</strong></span>
                    </div>
                  )}
                </div>
                {subImportResult.errors.length > 0 && (
                  <div className="rounded-md bg-destructive/5 border border-destructive/20 p-3 space-y-1 max-h-40 overflow-y-auto">
                    {subImportResult.errors.map((e, i) => (
                      <p key={i} className="text-xs text-destructive font-mono">{e}</p>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

        </CardContent>
      </Card>

      {/* ===== Data Export (Members + Subscriptions) ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
              <Download className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">
                {isAr ? "تصدير البيانات" : "Export Data"}
              </CardTitle>
              <CardDescription>
                {isAr
                  ? "تصدير قوائم الأعضاء والاشتراكات إلى ملفات Excel."
                  : "Export member lists and subscriptions to Excel files."}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Members Export */}
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <FileSpreadsheet className="h-3.5 w-3.5 text-primary" />
                {L.expMembers}
              </p>
              <p className="text-xs text-muted-foreground">{L.expMembersD}</p>
              <Button
                onClick={handleExportMembers}
                disabled={isExportingMembers}
                variant="outline"
                className="gap-2 w-full"
                data-testid="button-export-members"
              >
                {isExportingMembers ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isExportingMembers ? L.exporting : L.expMembersBtn}
              </Button>
            </div>
            {/* Subscriptions Export */}
            <div className="space-y-2">
              <p className="text-sm font-semibold flex items-center gap-2">
                <Receipt className="h-3.5 w-3.5 text-primary" />
                {L.expSubs}
              </p>
              <p className="text-xs text-muted-foreground">{L.expSubsD}</p>
              <Button
                onClick={handleExportSubs}
                disabled={isExportingSubs}
                variant="outline"
                className="gap-2 w-full"
                data-testid="button-export-subscriptions"
              >
                {isExportingSubs ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                {isExportingSubs ? L.exporting : L.expSubsBtn}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ===== Backup & Restore ===== */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center ring-1 ring-primary/20">
              <DatabaseBackup className="h-4 w-4" />
            </div>
            <div>
              <CardTitle className="text-lg">{L.backupTitle}</CardTitle>
              <CardDescription>{L.backupDesc}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/30 p-4 text-sm text-muted-foreground space-y-1.5">
            <p>{L.backupIncl}</p>
            <ul className="list-disc list-inside space-y-1">
              <li>{L.backupAllM}</li>
              <li>{L.backupAllS}</li>
              <li>{L.backupUsers}</li>
            </ul>
            <p className="pt-1 text-xs">{L.backupNote}</p>
          </div>
          <Button onClick={handleBackup} disabled={isBackingUp} variant="outline" className="gap-2">
            {isBackingUp ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isBackingUp ? L.exporting : L.exportBackup}
          </Button>
        </CardContent>
      </Card>

      {/* ===== User Dialog ===== */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingUser ? L.editUser : L.addUserNew}</DialogTitle>
          </DialogHeader>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>{L.username}</Label>
              <Input {...form.register("username")} />
              {form.formState.errors.username && (
                <p className="text-sm text-destructive">{form.formState.errors.username.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{editingUser ? L.pwdEdit : L.pwd}</Label>
              <Input type="password" {...form.register("password")} />
              {form.formState.errors.password && (
                <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>{L.role}</Label>
              <Select
                defaultValue={form.getValues("role")}
                onValueChange={(val: any) => form.setValue("role", val)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={L.pickRole} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{L.admin}</SelectItem>
                  <SelectItem value="employee">{L.employee}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button
              type="submit"
              className="w-full"
              disabled={createUserMutation.isPending || updateUserMutation.isPending}
            >
              {(createUserMutation.isPending || updateUserMutation.isPending) && (
                <Loader2 className="ms-2 h-4 w-4 animate-spin" />
              )}
              {editingUser ? L.save : L.add}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
