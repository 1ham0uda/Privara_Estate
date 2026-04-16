import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Language = 'en' | 'ar';
type TranslationVars = Record<string, string | number | null | undefined>;

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, vars?: TranslationVars) => string;
  isRTL: boolean;
}

const STORAGE_KEY = 'privara_language';

const translations: Record<Language, Record<string, string>> = {
  en: {
    // Auth
    'auth.email': 'Email',
    'auth.password': 'Password',
    'auth.full_name': 'Full Name',
    'auth.signin_title': 'Sign in to your account',
    'auth.signin_button': 'Sign In',
    'auth.login_subtitle': 'Secure consultation management',
    'auth.register_title': 'Create your account',
    'auth.register_subtitle': 'Start your real estate consultation journey',
    'auth.register_button': 'Create Account',
    'auth.email_placeholder': 'you@example.com',
    'auth.password_placeholder': '••••••••',
    'auth.full_name_placeholder': 'John Doe',
    'auth.new_to': 'New to Privara Estate?',
    'auth.create_account': 'Create an Account',
    'auth.already_have': 'Already have an account?',
    'auth.signin_instead': 'Sign In Instead',
    'auth.agree_to': 'I agree to the',
    'auth.terms': 'Terms of Service',
    'auth.and': 'and',
    'auth.privacy': 'Privacy Policy',
    'auth.account_deactivated': 'Your account has been deactivated. Please contact support.',

    // Login errors
    'auth.login.error.invalid_credentials': 'Invalid email or password.',
    'auth.login.error.invalid_email': 'Please enter a valid email address.',
    'auth.login.error.too_many_requests': 'Too many attempts. Please try again later.',
    'auth.login.error.operation_not_allowed': 'Email login is not enabled.',
    'auth.login.error.generic': 'An error occurred. Please try again.',
    'auth.login.error.profile_missing': 'Account profile not found. Please contact support.',
    'auth.login.success': 'Signed in successfully!',

    // Register errors
    'auth.register.error.email_in_use': 'This email is already registered.',
    'auth.register.error.invalid_email': 'Please enter a valid email address.',
    'auth.register.error.weak_password': 'Password must be at least 6 characters.',
    'auth.register.error.operation_not_allowed': 'Registration is not enabled.',
    'auth.register.error.generic': 'Registration failed. Please try again.',
    'auth.register.error.profile_sync_failed': 'Account created but profile sync failed. Please contact support.',

    // Verify email
    'auth.verify_email.title': 'Verify your email',
    'auth.verify_email.subtitle': 'We sent a verification link to your email address.',
    'auth.verify_email.sent': 'Verification email sent. Check your inbox.',
    'auth.verify_email.sent_to': 'Verification sent to',
    'auth.verify_email.resend': 'Resend Email',
    'auth.verify_email.resend_success': 'Verification email sent!',
    'auth.verify_email.resend_error': 'Failed to send verification email.',
    'auth.verify_email.ive_verified': "I've Verified",
    'auth.verify_email.checking': 'Checking...',
    'auth.verify_email.not_verified_yet': 'Email not verified yet. Please check your inbox.',
    'auth.verify_email.cooldown': 'Wait {seconds}s',
    'auth.verify_email.use_different': 'Use a different account',
    'auth.verify_email.required': 'Please verify your email first.',

    // Forgot password
    'auth.forgotPassword.title': 'Reset Password',
    'auth.forgotPassword.subtitle': "Enter your email and we'll send a reset link.",
    'auth.forgotPassword.submit': 'Send Reset Link',
    'auth.forgotPassword.success': 'If an account exists, a reset email was sent.',
    'auth.forgotPassword.link': 'Forgot password?',
    'auth.forgotPassword.email_placeholder': 'Enter your email',
    'auth.forgotPassword.error.invalid_email': 'Please enter a valid email.',
    'auth.forgotPassword.error.too_many_requests': 'Too many attempts. Try again later.',
    'auth.forgotPassword.error.generic': 'Something went wrong. Try again.',

    // Navigation
    'nav.home': 'Home',
    'nav.dashboard': 'Dashboard',
    'nav.cases': 'Cases',
    'nav.profile': 'Profile',
    'nav.support': 'Support',
    'nav.staff': 'Staff',
    'nav.clients': 'Clients',
    'nav.notifications': 'Notifications',
    'nav.settings': 'Settings',
    'nav.logout': 'Sign Out',

    // Common
    'common.loading': 'Loading...',
    'common.save': 'Save',
    'common.cancel': 'Cancel',
    'common.delete': 'Delete',
    'common.edit': 'Edit',
    'common.back': 'Back',
    'common.submit': 'Submit',
    'common.search': 'Search',
    'common.filter': 'Filter',
    'common.all': 'All',
    'common.active': 'Active',
    'common.completed': 'Completed',
    'common.pending': 'Pending',
    'common.status': 'Status',
    'common.empty': 'No items found',
    'common.error': 'Something went wrong',
    'common.retry': 'Retry',
    'common.confirm': 'Confirm',
    'common.close': 'Close',
    'common.open': 'Open',
    'common.yes': 'Yes',
    'common.no': 'No',

    // Dashboard
    'dashboard.welcome': 'Welcome back',
    'dashboard.active_cases': 'Active Cases',
    'dashboard.completed_cases': 'Completed Cases',
    'dashboard.total_cases': 'Total Cases',
    'dashboard.unassigned': 'Unassigned',
    'dashboard.total_staff': 'Total Staff',
    'dashboard.avg_rating': 'Avg. Rating',
    'dashboard.no_cases': 'No cases yet',
    'dashboard.start_consultation': 'Start a Consultation',

    // Cases
    'case.status.new': 'New',
    'case.status.assigned': 'Assigned',
    'case.status.active': 'Active',
    'case.status.waiting_for_client': 'Waiting for Client',
    'case.status.waiting_for_consultant': 'Waiting for Consultant',
    'case.status.report_sent': 'Report Sent',
    'case.status.completed': 'Completed',
    'case.status.reassigned': 'Reassigned',
    'case.stage.intake': 'Intake',
    'case.stage.need_analysis': 'Need Analysis',
    'case.stage.shortlisting': 'Shortlisting',
    'case.stage.comparison': 'Comparison',
    'case.stage.meeting': 'Meeting',
    'case.stage.final_recommendation': 'Final Recommendation',
    'case.stage.closure': 'Closure',
    'case.case_number': 'Case',
    'case.view_details': 'View Details',
    'case.chat': 'Chat',
    'case.consultant': 'Consultant',
    'case.no_consultant': 'Not yet assigned',
    'case.goal': 'Goal',
    'case.preferred_area': 'Preferred Area',
    'case.budget_range': 'Budget Range',
    'case.property_type': 'Property Type',
    'case.delivery_time': 'Delivery Time',
    'case.notes': 'Notes',
    'case.projects_in_mind': 'Projects in Mind',
    'case.intake_info': 'Intake Information',
    'case.report': 'Report',
    'case.report_pending': 'Report pending',
    'case.download_report': 'Download Report',
    'case.internal_notes': 'Internal Notes',
    'case.tags': 'Tags',
    'case.rate': 'Rate',
    'case.rating': 'Rating',
    'case.feedback': 'Feedback',
    'case.submit_rating': 'Submit Rating',
    'case.request_change': 'Request Consultant Change',
    'case.change_reason': 'Reason for change',
    'case.change_pending': 'Change request pending',
    'case.mark_completed': 'Mark Completed',
    'case.upload_report': 'Upload Report',
    'case.upload_recording': 'Upload Meeting Recording',
    'case.update_status': 'Update Status',
    'case.update_stage': 'Update Stage',

    // Intake form
    'intake.title': 'New Consultation',
    'intake.goal_label': 'Goal',
    'intake.goal.living': 'Living',
    'intake.goal.investment': 'Investment',
    'intake.goal.resale': 'Resale',
    'intake.preferred_area': 'Preferred Area',
    'intake.budget_range': 'Budget Range',
    'intake.property_type': 'Property Type',
    'intake.delivery_time': 'Preferred Delivery Time',
    'intake.projects': 'Projects in Mind (optional)',
    'intake.notes': 'Additional Notes',
    'intake.select_consultant': 'Select a Consultant (optional)',
    'intake.assign_later': 'Admin will assign later',
    'intake.proceed_to_payment': 'Proceed to Payment',

    // Payment
    'payment.title': 'Payment',
    'payment.fee': 'Consultation Fee',
    'payment.secure': 'Secure payment via Geidea',
    'payment.pay_now': 'Pay Now',
    'payment.success': 'Payment successful!',
    'payment.failed': 'Payment failed. Please try again.',

    // Support
    'support.title': 'Support',
    'support.new_ticket': 'New Ticket',
    'support.subject': 'Subject',
    'support.message': 'Message',
    'support.send': 'Send',
    'support.no_tickets': 'No support tickets',
    'support.reply': 'Reply',
    'support.close_ticket': 'Close Ticket',
    'support.status.open': 'Open',
    'support.status.closed': 'Closed',
    'support.status.resolved': 'Resolved',

    // Profile
    'profile.title': 'Profile',
    'profile.display_name': 'Display Name',
    'profile.phone': 'Phone Number',
    'profile.location': 'Location',
    'profile.save_changes': 'Save Changes',
    'profile.saved': 'Profile updated!',
    'profile.language': 'Language',

    // Notifications
    'notifications.title': 'Notifications',
    'notifications.empty': 'No notifications',
    'notifications.mark_read': 'Mark as read',

    // Admin
    'admin.staff.title': 'Staff Management',
    'admin.staff.add': 'Add Staff',
    'admin.clients.title': 'Client Management',
    'admin.assign_consultant': 'Assign Consultant',
    'admin.assign_quality': 'Assign Quality Specialist',
    'admin.settings': 'Settings',
    'admin.consultation_fee': 'Consultation Fee',
    'admin.export': 'Export CSV',

    // Quality
    'quality.audit': 'Quality Audit',
    'quality.classification': 'Classification',
    'quality.meeting_status': 'Meeting Status',
    'quality.submit_audit': 'Submit Audit Report',
    'quality.critical': 'Critical',
    'quality.non_critical': 'Non-Critical',
    'quality.recorded': 'Recorded',
    'quality.not_recorded': 'Not Recorded',
    'quality.failed': 'Failed',

    // Consultant
    'consultant.experience': 'Years of Experience',
    'consultant.specialties': 'Specialties',
    'consultant.completed': 'Completed Consultations',
    'consultant.bio': 'Bio',
    'consultant.summary': 'Professional Summary',
  },
  ar: {
    // Auth
    'auth.email': 'البريد الإلكتروني',
    'auth.password': 'كلمة المرور',
    'auth.full_name': 'الاسم الكامل',
    'auth.signin_title': 'تسجيل الدخول',
    'auth.signin_button': 'تسجيل الدخول',
    'auth.login_subtitle': 'إدارة الاستشارات الآمنة',
    'auth.register_title': 'إنشاء حساب',
    'auth.register_subtitle': 'ابدأ رحلة استشارتك العقارية',
    'auth.register_button': 'إنشاء حساب',
    'auth.email_placeholder': 'you@example.com',
    'auth.password_placeholder': '••••••••',
    'auth.full_name_placeholder': 'الاسم الكامل',
    'auth.new_to': 'جديد في بريفارا إستيت؟',
    'auth.create_account': 'إنشاء حساب',
    'auth.already_have': 'لديك حساب بالفعل؟',
    'auth.signin_instead': 'تسجيل الدخول',
    'auth.agree_to': 'أوافق على',
    'auth.terms': 'شروط الخدمة',
    'auth.and': 'و',
    'auth.privacy': 'سياسة الخصوصية',
    'auth.account_deactivated': 'تم تعطيل حسابك. يرجى الاتصال بالدعم.',

    'auth.login.error.invalid_credentials': 'بريد إلكتروني أو كلمة مرور غير صالحة.',
    'auth.login.error.invalid_email': 'يرجى إدخال بريد إلكتروني صالح.',
    'auth.login.error.too_many_requests': 'محاولات كثيرة جداً. حاول لاحقاً.',
    'auth.login.error.operation_not_allowed': 'تسجيل الدخول بالبريد غير مفعل.',
    'auth.login.error.generic': 'حدث خطأ. حاول مرة أخرى.',
    'auth.login.error.profile_missing': 'لم يتم العثور على الملف الشخصي.',
    'auth.login.success': 'تم تسجيل الدخول!',

    'auth.register.error.email_in_use': 'هذا البريد مسجل بالفعل.',
    'auth.register.error.invalid_email': 'بريد إلكتروني غير صالح.',
    'auth.register.error.weak_password': 'كلمة المرور ضعيفة (6 أحرف على الأقل).',
    'auth.register.error.operation_not_allowed': 'التسجيل غير مفعل.',
    'auth.register.error.generic': 'فشل التسجيل. حاول مرة أخرى.',
    'auth.register.error.profile_sync_failed': 'تم إنشاء الحساب لكن فشل مزامنة الملف الشخصي.',

    'auth.verify_email.title': 'تحقق من بريدك الإلكتروني',
    'auth.verify_email.subtitle': 'أرسلنا رابط تحقق إلى بريدك الإلكتروني.',
    'auth.verify_email.sent': 'تم إرسال بريد التحقق.',
    'auth.verify_email.sent_to': 'تم إرسال التحقق إلى',
    'auth.verify_email.resend': 'إعادة إرسال',
    'auth.verify_email.resend_success': 'تم إرسال بريد التحقق!',
    'auth.verify_email.resend_error': 'فشل إرسال بريد التحقق.',
    'auth.verify_email.ive_verified': 'لقد تحققت',
    'auth.verify_email.checking': 'جارٍ التحقق...',
    'auth.verify_email.not_verified_yet': 'لم يتم التحقق بعد.',
    'auth.verify_email.cooldown': 'انتظر {seconds}ث',
    'auth.verify_email.use_different': 'استخدام حساب مختلف',
    'auth.verify_email.required': 'يرجى التحقق من بريدك أولاً.',

    'auth.forgotPassword.title': 'إعادة تعيين كلمة المرور',
    'auth.forgotPassword.subtitle': 'أدخل بريدك وسنرسل رابط إعادة التعيين.',
    'auth.forgotPassword.submit': 'إرسال رابط',
    'auth.forgotPassword.success': 'إذا كان الحساب موجوداً، تم إرسال رابط.',
    'auth.forgotPassword.link': 'نسيت كلمة المرور؟',
    'auth.forgotPassword.email_placeholder': 'أدخل بريدك الإلكتروني',
    'auth.forgotPassword.error.invalid_email': 'بريد إلكتروني غير صالح.',
    'auth.forgotPassword.error.too_many_requests': 'محاولات كثيرة. حاول لاحقاً.',
    'auth.forgotPassword.error.generic': 'حدث خطأ. حاول مرة أخرى.',

    'nav.home': 'الرئيسية',
    'nav.dashboard': 'لوحة التحكم',
    'nav.cases': 'القضايا',
    'nav.profile': 'الملف الشخصي',
    'nav.support': 'الدعم',
    'nav.staff': 'الموظفون',
    'nav.clients': 'العملاء',
    'nav.notifications': 'الإشعارات',
    'nav.settings': 'الإعدادات',
    'nav.logout': 'تسجيل الخروج',

    'common.loading': 'جارٍ التحميل...',
    'common.save': 'حفظ',
    'common.cancel': 'إلغاء',
    'common.delete': 'حذف',
    'common.edit': 'تعديل',
    'common.back': 'رجوع',
    'common.submit': 'إرسال',
    'common.search': 'بحث',
    'common.filter': 'تصفية',
    'common.all': 'الكل',
    'common.active': 'نشط',
    'common.completed': 'مكتمل',
    'common.pending': 'معلق',
    'common.status': 'الحالة',
    'common.empty': 'لا توجد عناصر',
    'common.error': 'حدث خطأ',
    'common.retry': 'إعادة المحاولة',
    'common.confirm': 'تأكيد',
    'common.close': 'إغلاق',
    'common.open': 'فتح',
    'common.yes': 'نعم',
    'common.no': 'لا',

    'dashboard.welcome': 'مرحباً',
    'dashboard.active_cases': 'القضايا النشطة',
    'dashboard.completed_cases': 'القضايا المكتملة',
    'dashboard.total_cases': 'إجمالي القضايا',
    'dashboard.unassigned': 'غير معيّنة',
    'dashboard.total_staff': 'إجمالي الموظفين',
    'dashboard.avg_rating': 'متوسط التقييم',
    'dashboard.no_cases': 'لا توجد قضايا بعد',
    'dashboard.start_consultation': 'ابدأ استشارة',

    'case.status.new': 'جديد',
    'case.status.assigned': 'معيّن',
    'case.status.active': 'نشط',
    'case.status.waiting_for_client': 'بانتظار العميل',
    'case.status.waiting_for_consultant': 'بانتظار المستشار',
    'case.status.report_sent': 'تم إرسال التقرير',
    'case.status.completed': 'مكتمل',
    'case.status.reassigned': 'أُعيد تعيينه',
    'case.stage.intake': 'استقبال',
    'case.stage.need_analysis': 'تحليل الاحتياجات',
    'case.stage.shortlisting': 'القائمة المختصرة',
    'case.stage.comparison': 'المقارنة',
    'case.stage.meeting': 'اجتماع',
    'case.stage.final_recommendation': 'التوصية النهائية',
    'case.stage.closure': 'إغلاق',
    'case.case_number': 'قضية',
    'case.view_details': 'عرض التفاصيل',
    'case.chat': 'محادثة',
    'case.consultant': 'المستشار',
    'case.no_consultant': 'لم يتم التعيين بعد',
    'case.goal': 'الهدف',
    'case.preferred_area': 'المنطقة المفضلة',
    'case.budget_range': 'نطاق الميزانية',
    'case.property_type': 'نوع العقار',
    'case.delivery_time': 'وقت التسليم',
    'case.notes': 'ملاحظات',
    'case.projects_in_mind': 'مشاريع في البال',
    'case.intake_info': 'معلومات الاستقبال',
    'case.report': 'التقرير',
    'case.report_pending': 'التقرير قيد الانتظار',
    'case.download_report': 'تحميل التقرير',
    'case.internal_notes': 'ملاحظات داخلية',
    'case.tags': 'علامات',
    'case.rate': 'تقييم',
    'case.rating': 'التقييم',
    'case.feedback': 'ملاحظات',
    'case.submit_rating': 'إرسال التقييم',
    'case.request_change': 'طلب تغيير المستشار',
    'case.change_reason': 'سبب التغيير',
    'case.change_pending': 'طلب التغيير معلق',
    'case.mark_completed': 'وضع علامة مكتمل',
    'case.upload_report': 'رفع التقرير',
    'case.upload_recording': 'رفع تسجيل الاجتماع',
    'case.update_status': 'تحديث الحالة',
    'case.update_stage': 'تحديث المرحلة',

    'intake.title': 'استشارة جديدة',
    'intake.goal_label': 'الهدف',
    'intake.goal.living': 'سكن',
    'intake.goal.investment': 'استثمار',
    'intake.goal.resale': 'إعادة بيع',
    'intake.preferred_area': 'المنطقة المفضلة',
    'intake.budget_range': 'نطاق الميزانية',
    'intake.property_type': 'نوع العقار',
    'intake.delivery_time': 'وقت التسليم المفضل',
    'intake.projects': 'مشاريع في البال (اختياري)',
    'intake.notes': 'ملاحظات إضافية',
    'intake.select_consultant': 'اختر مستشاراً (اختياري)',
    'intake.assign_later': 'الإدارة ستعيّن لاحقاً',
    'intake.proceed_to_payment': 'المتابعة للدفع',

    'payment.title': 'الدفع',
    'payment.fee': 'رسوم الاستشارة',
    'payment.secure': 'دفع آمن عبر جيديا',
    'payment.pay_now': 'ادفع الآن',
    'payment.success': 'تم الدفع بنجاح!',
    'payment.failed': 'فشل الدفع. حاول مرة أخرى.',

    'support.title': 'الدعم',
    'support.new_ticket': 'تذكرة جديدة',
    'support.subject': 'الموضوع',
    'support.message': 'الرسالة',
    'support.send': 'إرسال',
    'support.no_tickets': 'لا توجد تذاكر دعم',
    'support.reply': 'رد',
    'support.close_ticket': 'إغلاق التذكرة',
    'support.status.open': 'مفتوحة',
    'support.status.closed': 'مغلقة',
    'support.status.resolved': 'تم الحل',

    'profile.title': 'الملف الشخصي',
    'profile.display_name': 'الاسم',
    'profile.phone': 'رقم الهاتف',
    'profile.location': 'الموقع',
    'profile.save_changes': 'حفظ التغييرات',
    'profile.saved': 'تم تحديث الملف الشخصي!',
    'profile.language': 'اللغة',

    'notifications.title': 'الإشعارات',
    'notifications.empty': 'لا توجد إشعارات',
    'notifications.mark_read': 'وضع كمقروء',

    'admin.staff.title': 'إدارة الموظفين',
    'admin.staff.add': 'إضافة موظف',
    'admin.clients.title': 'إدارة العملاء',
    'admin.assign_consultant': 'تعيين مستشار',
    'admin.assign_quality': 'تعيين أخصائي جودة',
    'admin.settings': 'الإعدادات',
    'admin.consultation_fee': 'رسوم الاستشارة',
    'admin.export': 'تصدير CSV',

    'quality.audit': 'تدقيق الجودة',
    'quality.classification': 'التصنيف',
    'quality.meeting_status': 'حالة الاجتماع',
    'quality.submit_audit': 'إرسال تقرير التدقيق',
    'quality.critical': 'حرج',
    'quality.non_critical': 'غير حرج',
    'quality.recorded': 'مسجل',
    'quality.not_recorded': 'غير مسجل',
    'quality.failed': 'فشل',

    'consultant.experience': 'سنوات الخبرة',
    'consultant.specialties': 'التخصصات',
    'consultant.completed': 'الاستشارات المكتملة',
    'consultant.bio': 'نبذة',
    'consultant.summary': 'الملخص المهني',
  },
};

const LanguageContext = createContext<LanguageContextType>({
  language: 'en',
  setLanguage: () => {},
  t: (key) => key,
  isRTL: false,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored === 'ar' || stored === 'en') setLanguageState(stored);
    });
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    AsyncStorage.setItem(STORAGE_KEY, lang);
  };

  const t = (key: string, vars?: TranslationVars): string => {
    let value = translations[language][key] || translations.en[key] || key;
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        value = value.replace(`{${k}}`, String(v ?? ''));
      });
    }
    return value;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isRTL: language === 'ar' }}>
      {children}
    </LanguageContext.Provider>
  );
}

export const useLanguage = () => useContext(LanguageContext);
