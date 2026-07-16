'use client';

import { useState, useEffect, Suspense, useRef } from 'react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import Navbar from "@/components/Navbar";
import Switch from "@/components/Switch";
import api, { setAccessToken } from "@/lib/api";
import { getImageUrl } from "@/lib/utils";
import { useAuth } from "@/context/AuthContext";
import ConfirmModal from "@/components/ui/ConfirmModal";
import { useToast } from "@/context/ToastContext";
import {
    User, Shield, Gamepad2, Bell, EyeOff, Lock, Trash2, Monitor, Twitch, Globe, 
    FileText, HelpCircle, ChevronRight, ExternalLink, MessageCircle, Bug, Zap, Play, 
    Loader2, X, Search, Check, AlertTriangle, Info, Send, UserX, ChevronDown
} from 'lucide-react';

interface CustomSelectOption {
    value: string;
    label: string;
}

interface CustomSelectProps {
    value: string;
    onChange: (val: string) => void;
    options: CustomSelectOption[];
    activeColor: any;
    placeholder?: string;
}

function CustomSelect({
    value,
    onChange,
    options,
    activeColor,
    placeholder = "Select..."
}: CustomSelectProps) {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, []);

    const selectedOption = options.find(opt => opt.value === value);

    return (
        <div className="relative w-full" ref={dropdownRef}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className={`w-full flex items-center justify-between bg-zinc-950 border border-zinc-800 rounded-lg py-3 px-4 text-sm font-semibold transition-all duration-200 focus:outline-none ${
                    isOpen
                        ? `border-zinc-700 ring-1 ${activeColor?.ring || 'ring-emerald-500/50'}`
                        : 'border-zinc-800 text-zinc-300 hover:border-zinc-700'
                }`}
            >
                <span className="text-zinc-200 font-semibold">
                    {selectedOption ? selectedOption.label : placeholder}
                </span>
                <ChevronDown className={`h-4 w-4 text-zinc-500 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>

            {isOpen && (
                <div className="absolute top-full left-0 mt-2 w-full bg-zinc-950 border border-zinc-800 rounded-lg shadow-2xl shadow-black/80 overflow-hidden z-50 p-1">
                    {options.map((option) => (
                        <button
                            key={option.value}
                            type="button"
                            onClick={() => {
                                onChange(option.value);
                                setIsOpen(false);
                            }}
                            className={`w-full flex items-center justify-between text-left px-3 py-2.5 rounded-md text-sm transition-colors ${
                                value === option.value
                                    ? `bg-zinc-900 ${activeColor?.text || 'text-emerald-400'} font-bold`
                                    : 'text-zinc-300 hover:bg-zinc-900 hover:text-white'
                            }`}
                        >
                            {option.label}
                            {value === option.value && <Check className={`h-4 w-4 ${activeColor?.text || 'text-emerald-400'}`} />}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}


const colors = {
    Emerald: {
        text: 'text-emerald-400',
        borderAccent: 'border-emerald-500/20',
        bg: 'bg-emerald-600',
        hover: 'hover:bg-emerald-500',
        bgLight: 'bg-emerald-500/5',
        accentRange: 'accent-emerald-500',
        selection: 'selection:bg-emerald-500/30',
        ring: 'focus:ring-emerald-500/50',
        borderFocus: 'focus:border-emerald-500/50',
        switchBg: 'bg-emerald-500',
        textMuted: 'text-emerald-500/80',
    },
    Blue: {
        text: 'text-blue-400',
        borderAccent: 'border-blue-500/20',
        bg: 'bg-blue-600',
        hover: 'hover:bg-blue-500',
        bgLight: 'bg-blue-500/5',
        accentRange: 'accent-blue-500',
        selection: 'selection:bg-blue-500/30',
        ring: 'focus:ring-blue-500/50',
        borderFocus: 'focus:border-blue-500/50',
        switchBg: 'bg-blue-500',
        textMuted: 'text-blue-500/80',
    },
    Purple: {
        text: 'text-purple-400',
        borderAccent: 'border-purple-500/20',
        bg: 'bg-purple-600',
        hover: 'hover:bg-purple-500',
        bgLight: 'bg-purple-500/5',
        accentRange: 'accent-purple-500',
        selection: 'selection:bg-purple-500/30',
        ring: 'focus:ring-purple-500/50',
        borderFocus: 'focus:border-purple-500/50',
        switchBg: 'bg-purple-500',
        textMuted: 'text-purple-500/80',
    },
    Orange: {
        text: 'text-orange-400',
        borderAccent: 'border-orange-500/20',
        bg: 'bg-orange-600',
        hover: 'hover:bg-orange-500',
        bgLight: 'bg-orange-500/5',
        accentRange: 'accent-orange-500',
        selection: 'selection:bg-orange-500/30',
        ring: 'focus:ring-orange-500/50',
        borderFocus: 'focus:border-orange-500/50',
        switchBg: 'bg-orange-500',
        textMuted: 'text-orange-500/80',
    }
};

const translations = {
    English: {
        settings: "Settings",
        myAccount: "My Account",
        connectedAccounts: "Connected Accounts",
        privacySafety: "Privacy & Safety",
        contentPreferences: "Content Preferences",
        notifications: "Notifications",
        displayLanguages: "Display & Languages",
        additionalResources: "Additional Resources",
        helpCenter: "Help Center",
        username: "Username",
        email: "Email",
        saveProfileChanges: "Save Profile Changes",
        saving: "Saving...",
        changePassword: "Change Password",
        dangerZone: "Danger Zone",
        deleteAccountMsg: "Once you delete your account, there is no going back. Please be certain.",
        deleteAccount: "Delete Account",
        connectedAccountsDesc: "Connect your gaming accounts to display your library and achievements.",
        connect: "Connect",
        disconnect: "Disconnect",
        steamDesc: "Sync your Steam library and achievements.",
        psnDesc: "Connect your PSN account.",
        xboxDesc: "Connect your Xbox Live account.",
        twitchDesc: "Connect your Twitch account.",
        epicDesc: "Sync your Epic Games library.",
        gogDesc: "Sync your GOG Galaxy library.",
        eaDesc: "Sync your EA App library.",
        privateProfile: "Private Profile",
        privateProfileDesc: "Only followers can see your profile and activity.",
        allowDms: "Allow Direct Messages",
        allowDmsDesc: "Allow people you follow to send you messages.",
        shareActivity: "Share Game Activity",
        shareActivityDesc: "Automatically display the game you are currently playing.",
        blurSpoilers: "Blur Spoilers",
        blurSpoilersDesc: "Automatically hide reviews and posts tagged as spoilers.",
        showMatureContent: "Show Mature Content",
        showMatureContentDesc: "Display 18+ games and content in your feed.",
        newFollowers: "New Followers",
        newFollowersDesc: "Notify me when someone follows me.",
        mentions: "Mentions",
        mentionsDesc: "Notify me when I'm mentioned in a post or comment.",
        jobAlerts: "Job Alerts",
        jobAlertsDesc: "Notify me about new developer roles matching my skills.",
        language: "Language",
        fontSize: "Font Size",
        accentColor: "Accent Color",
        aboutGamelogd: "About Gamelogd",
        tos: "Terms of Service",
        privacyPolicy: "Privacy Policy",
        cookiePolicy: "Cookie Policy",
        blog: "Blog",
        browseFaqs: "Browse FAQs",
        browseFaqsDesc: "Find answers to common questions about Gamelogd.",
        contactSupport: "Contact Support",
        contactSupportDesc: "Get in touch with our support team for assistance.",
        reportProblem: "Report a Problem",
        reportProblemDesc: "Found a bug? Let us know so we can fix it.",
        currentPassword: "Current Password",
        newPassword: "New Password",
        confirmNewPassword: "Confirm New Password",
        cancel: "Cancel",
        updatePassword: "Update Password",
        deleteAccountConfirmTitle: "Delete Account permanently?",
        deleteAccountConfirmDesc: "This operation cannot be undone. All your synced libraries, devlogs, game DNA profiles, and social follow networks will be deleted from Gamelogd server databases permanently.",
        keepAccount: "Keep My Account",
        yesDeleteAccount: "Yes, Delete My Account",
        connectTitle: "Connect",
        gamerIdLabel: "Gamer ID / Username",
        connectModalPlaceholder: "Enter your ID...",
        connectModalHelp: "This will showcase your connected status on your profile. Libraries sync automatically where API parameters permit.",
        saveConnection: "Save Connection",
        done: "Done",
        faqsTitle: "Frequently Asked Questions",
        searchPlaceholder: "Search answers...",
        all: "All",
        closeFaqs: "Close FAQs",
        categoryLabel: "Category",
        subjectLabel: "Subject",
        descriptionLabel: "Description",
        subjectPlaceholder: "Brief summary of your request...",
        descPlaceholder: "Explain your request in detail...",
        submitRequest: "Submit Request",
        bugTitleLabel: "Bug Title",
        bugTitlePlaceholder: "e.g. Steam sync button returns 500 error",
        severityLabel: "Severity",
        stepsLabel: "Steps to Reproduce",
        stepsPlaceholder: "1. Click Connected Accounts\n2. Input Steam ID 64\n3. Click Sync...",
        bugDescPlaceholder: "Provide any additional specifications or logs...",
        submitBug: "Submit Bug Report",
        successSaveProfile: "Profile updated successfully!",
        errorFields: "Username and email are required!",
        successSteamSync: "Steam library syncing started! It may take a few minutes to complete.",
        errorSteamSync: "Failed to sync Steam account. Please check your ID.",
        confirmSteamDisconnect: "Are you sure you want to disconnect Steam? This will remove your synced games.",
        successSteamDisconnect: "Steam disconnected successfully.",
        confirmUnblockTitle: "Unblock User",
        confirmUnblockMsg: "Are you sure you want to unblock @{username}?",
        successPlatformUpdate: "account updated successfully!",
        errorPlatformUpdate: "Failed to save connection config.",
        confirmPlatformDisconnect: "Are you sure you want to disconnect",
        successPlatformDisconnect: "disconnected.",
        errorPasswordsMatch: "New passwords do not match!",
        successPasswordChange: "Password changed successfully!",
        errorPasswordChange: "Incorrect current password or invalid new password.",
        successDeleteAccount: "Your account has been deleted. Goodbye!",
        errorDeleteAccount: "Failed to delete account. Please try again.",
        successSupportSubmit: "Support request submitted successfully! Our team will reach out via email.",
        errorSupportSubmit: "Failed to submit support ticket.",
        successBugSubmit: "Bug report submitted successfully! Thank you for helping us improve Gamelogd.",
        errorBugSubmit: "Failed to submit bug report.",
        realName: "Real Name",
        bio: "Bio",
        location: "Location",
        phoneNumber: "Phone Number",
        gender: "Gender",
        genderMale: "Male",
        genderFemale: "Female",
        genderNonBinary: "Non-binary",
        genderPreferNotToSay: "Prefer not to say",
        selectGender: "Select Gender",
        birthDate: "Birth Date",
        showBirthDate: "Show Birth Date on Profile",
        roles: "Roles",
        gamer: "Gamer",
        developer: "Developer",
        investor: "Investor",
        aboutContent: "Gamelogd is a next-generation social network tailored specifically for game enthusiasts, indie developers, and venture investors. Our platform empowers gamers to sync their libraries, catalog playtimes, and discover tailored suggestions. Developers can host development logs (Devlogs) for their games, coordinate project teams, and promote open roles. Investors can browse game pitches, analyze genre DNA trends, and schedule investor meetings directly in one integrated, responsive workspace.",
        tosContent: "By utilizing Gamelogd, you agree to comply with standard platform guidelines. All content generated, including comments, game ratings, and project pitch descriptions must respect intellectual property rights and follow respectful community interaction standards. Abuse, harassment, scraping, or malicious API exploitation are strictly prohibited and will lead to swift account termination without warnings.",
        privacyContent: "Your privacy is paramount at Gamelogd. We collect registration details (username, email), optional platform integration coordinates (Steam ID, connection state toggles), and system settings. When syncing Steam libraries, we process only public game playtimes to calculate preferences and display achievements. We do not sell user data to advertising entities, and users maintain complete control over profile visibility through the Privacy & Safety control settings.",
        cookieContent: "Gamelogd utilizes essential cookies to maintain authenticated session tokens (JWT tokens) and secure persistent settings. Performance cookies may be used to load user settings preferences (accent color, font sizes) immediately on application mount. No non-essential tracking cookies are loaded without explicit choice.",
        blogContent: "Gamelogd Blog Hub:\n\n• Devlog Tools Launch (June 2026): A review of the new Project management and Devlog timeline system.\n• Understanding Game DNA (May 2026): How our system maps playtimes to create your genre distribution chart.\n• Investor Pitching Best Practices (April 2026): Tips on setting a realistic funding goal and detailing tech stacks.",
        categoryGeneral: "General Inquiry",
        categoryAccount: "Account Security",
        categoryBilling: "Billing / Subscription",
        categoryPartnership: "Investment Support",
        categoryFeedback: "Feedback & Suggestions",
        severityLow: "Low - Visual / Minor tweak",
        severityMedium: "Medium - Feature broken but workaround exists",
        severityHigh: "High - Essential feature completely broken",
        severityCritical: "Critical - App crash / data loss vulnerability",
        faqQ1: "How do I secure my Gamelogd account?",
        faqA1: "You can update your password under My Account > Account Security. We recommend using a unique password and connecting active platform profiles like Steam or Twitch.",
        faqQ2: "Can I change my username or email?",
        faqA2: "Yes, you can edit your profile details including your username under My Account section. Changing username updates your profile share URL.",
        faqQ3: "How do I sync my Steam games library?",
        faqA3: "Navigate to Connected Accounts, enter your public Steam ID 64, and click Save Connection. Make sure your Steam profile privacy state is set to Public.",
        faqQ4: "Why are some synced games not showing in library?",
        faqA4: "Syncing process may take several minutes depending on the library size. Only games with recorded playtime or achievements are imported.",
        faqQ5: "What is Game DNA?",
        faqA5: "Game DNA is Gamelogd's custom metric system that analyzes synced playtimes to generate visual distribution charts showing your favorite genres.",
        faqQ6: "How do I apply for developer jobs?",
        faqA6: "Browse open roles inside the Dev Hub. If your linked skill badges match the role requirements, you can click Apply to share your developer profile."
    },
    Turkish: {
        settings: "Ayarlar",
        myAccount: "Hesabım",
        connectedAccounts: "Bağlı Hesaplar",
        privacySafety: "Gizlilik & Güvenlik",
        contentPreferences: "İçerik Tercihleri",
        notifications: "Bildirimler",
        displayLanguages: "Görünüm & Diller",
        additionalResources: "Ek Kaynaklar",
        helpCenter: "Yardım Merkezi",
        username: "Kullanıcı Adı",
        email: "E-posta",
        saveProfileChanges: "Profil Değişikliklerini Kaydet",
        saving: "Kaydediliyor...",
        changePassword: "Şifreyi Değiştir",
        dangerZone: "Tehlikeli Bölge",
        deleteAccountMsg: "Hesabınızı sildikten sonra geri dönüş yoktur. Lütfen emin olun.",
        deleteAccount: "Hesabı Sil",
        connectedAccountsDesc: "Kütüphanenizi ve başarımlarınızı göstermek için oyun hesaplarınızı bağlayın.",
        connect: "Bağla",
        disconnect: "Bağlantıyı Kes",
        steamDesc: "Steam kütüphanenizi ve başarımlarınızı senkronize edin.",
        psnDesc: "PSN hesabınızı bağlayın.",
        xboxDesc: "Xbox Live hesabınızı bağlayın.",
        twitchDesc: "Twitch hesabınızı bağlayın.",
        epicDesc: "Epic Games kütüphanenizi senkronize edin.",
        gogDesc: "GOG Galaxy kütüphanenizi senkronize edin.",
        eaDesc: "EA App kütüphanenizi senkronize edin.",
        privateProfile: "Gizli Profil",
        privateProfileDesc: "Profilinizi ve aktivitelerinizi sadece takipçileriniz görebilir.",
        allowDms: "Doğrudan Mesajlara İzin Ver",
        allowDmsDesc: "Takip ettiğiniz kişilerin size mesaj göndermesine izin verin.",
        shareActivity: "Oyun Aktivitesini Paylaş",
        shareActivityDesc: "Oynadığınız oyunu otomatik olarak profilinizde gösterin.",
        blurSpoilers: "Spoilerları Gizle (Bulanıklaştır)",
        blurSpoilersDesc: "Spoiler olarak etiketlenen incelemeleri ve gönderileri otomatik olarak gizle.",
        showMatureContent: "Yetişkin İçeriği Göster",
        showMatureContentDesc: "Akışınızda +18 oyunları ve içerikleri gösterin.",
        newFollowers: "Yeni Takipçiler",
        newFollowersDesc: "Biri beni takip ettiğinde bildirim gönder.",
        mentions: "Bahsedilmeler",
        mentionsDesc: "Bir gönderide veya yorumda benden bahsedildiğinde bildirim gönder.",
        jobAlerts: "İş İlanı Uyarıları",
        jobAlertsDesc: "Yeteneklerime uygun yeni geliştirici rolleri hakkında bildirim gönder.",
        language: "Dil",
        fontSize: "Yazı Boyutu",
        accentColor: "Vurgu Rengi",
        aboutGamelogd: "Gamelogd Hakkında",
        tos: "Kullanım Koşulları",
        privacyPolicy: "Gizlilik Politikası",
        cookiePolicy: "Çerez Politikası",
        blog: "Blog",
        browseFaqs: "SSS Göz At",
        browseFaqsDesc: "Gamelogd hakkında sıkça sorulan soruların cevaplarını bulun.",
        contactSupport: "Destek ile İletişime Geç",
        contactSupportDesc: "Destek ekibimizle iletişime geçin.",
        reportProblem: "Hata Bildir",
        reportProblemDesc: "Bir hata mı buldunuz? Düzeltmemiz için bize bildirin.",
        currentPassword: "Mevcut Şifre",
        newPassword: "Yeni Şifre",
        confirmNewPassword: "Yeni Şifreyi Onayla",
        cancel: "İptal",
        updatePassword: "Şifreyi Güncelle",
        deleteAccountConfirmTitle: "Hesabı kalıcı olarak sil?",
        deleteAccountConfirmDesc: "Bu işlem geri alınamaz. Eşitlenen tüm kütüphaneleriniz, devlog'larınız, oyun DNA profilleriniz ve sosyal takip ağlarınız Gamelogd sunucu veritabanlarından kalıcı olarak silinecektir.",
        keepAccount: "Hesabımı Tut",
        yesDeleteAccount: "Evet, Hesabımı Sil",
        connectTitle: "Bağlan",
        gamerIdLabel: "Oyuncu Kimliği / Kullanıcı Adı",
        connectModalPlaceholder: "Kimliğinizi girin...",
        connectModalHelp: "Bu işlem, bağlanan platform durumunuzu profilinizde sergileyecektir. API izin verdiği ölçüde kütüphaneler otomatik olarak eşitlenir.",
        saveConnection: "Bağlantıyı Kaydet",
        done: "Tamam",
        faqsTitle: "Sıkça Sorulan Sorular",
        searchPlaceholder: "Cevaplarda ara...",
        all: "Hepsi",
        closeFaqs: "SSS Kapat",
        categoryLabel: "Kategori",
        subjectLabel: "Konu",
        descriptionLabel: "Açıklama",
        subjectPlaceholder: "Talebinizin kısa bir özeti...",
        descPlaceholder: "Talebinizi ayrıntılı olarak açıklayın...",
        submitRequest: "Talebi Gönder",
        bugTitleLabel: "Hata Başlığı",
        bugTitlePlaceholder: "Örn: Steam senkronizasyon butonu 500 hatası döndürüyor",
        severityLabel: "Önem Derecesi",
        stepsLabel: "Nasıl Tekrarlanır (Adımlar)",
        stepsPlaceholder: "1. Bağlı Hesaplar'a tıklayın\n2. Steam ID 64 girin\n3. Eşitle'ye tıklayın...",
        bugDescPlaceholder: "Ek özellikleri veya günlükleri sağlayın...",
        submitBug: "Hata Raporu Gönder",
        successSaveProfile: "Profil başarıyla güncellendi!",
        errorFields: "Kullanıcı adı ve e-posta gereklidir!",
        successSteamSync: "Eşleme işlemi başlatıldı. Bu işlem biraz zaman alabilir, tamamlandığında size bildirim göndereceğiz.",
        errorSteamSync: "Steam hesabı eşitlenemedi. Lütfen ID'nizi kontrol edin.",
        confirmSteamDisconnect: "Steam bağlantısını kesmek istediğinizden emin misiniz? Bu işlem eşitlenmiş oyunlarınızı kaldıracaktır.",
        successSteamDisconnect: "Steam bağlantısı başarıyla kesildi.",
        confirmUnblockTitle: "Kullanıcı Engeli Kaldır",
        confirmUnblockMsg: "@{username} kullanıcısının engelini kaldırmak istediğinizden emin misiniz?",
        successPlatformUpdate: "hesabı başarıyla güncellendi!",
        errorPlatformUpdate: "Bağlantı ayarları kaydedilemedi.",
        confirmPlatformDisconnect: "Bağlantıyı kesmek istediğinizden emin misiniz:",
        successPlatformDisconnect: "bağlantı kesildi.",
        errorPasswordsMatch: "Yeni şifreler eşleşmiyor!",
        successPasswordChange: "Şifre başarıyla değiştirildi!",
        errorPasswordChange: "Mevcut şifre yanlış veya yeni şifre geçersiz.",
        successDeleteAccount: "Hesabınız silindi. Güle güle!",
        errorDeleteAccount: "Hesap silinemedi. Lütfen tekrar deneyin.",
        successSupportSubmit: "Destek talebi başarıyla iletildi! Ekibimiz e-posta yoluyla sizinle iletişime geçecektir.",
        errorSupportSubmit: "Destek talebi iletilemedi.",
        successBugSubmit: "Hata raporu başarıyla iletildi! Gamelogd'u geliştirmemize yardımcı olduğunuz için teşekkür ederiz.",
        errorBugSubmit: "Hata raporu iletilemedi.",
        realName: "Gerçek İsim",
        bio: "Biyografi",
        location: "Konum",
        phoneNumber: "Telefon Numarası",
        gender: "Cinsiyet",
        genderMale: "Erkek",
        genderFemale: "Kadın",
        genderNonBinary: "Non-binary",
        genderPreferNotToSay: "Belirtmek istemiyorum",
        selectGender: "Cinsiyet Seçin",
        birthDate: "Doğum Tarihi",
        showBirthDate: "Doğum Tarihini Göster",
        roles: "Roller",
        gamer: "Oyuncu",
        developer: "Geliştirici",
        investor: "Yatırımcı",
        aboutContent: "Gamelogd, oyun severler, bağımsız geliştiriciler ve girişim yatırımcıları için özel olarak tasarlanmış yeni nesil bir sosyal ağdır. Platformumuz, oyuncuların kütüphanelerini eşitlemelerine, oyun sürelerini kataloglamalarına ve özel öneriler keşfetmelerine olanak tanır. Geliştiriciler oyunları için geliştirme günlükleri (Devlogs) barındırabilir, proje ekiplerini koordine edebilir ve açık rolleri tanıtabilir. Yatırımcılar ise tek bir entegre çalışma alanında oyun sunumlarına göz atabilir, tür DNA trendlerini analiz edebilir ve doğrudan yatırımcı toplantıları planlayabilir.",
        tosContent: "Gamelogd'u kullanarak standart platform kurallarına uymayı kabul etmiş olursunuz. Yorumlar, oyun derecelendirmeleri ve proje sunum açıklamaları dahil olmak üzere oluşturulan tüm içerikler fikri mülkiyet haklarına saygı duymalı ve topluluk etkileşim standartlarına uygun olmalıdır. Kötüye kullanım, taciz veya kötü niyetli API kullanımı kesinlikle yasaktır ve hesapların uyarısız kapatılmasına yol açacaktır.",
        privacyContent: "Gizliliğiniz Gamelogd için son derece önemlidir. Kayıt bilgilerini (kullanıcı adı, e-posta), isteğe bağlı platform entegrasyon koordinatlarını (Steam ID, bağlantı durumu anahtarları) ve sistem ayarlarını toplarız. Steam kütüphanelerini eşitlerken, yalnızca tercihleri hesaplamak ve başarımları göstermek için herkese açık oyun sürelerini işleriz. Kullanıcı verilerini reklam şirketlerine satmayız ve kullanıcılar Gizlilik & Güvenlik ayarları aracılığıyla profil görünürlüğünü tamamen kontrol edebilirler.",
        cookieContent: "Gamelogd, oturumlarınızı (JWT) sürdürmek ve ayarları güvenli şekilde saklamak için gerekli çerezleri kullanır. Görünüm ayarlarını (vurgu rengi, yazı tipi boyutları) hemen yüklemek için tercih çerezleri kullanılabilir. İsteğe bağlı hiçbir takip çerezi onayınız olmadan yüklenmez.",
        blogContent: "Gamelogd Blog Merkezi:\n\n• Devlog Araçları Yayında (Haziran 2026): Yeni Proje yönetimi ve Devlog zaman akışı sistemine genel bir bakış.\n• Oyun DNA'sını Anlamak (Mayıs 2026): Sistemimizin oyun sürelerini tür dağılım şemasına nasıl dönüştürdüğü.\n• Yatırımcı Sunumu En İyi Uygulamaları (Nisan 2026): Gerçekçi bir finansman hedefi belirleme ve teknoloji yığınlarını detaylandırma tüyoları.",
        categoryGeneral: "Genel Sorgu",
        categoryAccount: "Hesap Güvenliği",
        categoryBilling: "Ödeme / Abonelik",
        categoryPartnership: "Yatırım Desteği",
        categoryFeedback: "Geri Bildirim & Öneriler",
        severityLow: "Düşük - Görsel / Küçük düzeltme",
        severityMedium: "Orta - Özellik bozuk ama alternatif çözüm var",
        severityHigh: "Yüksek - Temel özellik tamamen bozuk",
        severityCritical: "Kritik - Uygulama çökmesi / veri kaybı riski",
        faqQ1: "Gamelogd hesabımı nasıl güvenli hale getirebilirim?",
        faqA1: "Şifrenizi Hesabım > Hesap Güvenliği altından güncelleyebilirsiniz. Benzersiz bir şifre kullanmanızı ve doğrulama için Steam veya Twitch hesaplarınızı bağlamanızı öneririz.",
        faqQ2: "Kullanıcı adımı veya e-postamı değiştirebilir miyim?",
        faqA2: "Evet, kullanıcı adınız dahil tüm profil detaylarınızı Hesabım sekmesinden düzenleyebilirsiniz. Kullanıcı adı değişikliği profil bağlantı URL'nizi günceller.",
        faqQ3: "Steam oyun kütüphanemi nasıl eşitlerim?",
        faqA3: "Bağlı Hesaplar sekmesine gidin, genel Steam ID 64 numaranızı girin ve Kaydet'e tıklayın. Steam profil gizlilik ayarlarınızın Herkese Açık olduğundan emin olun.",
        faqQ4: "Eşitlenen bazı oyunlar kütüphanemde neden görünmüyor?",
        faqA4: "Kütüphane boyutunuza bağlı olarak eşitleme birkaç dakika sürebilir. Ayrıca, yalnızca oynama süresi veya başarımı olan oyunlar içe aktarılır.",
        faqQ5: "Game DNA nedir?",
        faqA5: "Game DNA, en sevdiğiniz oyun türlerini gösteren görsel dağılım şemaları oluşturmak için oyun sürelerinizi analiz eden Gamelogd'a özel bir metrik sistemidir.",
        faqQ6: "Geliştirici iş ilanlarına nasıl başvurabilirim?",
        faqA6: "Geliştirici Merkezindeki (Dev Hub) aktif rollere göz atın. Profilinizdeki yetenek rozetleri gereksinimlerle eşleşiyorsa Başvur butonuna tıklayarak profilinizi paylaşabilirsiniz."
    },
    Spanish: {
        settings: "Ajustes",
        myAccount: "Mi Cuenta",
        connectedAccounts: "Cuentas Conectadas",
        privacySafety: "Privacidad y Seguridad",
        contentPreferences: "Preferencias de Contenido",
        notifications: "Notificaciones",
        displayLanguages: "Pantalla e Idiomas",
        additionalResources: "Recursos Adicionales",
        helpCenter: "Centro de Ayuda",
        username: "Nombre de usuario",
        email: "Correo electrónico",
        saveProfileChanges: "Guardar Cambios de Perfil",
        saving: "Guardando...",
        changePassword: "Cambiar Contraseña",
        dangerZone: "Zona de Peligro",
        deleteAccountMsg: "Una vez que elimines tu cuenta, no hay marcha atrás. Por favor, asegúrate.",
        deleteAccount: "Eliminar Cuenta",
        connectedAccountsDesc: "Conecta tus cuentas de juego para mostrar tu biblioteca y logros.",
        connect: "Conectar",
        disconnect: "Desconectar",
        steamDesc: "Sincroniza tu biblioteca y logros de Steam.",
        psnDesc: "Conecta tu cuenta de PSN.",
        xboxDesc: "Conecta tu cuenta de Xbox Live.",
        twitchDesc: "Conecta tu cuenta de Twitch.",
        epicDesc: "Sincroniza tu biblioteca de Epic Games.",
        gogDesc: "Sincroniza tu biblioteca de GOG.com.",
        eaDesc: "Sincroniza tu biblioteca de EA App.",
        privateProfile: "Perfil Privado",
        privateProfileDesc: "Solo los seguidores pueden ver tu perfil y actividad.",
        allowDms: "Permitir Mensajes Directos",
        allowDmsDesc: "Permite que las personas que sigues te envíen mensajes.",
        shareActivity: "Compartir Actividad de Juego",
        shareActivityDesc: "Muestra automáticamente el juego que estás jugando actualmente.",
        blurSpoilers: "Difuminar Spoilers",
        blurSpoilersDesc: "Oculta automáticamente reseñas y publicaciones etiquetadas como spoilers.",
        showMatureContent: "Mostrar Contenido Maduro",
        showMatureContentDesc: "Muestra juegos y contenido para mayores de 18 años en tu feed.",
        newFollowers: "Nuevos Seguidores",
        newFollowersDesc: "Notificarme cuando alguien me siga.",
        mentions: "Menciones",
        mentionsDesc: "Notificarme cuando me mencionen en una publicación o comentario.",
        jobAlerts: "Alertas de Empleo",
        jobAlertsDesc: "Notificarme sobre nuevos roles de desarrollador que coincidan con mis habilidades.",
        language: "Idioma",
        fontSize: "Tamaño de Fuente",
        accentColor: "Color de Acento",
        aboutGamelogd: "Sobre Gamelogd",
        tos: "Términos de Servicio",
        privacyPolicy: "Política de Privacidad",
        cookiePolicy: "Política de Cookies",
        blog: "Blog",
        browseFaqs: "Explorar Preguntas Frecuentes",
        browseFaqsDesc: "Encuentra respuestas a preguntas comunes sobre Gamelogd.",
        contactSupport: "Contactar al Soporte",
        contactSupportDesc: "Ponte en contacto con nuestro equipo de soporte para obtener ayuda.",
        reportProblem: "Informar de un Problema",
        reportProblemDesc: "¿Encontraste un error? Infórmanos para que podamos solucionarlo.",
        currentPassword: "Contraseña Actual",
        newPassword: "Nueva Contraseña",
        confirmNewPassword: "Confirmar Nueva Contraseña",
        cancel: "Cancelar",
        updatePassword: "Actualizar Contraseña",
        deleteAccountConfirmTitle: "¿Eliminar cuenta permanentemente?",
        deleteAccountConfirmDesc: "Esta operación no se puede deshacer. Todas sus bibliotecas sincronizadas se eliminarán de forma permanente.",
        keepAccount: "Conservar Mi Cuenta",
        yesDeleteAccount: "Sí, Eliminar Mi Cuenta",
        connectTitle: "Conectar",
        gamerIdLabel: "ID de Jugador / Nombre de usuario",
        connectModalPlaceholder: "Introduce tu ID...",
        connectModalHelp: "Esto mostrará tu estado conectado en tu perfil. Las bibliotecas se sincronizan automáticamente.",
        saveConnection: "Guardar Conexión",
        done: "Hecho",
        faqsTitle: "Preguntas Frecuentes",
        searchPlaceholder: "Buscar respuestas...",
        all: "Todo",
        closeFaqs: "Cerrar Preguntas Frecuentes",
        categoryLabel: "Categoría",
        subjectLabel: "Asunto",
        descriptionLabel: "Descripción",
        subjectPlaceholder: "Breve resumen de su solicitud...",
        descPlaceholder: "Explique su solicitud en detalle...",
        submitRequest: "Enviar Solicitud",
        bugTitleLabel: "Título del Error",
        bugTitlePlaceholder: "ej. error de sincronización de Steam",
        severityLabel: "Gravedad",
        stepsLabel: "Pasos para Reproducir",
        stepsPlaceholder: "Pasos...",
        bugDescPlaceholder: "Proporcione cualquier especificación adicional...",
        submitBug: "Enviar Informe",
        successSaveProfile: "¡Perfil actualizado con éxito!",
        errorFields: "¡Campos obligatorios!",
        successSteamSync: "¡Sincronización de Steam iniciada!",
        errorSteamSync: "No se pudo sincronizar Steam.",
        confirmSteamDisconnect: "¿Desconectar Steam?",
        successSteamDisconnect: "Steam desconectado.",
        confirmUnblockTitle: "Desbloquear Usuario",
        confirmUnblockMsg: "¿Está seguro de que desea desbloquear a @{username}?",
        successPlatformUpdate: "¡Actualizado con éxito!",
        errorPlatformUpdate: "Error de configuración.",
        confirmPlatformDisconnect: "¿Desconectar plataforma?",
        successPlatformDisconnect: "Desconectado.",
        errorPasswordsMatch: "¡Las contraseñas no coinciden!",
        successPasswordChange: "¡Contraseña cambiada con éxito!",
        errorPasswordChange: "Contraseña incorrecta.",
        successDeleteAccount: "Cuenta eliminada. ¡Adiós!",
        errorDeleteAccount: "Error al eliminar la cuenta.",
        successSupportSubmit: "¡Enviado con éxito!",
        errorSupportSubmit: "Error al enviar la solicitud.",
        successBugSubmit: "¡Informe de error enviado con éxito!",
        errorBugSubmit: "Error al enviar el informe.",
        aboutContent: "Gamelogd es una red social de próxima generación diseñada específicamente para entusiastas de los juegos, desarrolladores independientes e inversores.",
        tosContent: "Al utilizar Gamelogd, usted acepta cumplir con las pautas de la plataforma.",
        privacyContent: "Su privacidad es primordial en Gamelogd. Recopilamos detalles de registro y configuraciones.",
        cookieContent: "Gamelogd utiliza cookies esenciales para mantener sesiones.",
        blogContent: "Gamelogd Blog: Lanzamientos de herramientas Devlog, comprensión de Game DNA y mejores prácticas.",
        categoryGeneral: "Consulta General",
        categoryAccount: "Seguridad de la Cuenta",
        categoryBilling: "Facturación / Suscripción",
        categoryPartnership: "Soporte de Inversiones",
        categoryFeedback: "Comentarios y Sugerencias",
        severityLow: "Bajo - Visual / Ajuste menor",
        severityMedium: "Medio - Función rota pero hay alternativa",
        severityHigh: "Alto - Función principal rota por completo",
        severityCritical: "Crítico - Caída de la app / riesgo de pérdida de datos",
        faqQ1: "¿Cómo protejo mi cuenta de Gamelogd?",
        faqA1: "Puedes actualizar tu contraseña en Mi Cuenta > Seguridad de la Cuenta. Recomendamos usar una contraseña única y conectar Steam o Twitch.",
        faqQ2: "¿Puedo cambiar mi nombre de usuario?",
        faqA2: "Sí, puedes editar tu nombre de usuario en la sección Mi Cuenta. Cambiar el nombre de usuario actualizará la URL de tu perfil.",
        faqQ3: "¿Cómo sincronizo mi biblioteca de Steam?",
        faqA3: "Ve a Cuentas Conectadas, ingresa tu Steam ID 64 público y haz clic en Guardar. Asegúrate de que la privacidad de tu perfil de Steam sea Pública.",
        faqQ4: "¿Por qué no aparecen algunos juegos sincronizados?",
        faqA4: "La sincronización puede tardar unos minutos según el tamaño de la biblioteca. Solo se importan juegos con tiempo de juego registrado.",
        faqQ5: "¿Qué es el DNA del Juego?",
        faqA5: "El DNA del Juego es una métrica personalizada que analiza tus tiempos de juego para generar gráficos visuales de tus géneros favoritos.",
        faqQ6: "¿Cómo postulo a trabajos de desarrollo?",
        faqA6: "Explora los roles activos en el Dev Hub. Si tus habilidades coinciden con los requisitos, haz clic en Aplicar para compartir tu perfil."
    },
    French: {
        settings: "Paramètres",
        myAccount: "Mon Compte",
        connectedAccounts: "Comptes Connectés",
        privacySafety: "Confidentialité & Sécurité",
        contentPreferences: "Préférences de Contenu",
        notifications: "Notifications",
        displayLanguages: "Affichage & Langues",
        additionalResources: "Ressources Supplémentaires",
        helpCenter: "Centre d'Aide",
        username: "Nom d'utilisateur",
        email: "E-mail",
        saveProfileChanges: "Enregistrer les modifications",
        saving: "Enregistrement...",
        changePassword: "Modifier le Mot de Passe",
        dangerZone: "Zone de Danger",
        deleteAccountMsg: "Une fois votre compte supprimé, il n'y a pas de retour possible. S'il vous plaît soyez certain.",
        deleteAccount: "Supprimer le Compte",
        connectedAccountsDesc: "Connectez vos comptes de jeu pour afficher votre bibliothèque et vos succès.",
        connect: "Connecter",
        disconnect: "Déconnecter",
        steamDesc: "Synchronisez votre bibliothèque Steam et vos succès.",
        psnDesc: "Connectez votre compte PSN.",
        xboxDesc: "Connectez votre compte Xbox Live.",
        twitchDesc: "Connectez votre compte Twitch.",
        epicDesc: "Synchronisez votre bibliothèque Epic Games.",
        gogDesc: "Synchronisez votre bibliothèque GOG.com.",
        eaDesc: "Synchronisez votre bibliothèque EA App.",
        privateProfile: "Profil Privé",
        privateProfileDesc: "Seuls vos abonnés peuvent voir votre profil et votre activité.",
        allowDms: "Autoriser les Messages Directs",
        allowDmsDesc: "Autorisez les personnes que vous suivez à vous envoyer des messages.",
        shareActivity: "Partager l'activité de jeu",
        shareActivityDesc: "Afficher automatiquement le jeu auquel vous jouez actuellement.",
        blurSpoilers: "Flouter les Spoilers",
        blurSpoilersDesc: "Masquer automatiquement les critiques et les publications taguées comme spoilers.",
        showMatureContent: "Afficher le contenu pour adultes",
        showMatureContentDesc: "Afficher les jeux et contenus 18+ dans votre flux.",
        newFollowers: "Nouveaux abonnés",
        newFollowersDesc: "Me notifier quand quelqu'un me suit.",
        mentions: "Mentions",
        mentionsDesc: "Me notifier quand je suis mentionné dans un post ou un commentaire.",
        jobAlerts: "Alertes d'emploi",
        jobAlertsDesc: "Me notifier des nouveaux rôles de développeur correspondant à mes compétences.",
        language: "Langue",
        fontSize: "Taille de police",
        accentColor: "Couleur d'accentuation",
        aboutGamelogd: "À propos de Gamelogd",
        tos: "Conditions d'utilisation",
        privacyPolicy: "Politique de confidentialité",
        cookiePolicy: "Politique relative aux cookies",
        blog: "Blog",
        browseFaqs: "Parcourir la FAQ",
        browseFaqsDesc: "Trouvez des réponses aux questions fréquemment posées sur Gamelogd.",
        contactSupport: "Contacter le support",
        contactSupportDesc: "Contactez notre équipe de support pour obtenir de l'aide.",
        reportProblem: "Signaler un problème",
        reportProblemDesc: "Vous avez trouvé un bug ? Signalez-le-nous pour que nous puissions le corriger.",
        currentPassword: "Mot de passe actuel",
        newPassword: "Nouveau mot de passe",
        confirmNewPassword: "Confirmer le nouveau mot de passe",
        cancel: "Annuler",
        updatePassword: "Mettre à jour le mot de passe",
        deleteAccountConfirmTitle: "Supprimer le compte définitivement?",
        deleteAccountConfirmDesc: "Cette opération est irréversible. Toutes vos données seront supprimées définitivement.",
        keepAccount: "Garder mon compte",
        yesDeleteAccount: "Oui, supprimer mon compte",
        connectTitle: "Connecter",
        gamerIdLabel: "Identifiant / Nom d'utilisateur",
        connectModalPlaceholder: "Entrez votre identifiant...",
        connectModalHelp: "Cela affichera votre statut connecté sur votre profil.",
        saveConnection: "Enregistrer la connexion",
        done: "Terminé",
        faqsTitle: "Questions Fréquemment Posées",
        searchPlaceholder: "Rechercher des réponses...",
        all: "Tout",
        closeFaqs: "Fermer la FAQ",
        categoryLabel: "Catégorie",
        subjectLabel: "Sujet",
        descriptionLabel: "Description",
        subjectPlaceholder: "Bref résumé de votre demande...",
        descPlaceholder: "Expliquez votre demande en détail...",
        submitRequest: "Envoyer la demande",
        bugTitleLabel: "Titre du bug",
        bugTitlePlaceholder: "ex: erreur de synchronisation Steam",
        severityLabel: "Gravité",
        stepsLabel: "Étapes pour reproduire",
        stepsPlaceholder: "Étapes...",
        bugDescPlaceholder: "Fournissez des spécifications supplémentaires...",
        submitBug: "Envoyer le rapport",
        successSaveProfile: "Profil mis à jour avec succès !",
        errorFields: "Champs requis manquants !",
        successSteamSync: "Synchronisation Steam lancée !",
        errorSteamSync: "Échec de la synchronisation Steam.",
        confirmSteamDisconnect: "Déconnecter Steam ?",
        successSteamDisconnect: "Steam déconnecté.",
        confirmUnblockTitle: "Débloquer l'utilisateur",
        confirmUnblockMsg: "Êtes-vous sûr de vouloir débloquer @{username} ?",
        successPlatformUpdate: "Compte mis à jour avec succès !",
        errorPlatformUpdate: "Échec de la configuration.",
        confirmPlatformDisconnect: "Déconnecter la plateforme ?",
        successPlatformDisconnect: "Déconnecté.",
        errorPasswordsMatch: "Les mots de passe ne correspondent pas !",
        successPasswordChange: "Mot de passe changé avec succès !",
        errorPasswordChange: "Mot de passe incorrect.",
        successDeleteAccount: "Compte supprimé. Au revoir !",
        errorDeleteAccount: "Échec de la suppression du compte.",
        successSupportSubmit: "Envoyé avec succès !",
        errorSupportSubmit: "Échec de l'envoi.",
        successBugSubmit: "Rapport de bug envoyé !",
        errorBugSubmit: "Échec de l'envoi du rapport.",
        aboutContent: "Gamelogd est un réseau social de nouvelle génération conçu pour les passionnés de jeux, les développeurs indépendants et les investisseurs.",
        tosContent: "En utilisant Gamelogd, vous acceptez de respecter les règles de la plateforme.",
        privacyContent: "Votre vie privée est essentielle sur Gamelogd. Nous collectons des données de profil et des paramètres.",
        cookieContent: "Gamelogd utilise des cookies essentiels pour maintenir les sessions.",
        blogContent: "Gamelogd Blog: Mises à jour des outils Devlog, compréhension de Game DNA et meilleures pratiques.",
        categoryGeneral: "Demande Générale",
        categoryAccount: "Sécurité du Compte",
        categoryBilling: "Facturation / Abonnement",
        categoryPartnership: "Soutien aux Investissements",
        categoryFeedback: "Commentaires & Suggestions",
        severityLow: "Faible - Visuel / Ajustement mineur",
        severityMedium: "Moyen - Fonctionnalité cassée mais contournement possible",
        severityHigh: "Élevé - Fonctionnalité principale complètement cassée",
        severityCritical: "Critique - Plantage de l'app / perte de données",
        faqQ1: "Comment sécuriser mon compte Gamelogd ?",
        faqA1: "Mettez à jour votre mot de passe sous Mon Compte > Sécurité. Nous vous conseillons d'utiliser un mot de passe unique et de lier Steam ou Twitch.",
        faqQ2: "Puis-je changer mon nom d'utilisateur ?",
        faqA2: "Oui, modifiez vos coordonnées sous Mon Compte. Changer de nom d'utilisateur met à jour l'URL de partage de votre profil.",
        faqQ3: "Comment synchroniser ma bibliothèque Steam ?",
        faqA3: "Allez dans Comptes Connectés, saisissez votre Steam ID 64 public et cliquez sur Enregistrer. Votre profil Steam doit être Public.",
        faqQ4: "Pourquoi certains jeux synchronisés n'apparaissent pas ?",
        faqA4: "La synchronisation peut prendre quelques minutes selon la taille de la bibliothèque. Seuls les jeux avec du temps de jeu sont importés.",
        faqQ5: "Qu'est-ce que l'ADN du Jeu ?",
        faqA5: "L'ADN du Jeu analyse vos temps de jeu synchronisés pour générer des graphiques montrant vos genres et mécaniques favoris.",
        faqQ6: "Comment postuler à des offres de développement ?",
        faqA6: "Parcourez les offres dans le Dev Hub. Si vos compétences correspondent, cliquez sur Postuler pour partager votre profil."
    },
    German: {
        settings: "Einstellungen",
        myAccount: "Mein Konto",
        connectedAccounts: "Verbundene Konten",
        privacySafety: "Datenschutz & Sicherheit",
        contentPreferences: "Inhaltseinstellungen",
        notifications: "Benachrichtigungen",
        displayLanguages: "Anzeige & Sprachen",
        additionalResources: "Zusätzliche Ressourcen",
        helpCenter: "Hilfezentrum",
        username: "Benutzername",
        email: "E-Mail",
        saveProfileChanges: "Profil speichern",
        saving: "Wird gespeichert...",
        changePassword: "Kennwort ändern",
        dangerZone: "Gefahrenzone",
        deleteAccountMsg: "Sobald Sie Ihr Konto löschen, gibt es kein Zurück mehr. Bitte seien Sie sich sicher.",
        deleteAccount: "Konto löschen",
        connectedAccountsDesc: "Verbinden Sie Ihre Gaming-Konten, um Ihre Bibliothek und Erfolge anzuzeigen.",
        connect: "Verbinden",
        disconnect: "Verbindung trennen",
        steamDesc: "Synchronisieren Sie Ihre Steam-Bibliothek und Erfolge.",
        psnDesc: "Verbinden Sie Ihr PSN-Konto.",
        xboxDesc: "Verbinden Sie Ihr Xbox Live-Konto.",
        twitchDesc: "Verbinden Sie Ihr Twitch-Konto.",
        epicDesc: "Synchronisieren Sie Ihre Epic Games-Bibliothek.",
        gogDesc: "Synchronisieren Sie Ihre GOG.com-Bibliothek.",
        eaDesc: "Synchronisieren Sie Ihre EA App-Bibliothek.",
        privateProfile: "Privates Profil",
        privateProfileDesc: "Nur Follower können Ihr Profil und Ihre Aktivitäten sehen.",
        allowDms: "Direktnachrichten erlauben",
        allowDmsDesc: "Erlauben Sie Personen, denen Sie folgen, Ihnen Nachrichten zu senden.",
        shareActivity: "Spielaktivität teilen",
        shareActivityDesc: "Das Spiel, das Sie gerade spielen, automatisch anzeigen.",
        blurSpoilers: "Spoiler ausblenden (verpixeln)",
        blurSpoilersDesc: "Rezensionen und Beiträge mit Spoiler-Tags automatisch ausblenden.",
        showMatureContent: "Nicht jugendfreie Inhalte anzeigen",
        showMatureContentDesc: "18+ Spiele und Inhalte im Feed anzeigen.",
        newFollowers: "Neue Follower",
        newFollowersDesc: "Benachrichtigen, wenn mir jemand folgt.",
        mentions: "Erwähnungen",
        mentionsDesc: "Benachrichtigen, wenn ich in einem Beitrag oder Kommentar erwähnt werde.",
        jobAlerts: "Job-Benachrichtigungen",
        jobAlertsDesc: "Benachrichtigen über neue Entwicklerrollen, die meinen Fähigkeiten entsprechen.",
        language: "Sprache",
        fontSize: "Schriftgröße",
        accentColor: "Akzentfarbe",
        aboutGamelogd: "Über Gamelogd",
        tos: "Nutzungsbedingungen",
        privacyPolicy: "Datenschutzerklärung",
        cookiePolicy: "Cookie-Richtlinie",
        blog: "Blog",
        browseFaqs: "Häufig gestellte Fragen (FAQ)",
        browseFaqsDesc: "Antworten auf häufig gestellte Fragen zu Gamelogd finden.",
        contactSupport: "Support kontaktieren",
        contactSupportDesc: "Wenden Sie sich an unser Support-Team, um Hilfe zu erhalten.",
        reportProblem: "Problem melden",
        reportProblemDesc: "Einen Fehler gefunden? Lassen Sie es uns wissen, damit wir ihn beheben können.",
        currentPassword: "Aktuelles Passwort",
        newPassword: "Neues Passwort",
        confirmNewPassword: "Neues Passwort bestätigen",
        cancel: "Abbrechen",
        updatePassword: "Passwort aktualisieren",
        deleteAccountConfirmTitle: "Konto dauerhaft löschen?",
        deleteAccountConfirmDesc: "Dieser Vorgang kann nicht rückgängig gemacht werden. Alle Daten werden gelöscht.",
        keepAccount: "Mein Konto behalten",
        yesDeleteAccount: "Ja, mein Konto löschen",
        connectTitle: "Verbinden",
        gamerIdLabel: "Gamer ID / Benutzername",
        connectModalPlaceholder: "Geben Sie Ihre ID ein...",
        connectModalHelp: "Dies zeigt Ihren Verbindungsstatus in Ihrem Profil an.",
        saveConnection: "Verbindung speichern",
        done: "Fertig",
        faqsTitle: "Häufig Gestellte Fragen",
        searchPlaceholder: "Antworten durchsuchen...",
        all: "Alle",
        closeFaqs: "FAQ schließen",
        categoryLabel: "Kategorie",
        subjectLabel: "Betreff",
        descriptionLabel: "Beschreibung",
        subjectPlaceholder: "Kurze Zusammenfassung...",
        descPlaceholder: "Erklären Sie Ihre Anfrage im Detail...",
        submitRequest: "Anfrage senden",
        bugTitleLabel: "Fehlertitel",
        bugTitlePlaceholder: "z.B. Steam-Synchronisationsfehler",
        severityLabel: "Schweregrad",
        stepsLabel: "Schritte zur Reproduktion",
        stepsPlaceholder: "Schritte...",
        bugDescPlaceholder: "Geben Sie zusätzliche Details an...",
        submitBug: "Fehlerbericht senden",
        successSaveProfile: "Profil erfolgreich aktualisiert!",
        errorFields: "Erforderliche Felder fehlen!",
        successSteamSync: "Steam-Synchronisierung gestartet!",
        errorSteamSync: "Steam-Synchronisierung fehlgeschlagen.",
        confirmSteamDisconnect: "Steam-Verbindung trennen?",
        successSteamDisconnect: "Steam-Verbindung getrennt.",
        confirmUnblockTitle: "Benutzer entsperren",
        confirmUnblockMsg: "Sind Sie sicher, dass Sie @{username} entsperren möchten?",
        successPlatformUpdate: "Konto erfolgreich aktualisiert!",
        errorPlatformUpdate: "Konfigurationsfehler.",
        confirmPlatformDisconnect: "Verbindung trennen für",
        successPlatformDisconnect: "getrennt.",
        errorPasswordsMatch: "Passwörter stimmen nicht überein!",
        successPasswordChange: "Passwort erfolgreich geändert!",
        errorPasswordChange: "Falsches Passwort.",
        successDeleteAccount: "Konto gelöscht. Auf Wiedersehen!",
        errorDeleteAccount: "Löschen fehlgeschlagen.",
        successSupportSubmit: "Erfolgreich gesendet!",
        errorSupportSubmit: "Senden fehlgeschlagen.",
        successBugSubmit: "Fehlerbericht gesendet!",
        errorBugSubmit: "Fehlerbericht konnte nicht gesendet werden.",
        aboutContent: "Gamelogd ist ein soziales Netzwerk für Gamer, Indie-Entwickler und Investoren.",
        tosContent: "Durch die Nutzung von Gamelogd stimmen Sie den Plattformregeln zu.",
        privacyContent: "Datenschutz ist wichtig. Wir erfassen Profildaten und Einstellungen.",
        cookieContent: "Gamelogd verwendet Cookies, um Sitzungen aufrechtzuerhalten.",
        blogContent: "Gamelogd Blog: Updates zu Devlog-Tools, Verständnis von Game DNA und Pitch-Tipps.",
        categoryGeneral: "Allgemeine Anfrage",
        categoryAccount: "Kontosicherheit",
        categoryBilling: "Abrechnung / Abonnement",
        categoryPartnership: "Investitionsunterstützung",
        categoryFeedback: "Feedback & Vorschläge",
        severityLow: "Niedrig - Visuell / Kleine Anpassung",
        severityMedium: "Mittel - Funktion defekt, aber Workaround vorhanden",
        severityHigh: "Hoch - Hauptfunktion komplett defekt",
        severityCritical: "Kritisch - App-Absturz / Datenverlustrisiko",
        faqQ1: "Wie sichere ich mein Gamelogd-Konto?",
        faqA1: "Aktualisieren Sie Ihr Passwort unter Mein Konto > Kontosicherheit. Wir empfehlen ein sicheres Passwort und die Verknüpfung mit Steam oder Twitch.",
        faqQ2: "Kann ich meinen Benutzernamen ändern?",
        faqA2: "Ja, Sie können Ihren Benutzernamen unter Mein Konto ändern. Dadurch wird auch die URL Ihres Profils aktualisiert.",
        faqQ3: "Wie synchronisiere ich meine Steam-Bibliothek?",
        faqA3: "Gehen Sie zu Verknüpfte Konten, geben Sie Ihre öffentliche Steam-ID 64 ein und klicken Sie auf Speichern. Ihr Steam-Profil muss öffentlich sein.",
        faqQ4: "Warum werden einige synchronisierte Spiele nicht angezeigt?",
        faqA4: "Die Synchronisierung kann je nach Größe der Bibliothek einige Minuten dauern. Es werden nur Spiele mit Spielzeit importiert.",
        faqQ5: "Was ist Game DNA?",
        faqA5: "Game DNA analysiert Ihre Spielzeiten, um visuelle Diagramme zu erstellen, die Ihre bevorzugten Genres und Spielmechaniken zeigen.",
        faqQ6: "Wie bewerbe ich mich auf Entwickler-Jobs?",
        faqA6: "Durchsuchen Sie offene Stellen im Dev Hub. Wenn Ihre Fähigkeiten passen, klicken Sie auf Bewerben, um Ihr Profil zu teilen."
    }
};

const FAQS_DATA = [
    {
        categoryKey: 'account',
        questionKey: 'faqQ1',
        answerKey: 'faqA1'
    },
    {
        categoryKey: 'account',
        questionKey: 'faqQ2',
        answerKey: 'faqA2'
    },
    {
        categoryKey: 'library',
        questionKey: 'faqQ3',
        answerKey: 'faqA3'
    },
    {
        categoryKey: 'library',
        questionKey: 'faqQ4',
        answerKey: 'faqA4'
    },
    {
        categoryKey: 'dna',
        questionKey: 'faqQ5',
        answerKey: 'faqA5'
    },
    {
        categoryKey: 'job',
        questionKey: 'faqQ6',
        answerKey: 'faqA6'
    }
];

export default function SettingsPage() {
    return (
        <Suspense fallback={<div className="p-8 text-center text-zinc-500">Loading settings...</div>}>
            <SettingsContent />
        </Suspense>
    );
}

function SettingsContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const pathname = usePathname();
    const toast = useToast();

    const activeTab = searchParams.get('tab') || 'account';

    const setActiveTab = (tabId: string) => {
        const params = new URLSearchParams(searchParams);
        params.set('tab', tabId);
        router.push(`${pathname}?${params.toString()}`, { scroll: false });
    };

    // State for toggles
    const [settings, setSettings] = useState({
        privateProfile: false,
        directMessages: true,
        shareActivity: true,
        blurSpoilers: true,
        matureContent: false,
        newFollowers: true,
        mentions: true,
        jobAlerts: true,
        connected_accounts: {
            psn: { connected: false, username: '' },
            xbox: { connected: false, username: '' },
            twitch: { connected: false, username: '' },
            epic: { connected: false, username: '' },
            gog: { connected: false, username: '' },
            ea: { connected: false, username: '' }
        }
    });

    // State for Display Settings
    const [displaySettings, setDisplaySettings] = useState({
        language: 'English',
        fontSize: 'Medium',
        accentColor: 'Emerald'
    });

    const { user, updateUser, logout } = useAuth();
    
    // Blocked Users State & Handlers
    const [blockedUsers, setBlockedUsers] = useState<any[]>([]);
    const [isBlockedLoading, setIsBlockedLoading] = useState(false);

    const fetchBlockedUsers = async () => {
        setIsBlockedLoading(true);
        try {
            const res = await api.get('/users/blocked-users/');
            setBlockedUsers(res.data);
        } catch (error) {
            console.error("Failed to fetch blocked users:", error);
        } finally {
            setIsBlockedLoading(false);
        }
    };

    const handleUnblock = (blockedUser: any) => {
        setConfirmModalConfig({
            title: t('confirmUnblockTitle'),
            message: t('confirmUnblockMsg').replace('{username}', blockedUser.username),
            confirmText: displaySettings.language === 'Turkish' ? 'Engeli Kaldır' : 'Unblock',
            isDanger: false,
            onConfirm: async () => {
                try {
                    await api.post(`/users/${blockedUser.username}/unblock/`);
                    setBlockedUsers(prev => prev.filter(u => u.id !== blockedUser.id));
                } catch (error) {
                    console.error("Failed to unblock user:", error);
                    toast.error("Failed to unblock user.");
                }
            }
        });
        setIsConfirmModalOpen(true);
    };

    useEffect(() => {
        if (activeTab === 'blocked') {
            fetchBlockedUsers();
        }
    }, [activeTab]);

    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [isSavingProfile, setIsSavingProfile] = useState(false);

    const [realName, setRealName] = useState('');
    const [bio, setBio] = useState('');
    const [location, setLocation] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [gender, setGender] = useState('Prefer not to say');
    const [birthDate, setBirthDate] = useState('');
    const [showBirthDate, setShowBirthDate] = useState(false);
    const [isGamer, setIsGamer] = useState(false);
    const [isDeveloper, setIsDeveloper] = useState(false);
    const [isInvestor, setIsInvestor] = useState(false);
    // Steam State
    const [steamIdInput, setSteamIdInput] = useState('');
    const [isSyncing, setIsSyncing] = useState(false);
    const [steamConnected, setSteamConnected] = useState(false);
    const [steamSyncMessage, setSteamSyncMessage] = useState<{type: 'success'|'error', text: string} | null>(null);

    // Confirm Modal State
    const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
    const [confirmModalConfig, setConfirmModalConfig] = useState({
        title: '',
        message: '',
        confirmText: 'Confirm',
        isDanger: false,
        onConfirm: () => {}
    });

    // Dialog Modal States
    const [changePasswordOpen, setChangePasswordOpen] = useState(false);
    const [deleteAccountOpen, setDeleteAccountOpen] = useState(false);
    const [supportTicketOpen, setSupportTicketOpen] = useState(false);
    const [reportProblemOpen, setReportProblemOpen] = useState(false);
    const [faqsOpen, setFaqsOpen] = useState(false);
    const [resourceModal, setResourceModal] = useState<{ title: string; content: string } | null>(null);
    const [connectionModalOpen, setConnectionModalOpen] = useState(false);
    const [connectingPlatform, setConnectingPlatform] = useState<{ id: string; name: string } | null>(null);
    const [connectedUsernameInput, setConnectedUsernameInput] = useState('');

    // Password fields
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

    // Support Form fields
    const [supportSubject, setSupportSubject] = useState('');
    const [supportCategory, setSupportCategory] = useState('General');
    const [supportDescription, setSupportDescription] = useState('');
    const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

    // Bug Form fields
    const [bugTitle, setBugTitle] = useState('');
    const [bugSeverity, setBugSeverity] = useState('Medium');
    const [bugSteps, setBugSteps] = useState('');
    const [bugDescription, setBugDescription] = useState('');
    const [isSubmittingBug, setIsSubmittingBug] = useState(false);

    // FAQ Search state
    const [faqQuery, setFaqQuery] = useState('');
    const [selectedFaqCategory, setSelectedFaqCategory] = useState('All');
    const [expandedFaqIndex, setExpandedFaqIndex] = useState<number | null>(null);

    // Translator helper function
    const t = (key: keyof typeof translations.English): string => {
        const lang = displaySettings.language;
        const dicts = translations;
        const activeDict = dicts[lang as keyof typeof dicts] || translations.English;
        return (activeDict[key as keyof typeof activeDict] as string) || (translations.English[key] as string);
    };

    // FAQ specific translations dynamically resolved
    const getFaqTranslations = (faq: typeof FAQS_DATA[0]) => {
        const trFaqs: Record<string, Record<string, { category: string; question: string; answer: string }>> = {
            English: {
                account: { category: "Account Support", question: "How do I change my password?", answer: "You can change your password under the \"My Account\" tab by clicking the \"Change Password\" button, entering your current password, and specifying a new secure password." },
                library: { category: "Library Syncing", question: "How do I sync my Steam games?", answer: "Navigate to \"Connected Accounts\", find the Steam card, enter your Steam ID 64, and click \"Sync\". Your public games list will be fetched and updated in your Library." },
                dna: { category: "Game DNA & Matching", question: "What is Game DNA?", answer: "Game DNA is an automated analysis of your gaming preferences based on your playtime and genres in your synced library. It helps us recommend relevant games and developer roles to you." },
                job: { category: "Job & Devlogs", question: "How do I create a Devlog?", answer: "To post a Devlog, you must first create a Project under the Projects tab on the homepage, then you will be able to share updates and devlogs with your followers." }
            },
            Turkish: {
                account: { category: "Hesap Desteği", question: "Şifremi nasıl değiştiririm?", answer: "Şifrenizi \"Hesabım\" sekmesi altından \"Şifreyi Değiştir\" butonuna tıklayıp, mevcut şifrenizi girerek ve yeni bir güvenli şifre belirleyerek değiştirebilirsiniz." },
                library: { category: "Kütüphane Eşitleme", question: "Steam oyunlarımı nasıl senkronize ederim?", answer: "\"Bağlı Hesaplar\" sekmesine gidip Steam kartını bulun, Steam ID 64 bilginizi girin ve \"Eşitle\" butonuna tıklayın. Herkese açık oyun listeniz çekilecek ve Kütüphaneniz güncellenecektir." },
                dna: { category: "Oyun DNA'sı & Eşleştirme", question: "Oyun DNA'sı nedir?", answer: "Oyun DNA'sı, senkronize edilmiş kütüphanenizdeki oyun süreleriniz ve türlerinize dayalı olarak oyun tercihlerinizin otomatik bir analizidir. Size uygun oyunlar ve geliştirici rolleri önermemize yardımcı olur." },
                job: { category: "İş & Geliştirme Günlükleri", question: "Nasıl Devlog oluştururum?", answer: "Bir Devlog göndermek için öncelikle ana sayfadaki Projeler sekmesi altında bir Proje oluşturmalısınız, ardından takipçilerinizle güncellemeler ve devloglar paylaşabilirsiniz." }
            },
            Spanish: {
                account: { category: "Soporte de Cuenta", question: "¿Cómo cambio mi contraseña?", answer: "Puede cambiar su contraseña en la pestaña \"Mi Cuenta\" haciendo clic en \"Cambiar Contraseña\", ingresando su contraseña actual y especificando una nueva contraseña segura." },
                library: { category: "Sincronización de Biblioteca", question: "¿Cómo sincronizo mis juegos de Steam?", answer: "Vaya a \"Cuentas Conectadas\", busque la tarjeta de Steam, ingrese su Steam ID 64 y haga clic en \"Sincronizar\". Su lista de juegos públicos se actualizará en su Biblioteca." },
                dna: { category: "Game DNA", question: "¿Qué es Game DNA?", answer: "Game DNA es un análisis automatizado de sus preferencias de juego según su tiempo de juego y géneros en su biblioteca sincronizada." },
                job: { category: "Trabajos y Devlogs", question: "¿Cómo creo un Devlog?", answer: "Para publicar un Devlog, primero debe crear un Proyecto bajo la pestaña Proyectos en la página de inicio." }
            }
        };

        const activeDict = trFaqs[displaySettings.language] || trFaqs.English;
        return activeDict[faq.categoryKey] || trFaqs.English[faq.categoryKey];
    };

    // Sync preferences with user details on load
    useEffect(() => {
        if (user) {
            setUsername(user.username || '');
            setEmail(user.email || '');
            setRealName(user.real_name || '');
            setBio(user.bio || '');
            setLocation(user.location || '');
            setPhoneNumber(user.phone_number || '');
            setGender(user.gender || 'Prefer not to say');
            setBirthDate(user.birth_date || '');
            setShowBirthDate(user.show_birth_date || false);
            setIsGamer(user.is_gamer || false);
            setIsDeveloper(user.is_developer || false);
            setIsInvestor(user.is_investor || false);
            if (user.steam_id) {
                setSteamConnected(true);
                setSteamIdInput(user.steam_id);
            } else {
                setSteamConnected(false);
                setSteamIdInput('');
            }
            if (user.settings) {
                setSettings(prev => ({
                    ...prev,
                    ...user.settings,
                    connected_accounts: {
                        ...prev.connected_accounts,
                        ...(user.settings.connected_accounts || {})
                    }
                }));
                setDisplaySettings({
                    language: user.settings.language || 'English',
                    fontSize: user.settings.fontSize || 'Medium',
                    accentColor: user.settings.accentColor || 'Emerald'
                });
            }
        }
    }, [user]);

    // Apply font size globally
    useEffect(() => {
        if (displaySettings.fontSize === 'Small') {
            document.documentElement.style.fontSize = '14px';
        } else if (displaySettings.fontSize === 'Large') {
            document.documentElement.style.fontSize = '18px';
        } else {
            document.documentElement.style.fontSize = '16px';
        }
    }, [displaySettings.fontSize]);

    const [followRequests, setFollowRequests] = useState<any[]>([]);
    const [isRequestsLoading, setIsRequestsLoading] = useState(false);

    useEffect(() => {
        if (activeTab === 'privacy') {
            const fetchFollowRequests = async () => {
                setIsRequestsLoading(true);
                try {
                    const res = await api.get('/users/follow-requests/');
                    setFollowRequests(res.data);
                } catch (error) {
                    console.error("Failed to fetch follow requests:", error);
                } finally {
                    setIsRequestsLoading(false);
                }
            };
            fetchFollowRequests();
        }
    }, [activeTab]);

    const handleApproveRequest = async (requestUsername: string) => {
        try {
            await api.post(`/users/${requestUsername}/approve-request/`);
            setFollowRequests(prev => prev.filter(r => r.username !== requestUsername));
        } catch (error) {
            console.error("Failed to approve request:", error);
            toast.error("Failed to approve follow request.");
        }
    };

    const handleRejectRequest = async (requestUsername: string) => {
        try {
            await api.post(`/users/${requestUsername}/reject-request/`);
            setFollowRequests(prev => prev.filter(r => r.username !== requestUsername));
        } catch (error) {
            console.error("Failed to reject request:", error);
            toast.error("Failed to reject follow request.");
        }
    };

    const activeColor = colors[displaySettings.accentColor as keyof typeof colors] || colors.Emerald;

    const handleSaveProfile = async () => {
        if (!username || !email) {
            toast.error(t('errorFields'));
            return;
        }
        setIsSavingProfile(true);
        try {
            const res = await api.patch('/users/me/', {
                username,
                email,
                real_name: realName,
                bio,
                location,
                phone_number: phoneNumber,
                gender,
                birth_date: birthDate,
                show_birth_date: showBirthDate,
                is_gamer: isGamer,
                is_developer: isDeveloper,
                is_investor: isInvestor
            });
            updateUser(res.data);
            toast.success(t('successSaveProfile'));
        } catch (error: any) {
            console.error("Failed to update profile:", error);
            const errMsg = error.response?.data?.username?.[0] || error.response?.data?.email?.[0] || "Failed to save profile changes.";
            toast.error(errMsg);
        } finally {
            setIsSavingProfile(false);
        }
    };

    const handleToggle = async (key: string) => {
        const updatedSettings = {
            ...settings,
            [key]: !settings[key as keyof typeof settings]
        };
        setSettings(updatedSettings as any);
        try {
            const res = await api.patch('/users/me/', { settings: updatedSettings });
            updateUser(res.data);
        } catch (error) {
            console.error("Failed to update preferences:", error);
            if (user?.settings) {
                setSettings(user.settings as any);
            }
        }
    };

    const handleDisplaySettingsChange = async (key: string, value: string) => {
        const updatedDisplay = { ...displaySettings, [key]: value };
        setDisplaySettings(updatedDisplay);
        
        const updatedSettings = {
            ...settings,
            [key]: value
        };
        setSettings(updatedSettings as any);
        try {
            const res = await api.patch('/users/me/', { settings: updatedSettings });
            updateUser(res.data);
        } catch (error) {
            console.error("Failed to save display settings:", error);
        }
    };

    const handleSteamSync = async () => {
        if (!steamIdInput) return;
        setIsSyncing(true);
        setSteamSyncMessage(null);
        try {
            const res = await api.post('/users/sync_steam/', { steam_id: steamIdInput });
            setSteamConnected(true);
            setSteamSyncMessage({ type: 'success', text: res.data.message || t('successSteamSync') });
            const meRes = await api.get('/users/me/');
            updateUser(meRes.data);
        } catch (error) {
            console.error("Steam sync failed:", error);
            setSteamSyncMessage({ type: 'error', text: t('errorSteamSync') });
        } finally {
            setIsSyncing(false);
        }
    };

    const handleSteamDisconnect = () => {
        setConfirmModalConfig({
            title: displaySettings.language === 'Turkish' ? 'Steam Bağlantısını Kes' : 'Disconnect Steam',
            message: t('confirmSteamDisconnect'),
            confirmText: displaySettings.language === 'Turkish' ? 'Bağlantıyı Kes' : 'Disconnect',
            isDanger: true,
            onConfirm: async () => {
                try {
                    await api.post('/users/disconnect_steam/');
                    setSteamConnected(false);
                    setSteamIdInput('');
                    toast.success(t('successSteamDisconnect'));
                    const meRes = await api.get('/users/me/');
                    updateUser(meRes.data);
                } catch (error) {
                    console.error("Failed to disconnect Steam:", error);
                }
            }
        });
        setIsConfirmModalOpen(true);
    };

    const handleConnectPlatform = (platformId: string, platformName: string) => {
        setConnectingPlatform({ id: platformId, name: platformName });
        const existing = settings.connected_accounts[platformId as keyof typeof settings.connected_accounts];
        setConnectedUsernameInput(existing?.username || '');
        setConnectionModalOpen(true);
    };

    const handleSaveConnection = async () => {
        if (!connectingPlatform) return;
        const platformId = connectingPlatform.id;
        
        const updatedConnected = {
            ...settings.connected_accounts,
            [platformId]: {
                connected: !!connectedUsernameInput.trim(),
                username: connectedUsernameInput.trim()
            }
        };

        const updatedSettings = {
            ...settings,
            connected_accounts: updatedConnected
        };

        setSettings(updatedSettings as any);
        setConnectionModalOpen(false);

        try {
            const res = await api.patch('/users/me/', { settings: updatedSettings });
            updateUser(res.data);
            toast.success(`${connectingPlatform.name} ${t('successPlatformUpdate')}`);
        } catch (error) {
            console.error(`Failed to connect to ${connectingPlatform.name}:`, error);
            toast.error(t('errorPlatformUpdate'));
        }
    };

    const handleDisconnectPlatform = (platformId: string, platformName: string) => {
        setConfirmModalConfig({
            title: displaySettings.language === 'Turkish' ? 'Bağlantıyı Kes' : 'Disconnect Platform',
            message: `${t('confirmPlatformDisconnect')} ${platformName}?`,
            confirmText: displaySettings.language === 'Turkish' ? 'Bağlantıyı Kes' : 'Disconnect',
            isDanger: true,
            onConfirm: async () => {
                const updatedConnected = {
                    ...settings.connected_accounts,
                    [platformId]: {
                        connected: false,
                        username: ''
                    }
                };

                const updatedSettings = {
                    ...settings,
                    connected_accounts: updatedConnected
                };

                setSettings(updatedSettings as any);

                try {
                    const res = await api.patch('/users/me/', { settings: updatedSettings });
                    updateUser(res.data);
                    toast.success(`${platformName} ${t('successPlatformDisconnect')}`);
                } catch (error) {
                    console.error(`Failed to disconnect ${platformName}:`, error);
                }
            }
        });
        setIsConfirmModalOpen(true);
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error(t('errorPasswordsMatch'));
            return;
        }
        setIsSubmittingPassword(true);
        try {
            const res = await api.post('/users/change-password/', {
                current_password: currentPassword,
                new_password: newPassword
            });
            // The backend rotates the auth token on password change; adopt the new one so this
            // session keeps working instead of 401-ing on the next request (header mode).
            if (res.data?.token) setAccessToken(res.data.token);
            toast.success(t('successPasswordChange'));
            setChangePasswordOpen(false);
            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');
        } catch (error: any) {
            // Log only the server message — the full axios error carries config.data (the
            // submitted passwords) which must not reach the console.
            console.error("Change password error:", error?.response?.data ?? error?.message);
            toast.error(t('errorPasswordChange'));
        } finally {
            setIsSubmittingPassword(false);
        }
    };

    const handleDeleteAccount = async () => {
        setIsSavingProfile(true);
        try {
            await api.post('/users/delete-account/');
            toast.success(t('successDeleteAccount'));
            logout();
        } catch (error) {
            console.error("Delete account error:", error);
            toast.error(t('errorDeleteAccount'));
            setIsSavingProfile(false);
        }
    };

    const handleContactSupport = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!supportSubject || !supportDescription) {
            toast.error("Fields are required!");
            return;
        }
        setIsSubmittingSupport(true);
        try {
            await api.post('/support-tickets/', {
                ticket_type: 'support',
                subject: supportSubject,
                category: supportCategory,
                description: supportDescription
            });

            toast.success(t('successSupportSubmit'));
            setSupportTicketOpen(false);
            setSupportSubject('');
            setSupportDescription('');
        } catch (error) {
            console.error("Support ticket error:", error);
            toast.error(t('errorSupportSubmit'));
        } finally {
            setIsSubmittingSupport(false);
        }
    };

    const handleReportProblem = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bugTitle || !bugDescription || !bugSteps) {
            toast.error("Fields are required!");
            return;
        }
        setIsSubmittingBug(true);
        try {
            await api.post('/support-tickets/', {
                ticket_type: 'bug',
                subject: bugTitle,
                category: bugSeverity,
                description: bugDescription,
                steps_to_reproduce: bugSteps,
                severity: bugSeverity
            });
            toast.success(t('successBugSubmit'));
            setReportProblemOpen(false);
            setBugTitle('');
            setBugSteps('');
            setBugDescription('');
        } catch (error) {
            console.error("Bug report error:", error);
            toast.error(t('errorBugSubmit'));
        } finally {
            setIsSubmittingBug(false);
        }
    };

    const handleShowResource = (itemKey: string) => {
        let content = '';
        let title = '';
        if (itemKey === 'about') {
            title = t('aboutGamelogd');
            content = t('aboutContent');
        } else if (itemKey === 'tos') {
            title = t('tos');
            content = t('tosContent');
        } else if (itemKey === 'privacy') {
            title = t('privacyPolicy');
            content = t('privacyContent');
        } else if (itemKey === 'cookie') {
            title = t('cookiePolicy');
            content = t('cookieContent');
        } else if (itemKey === 'blog') {
            title = t('blog');
            content = t('blogContent');
        }
        setResourceModal({ title, content });
    };

    const categories = [
        { id: 'account', label: t('myAccount'), icon: User },
        { id: 'connected', label: t('connectedAccounts'), icon: Monitor },
        { id: 'privacy', label: t('privacySafety'), icon: Shield },
        { id: 'blocked', label: 'Blocked Users', icon: UserX },
        { id: 'content', label: t('contentPreferences'), icon: EyeOff },
        { id: 'notifications', label: t('notifications'), icon: Bell },
        { id: 'display', label: t('displayLanguages'), icon: Globe },
        { id: 'resources', label: t('additionalResources'), icon: FileText },
        { id: 'help', label: t('helpCenter'), icon: HelpCircle },
    ];

    const filteredFaqs = FAQS_DATA.map(faq => getFaqTranslations(faq)).filter(faq => {
        const matchesSearch = faq.question.toLowerCase().includes(faqQuery.toLowerCase()) || 
                              faq.answer.toLowerCase().includes(faqQuery.toLowerCase());
        const matchesCategory = selectedFaqCategory === 'All' || faq.category === selectedFaqCategory;
        return matchesSearch && matchesCategory;
    });

    return (
        <div className={`min-h-screen bg-zinc-950 text-white font-sans ${activeColor.selection}`}>
            <Navbar />

            <main className="container mx-auto px-4 py-8">
                <div className="max-w-6xl mx-auto">
                    <h1 className="text-3xl font-bold mb-8">{t('settings')}</h1>

                    <div className="flex flex-col md:flex-row gap-8">
                        {/* Left Sidebar - Navigation */}
                        <div className="w-full md:w-1/4">
                            <nav className="flex flex-col gap-2">
                                {categories.map((category) => (
                                    <button
                                        key={category.id}
                                        onClick={() => setActiveTab(category.id)}
                                        className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium text-left ${activeTab === category.id
                                            ? 'bg-zinc-800 text-white border-l-4 border-emerald-500'
                                            : 'text-zinc-400 hover:text-white hover:bg-zinc-900'
                                            }`}
                                        style={activeTab === category.id ? { borderLeftColor: `var(--color-${displaySettings.accentColor.toLowerCase()}-500)` } : {}}
                                    >
                                        <category.icon className={`h-5 w-5 ${activeTab === category.id ? activeColor.text : 'text-zinc-400'}`} />
                                        {category.label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        {/* Right Content - Settings Forms */}
                        <div className="w-full md:w-3/4 bg-zinc-900 rounded-2xl border border-zinc-800 p-6 md:p-8 min-h-[500px]">

                            {/* My Account */}
                            {activeTab === 'account' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">{t('myAccount')}</h2>

                                    <div className="space-y-4 max-w-md">
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('username')}</label>
                                            <input
                                                type="text"
                                                value={username}
                                                onChange={(e) => setUsername(e.target.value)}
                                                className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none ${activeColor.borderFocus} focus:ring-1 ${activeColor.ring} transition-all`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('email')}</label>
                                            <input
                                                type="email"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none ${activeColor.borderFocus} focus:ring-1 ${activeColor.ring} transition-all`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('realName')}</label>
                                            <input
                                                type="text"
                                                value={realName}
                                                onChange={(e) => setRealName(e.target.value)}
                                                className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none ${activeColor.borderFocus} focus:ring-1 ${activeColor.ring} transition-all`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('bio')}</label>
                                            <textarea
                                                value={bio}
                                                onChange={(e) => setBio(e.target.value)}
                                                rows={4}
                                                className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none ${activeColor.borderFocus} focus:ring-1 ${activeColor.ring} transition-all resize-none`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('location')}</label>
                                            <input
                                                type="text"
                                                value={location}
                                                onChange={(e) => setLocation(e.target.value)}
                                                className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none ${activeColor.borderFocus} focus:ring-1 ${activeColor.ring} transition-all`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('phoneNumber')}</label>
                                            <input
                                                type="text"
                                                value={phoneNumber}
                                                onChange={(e) => setPhoneNumber(e.target.value)}
                                                className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none ${activeColor.borderFocus} focus:ring-1 ${activeColor.ring} transition-all`}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('gender')}</label>
                                            <CustomSelect 
                                                value={gender} 
                                                onChange={setGender} 
                                                options={[
                                                    { value: 'Male', label: t('genderMale') || 'Male' },
                                                    { value: 'Female', label: t('genderFemale') || 'Female' },
                                                    { value: 'Non-binary', label: t('genderNonBinary') || 'Non-binary' },
                                                    { value: 'Prefer not to say', label: t('genderPreferNotToSay') || 'Prefer not to say' }
                                                ]}
                                                activeColor={activeColor}
                                                placeholder={t('selectGender') || 'Select Gender'}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('birthDate')}</label>
                                            <input
                                                type="date"
                                                value={birthDate}
                                                onChange={(e) => setBirthDate(e.target.value)}
                                                className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none ${activeColor.borderFocus} focus:ring-1 ${activeColor.ring} transition-all`}
                                            />
                                        </div>
                                        <div className="flex items-center justify-between py-2 border-b border-zinc-800/50">
                                            <div>
                                                <div className="font-bold text-sm text-zinc-400 uppercase tracking-wider">{t('showBirthDate')}</div>
                                                <div className="text-xs text-zinc-500">Show your birth date on your public profile.</div>
                                            </div>
                                            <Switch 
                                                checked={showBirthDate} 
                                                onChange={() => setShowBirthDate(!showBirthDate)} 
                                                activeBgClass={activeColor.switchBg}
                                            />
                                        </div>
                                        <div className="space-y-3 py-2">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider block">{t('roles')}</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isGamer} 
                                                        onChange={(e) => setIsGamer(e.target.checked)} 
                                                        className="sr-only"
                                                    />
                                                    <div className={`h-5 w-5 rounded border flex items-center justify-center transition-all ${
                                                        isGamer 
                                                            ? `${activeColor.bg} border-transparent text-white` 
                                                            : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                                                    }`}>
                                                        {isGamer && <Check className="h-3 w-3 stroke-[3]" />}
                                                    </div>
                                                    <span className="text-sm font-medium">{t('gamer')}</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isDeveloper} 
                                                        onChange={(e) => setIsDeveloper(e.target.checked)} 
                                                        className="sr-only"
                                                    />
                                                    <div className={`h-5 w-5 rounded border flex items-center justify-center transition-all ${
                                                        isDeveloper 
                                                            ? `${activeColor.bg} border-transparent text-white` 
                                                            : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                                                    }`}>
                                                        {isDeveloper && <Check className="h-3 w-3 stroke-[3]" />}
                                                    </div>
                                                    <span className="text-sm font-medium">{t('developer')}</span>
                                                </label>
                                                <label className="flex items-center gap-3 p-3 bg-zinc-950 border border-zinc-800 rounded-lg cursor-pointer hover:bg-zinc-900 transition-colors select-none">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isInvestor} 
                                                        onChange={(e) => setIsInvestor(e.target.checked)} 
                                                        className="sr-only"
                                                    />
                                                    <div className={`h-5 w-5 rounded border flex items-center justify-center transition-all ${
                                                        isInvestor 
                                                            ? `${activeColor.bg} border-transparent text-white` 
                                                            : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                                                    }`}>
                                                        {isInvestor && <Check className="h-3 w-3 stroke-[3]" />}
                                                    </div>
                                                    <span className="text-sm font-medium">{t('investor')}</span>
                                                </label>
                                            </div>
                                        </div>

                                        <button
                                            onClick={handleSaveProfile}
                                            disabled={isSavingProfile}
                                            className={`px-6 py-3 ${activeColor.bg} ${activeColor.hover} text-white font-medium rounded-lg transition-colors flex items-center gap-2`}
                                        >
                                            {isSavingProfile ? (
                                                <>
                                                    <Loader2 className="h-4 w-4 animate-spin" />
                                                    <span>{t('saving')}</span>
                                                </>
                                            ) : (
                                                <span>{t('saveProfileChanges')}</span>
                                            )}
                                        </button>
                                    </div>

                                    <div className="pt-6 border-t border-zinc-800">
                                        <button 
                                            onClick={() => setChangePasswordOpen(true)}
                                            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                        >
                                            <Lock className="h-4 w-4" />
                                            {t('changePassword')}
                                        </button>
                                    </div>

                                    <div className="pt-6 border-t border-zinc-800">
                                        <h3 className="text-red-500 font-bold mb-2 uppercase tracking-wider text-sm">{t('dangerZone')}</h3>
                                        <p className="text-zinc-400 text-sm mb-4">{t('deleteAccountMsg')}</p>
                                        <button 
                                            onClick={() => setDeleteAccountOpen(true)}
                                            className="px-4 py-2 border border-red-500/30 text-red-500 hover:bg-red-500/10 rounded-lg font-medium transition-colors flex items-center gap-2"
                                        >
                                            <Trash2 className="h-4 w-4" />
                                            {t('deleteAccount')}
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Connected Accounts */}
                            {activeTab === 'connected' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">{t('connectedAccounts')}</h2>
                                    <p className="text-zinc-400 mb-6">{t('connectedAccountsDesc')}</p>

                                    <div className="space-y-4">
                                        {[
                                            { id: 'steam', name: 'Steam', icon: Gamepad2, connected: steamConnected, color: 'text-blue-400', description: t('steamDesc') },
                                            { id: 'psn', name: 'PlayStation Network', icon: Gamepad2, connected: settings.connected_accounts.psn?.connected, color: 'text-blue-600', description: t('psnDesc') },
                                            { id: 'xbox', name: 'Xbox Live', icon: Gamepad2, connected: settings.connected_accounts.xbox?.connected, color: 'text-green-500', description: t('xboxDesc') },
                                            { id: 'twitch', name: 'Twitch', icon: Twitch, connected: settings.connected_accounts.twitch?.connected, color: 'text-purple-500', description: t('twitchDesc') },
                                            { id: 'epic', name: 'Epic Games', icon: Zap, connected: settings.connected_accounts.epic?.connected, color: 'text-white', description: t('epicDesc') },
                                            { id: 'gog', name: 'GOG.com', icon: Monitor, connected: settings.connected_accounts.gog?.connected, color: 'text-purple-400', description: t('gogDesc') },
                                            { id: 'ea', name: 'EA App', icon: Play, connected: settings.connected_accounts.ea?.connected, color: 'text-red-500', description: t('eaDesc') },
                                        ].map((platform) => {
                                            const isSteam = platform.id === 'steam';
                                            const connUsername = isSteam ? user?.steam_id : (settings.connected_accounts[platform.id as keyof typeof settings.connected_accounts] as any)?.username;
                                            
                                            return (
                                                <div key={platform.id} className="flex flex-col p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                                                    <div className="flex items-center justify-between">
                                                        <div className="flex items-center gap-4">
                                                            <div className={`p-2 rounded-lg bg-zinc-900 ${platform.color}`}>
                                                                <platform.icon className="h-6 w-6" />
                                                            </div>
                                                            <div>
                                                                <div className="font-bold">{platform.name}</div>
                                                                <div className="text-sm text-zinc-500">
                                                                    {platform.connected
                                                                        ? `Connected (User: ${connUsername})`
                                                                        : platform.description}
                                                                </div>
                                                                {isSteam && steamSyncMessage && (
                                                                    <div className={`mt-2 p-3 rounded-lg text-sm font-medium ${steamSyncMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
                                                                        {steamSyncMessage.text}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                if (isSteam) {
                                                                    if (platform.connected) {
                                                                        handleSteamDisconnect();
                                                                    }
                                                                } else {
                                                                    if (platform.connected) {
                                                                        handleDisconnectPlatform(platform.id, platform.name);
                                                                    } else {
                                                                        handleConnectPlatform(platform.id, platform.name);
                                                                    }
                                                                }
                                                            }}
                                                            className={`px-4 py-2 rounded-lg font-medium text-sm transition-colors ${platform.connected
                                                                ? 'bg-zinc-900 text-zinc-400 border border-zinc-800 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30'
                                                                : `${activeColor.bg} ${activeColor.hover} text-white`
                                                                }`}
                                                        >
                                                            {platform.connected ? t('disconnect') : t('connect')}
                                                        </button>
                                                    </div>

                                                    {/* Steam Specific Input Logic */}
                                                    {isSteam && !platform.connected && (
                                                        <div className="mt-4 pt-4 border-t border-zinc-900 animate-in slide-in-from-top-2">
                                                            <label className="text-xs font-bold text-zinc-500 uppercase tracking-wider mb-2 block">Steam ID 64</label>
                                                            <div className="flex gap-2 mb-2">
                                                                <input
                                                                    type="text"
                                                                    value={steamIdInput}
                                                                    onChange={(e) => setSteamIdInput(e.target.value)}
                                                                    placeholder="Enter your Steam ID..."
                                                                    className={`flex-1 bg-zinc-900 border border-zinc-800 rounded-lg px-3 py-2 text-sm focus:outline-none ${activeColor.borderFocus}`}
                                                                />
                                                                <button
                                                                    onClick={handleSteamSync}
                                                                    disabled={isSyncing || !steamIdInput}
                                                                    className={`px-3 py-2 ${activeColor.bg} ${activeColor.hover} disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-medium flex items-center gap-2`}
                                                                >
                                                                    {isSyncing ? (
                                                                        <>
                                                                            <Loader2 className="h-4 w-4 animate-spin" />
                                                                            <span>Syncing...</span>
                                                                        </>
                                                                    ) : (
                                                                        <span>Sync</span>
                                                                    )}
                                                                </button>
                                                            </div>
                                                            <p className="text-xs text-zinc-500 mt-2">
                                                                Find your Steam ID 64 <a href="https://steamdb.info/calculator/" target="_blank" rel="noopener noreferrer" className={`${activeColor.text} hover:underline`}>here</a>.
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Privacy & Safety */}
                            {activeTab === 'privacy' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">{t('privacySafety')}</h2>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">{t('privateProfile')}</div>
                                                <div className="text-sm text-zinc-400">{t('privateProfileDesc')}</div>
                                            </div>
                                            <Switch 
                                                checked={settings.privateProfile} 
                                                onChange={() => handleToggle('privateProfile')} 
                                                activeBgClass={activeColor.switchBg}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">{t('allowDms')}</div>
                                                <div className="text-sm text-zinc-400">{t('allowDmsDesc')}</div>
                                            </div>
                                            <Switch 
                                                checked={settings.directMessages} 
                                                onChange={() => handleToggle('directMessages')} 
                                                activeBgClass={activeColor.switchBg}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">{t('shareActivity')}</div>
                                                <div className="text-sm text-zinc-400">{t('shareActivityDesc')}</div>
                                            </div>
                                            <Switch 
                                                checked={settings.shareActivity} 
                                                onChange={() => handleToggle('shareActivity')} 
                                                activeBgClass={activeColor.switchBg}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}


                            {/* Content Preferences */}
                            {activeTab === 'content' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">{t('contentPreferences')}</h2>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className={`font-bold mb-1 ${activeColor.text}`}>{t('blurSpoilers')}</div>
                                                <div className="text-sm text-zinc-400">{t('blurSpoilersDesc')}</div>
                                            </div>
                                            <Switch 
                                                checked={settings.blurSpoilers} 
                                                onChange={() => handleToggle('blurSpoilers')} 
                                                activeBgClass={activeColor.switchBg}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">{t('showMatureContent')}</div>
                                                <div className="text-sm text-zinc-400">{t('showMatureContentDesc')}</div>
                                            </div>
                                            <Switch 
                                                checked={settings.matureContent} 
                                                onChange={() => handleToggle('matureContent')} 
                                                activeBgClass={activeColor.switchBg}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Notifications */}
                            {activeTab === 'notifications' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">{t('notifications')}</h2>

                                    <div className="space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">{t('newFollowers')}</div>
                                                <div className="text-sm text-zinc-400">{t('newFollowersDesc')}</div>
                                            </div>
                                            <Switch 
                                                checked={settings.newFollowers} 
                                                onChange={() => handleToggle('newFollowers')} 
                                                activeBgClass={activeColor.switchBg}
                                            />
                                        </div>

                                        <div className="flex items-center justify-between">
                                            <div>
                                                <div className="font-bold mb-1">{t('mentions')}</div>
                                                <div className="text-sm text-zinc-400">{t('mentionsDesc')}</div>
                                            </div>
                                            <Switch 
                                                checked={settings.mentions} 
                                                onChange={() => handleToggle('mentions')} 
                                                activeBgClass={activeColor.switchBg}
                                            />
                                        </div>

                                        <div className={`flex items-center justify-between p-4 ${activeColor.bgLight} border ${activeColor.borderAccent} rounded-xl`}>
                                            <div>
                                                <div className={`font-bold mb-1 ${activeColor.text}`}>{t('jobAlerts')}</div>
                                                <div className="text-sm text-zinc-400">{t('jobAlertsDesc')}</div>
                                            </div>
                                            <Switch 
                                                checked={settings.jobAlerts} 
                                                onChange={() => handleToggle('jobAlerts')} 
                                                activeBgClass={activeColor.switchBg}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Display & Languages */}
                            {activeTab === 'display' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">{t('displayLanguages')}</h2>

                                    <div className="space-y-8">
                                        {/* Language */}
                                        <div className="space-y-3">
                                            <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('language')}</label>
                                            <CustomSelect 
                                                value={displaySettings.language} 
                                                onChange={(val) => handleDisplaySettingsChange('language', val)} 
                                                options={[
                                                    { value: 'English', label: 'English' },
                                                    { value: 'Turkish', label: 'Türkçe' },
                                                    { value: 'Spanish', label: 'Español' },
                                                    { value: 'French', label: 'Français' },
                                                    { value: 'German', label: 'Deutsch' }
                                                ]}
                                                activeColor={activeColor}
                                                placeholder={t('language') || 'Language'}
                                            />
                                        </div>

                                        {/* Font Size */}
                                        <div className="space-y-3">
                                            <div className="flex justify-between items-center">
                                                <label className="text-sm font-bold text-zinc-400 uppercase tracking-wider">{t('fontSize')}</label>
                                                <span className={`${activeColor.text} font-bold text-sm`}>{displaySettings.fontSize}</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="0"
                                                max="2"
                                                step="1"
                                                value={displaySettings.fontSize === 'Small' ? 0 : displaySettings.fontSize === 'Medium' ? 1 : 2}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value);
                                                    const size = val === 0 ? 'Small' : val === 1 ? 'Medium' : 'Large';
                                                    handleDisplaySettingsChange('fontSize', size);
                                                }}
                                                className={`w-full h-2 bg-zinc-800 rounded-lg appearance-none cursor-pointer ${activeColor.accentRange}`}
                                            />
                                            <div className="flex justify-between text-xs text-zinc-500 font-medium px-1">
                                                <span>Small</span>
                                                <span>Medium</span>
                                                <span>Large</span>
                                            </div>
                                        </div>


                                    </div>
                                </div>
                            )}

                            {/* Additional Resources */}
                            {activeTab === 'resources' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">{t('additionalResources')}</h2>

                                    <div className="space-y-2">
                                        {[
                                            { key: 'about', label: t('aboutGamelogd') },
                                            { key: 'tos', label: t('tos') },
                                            { key: 'privacy', label: t('privacyPolicy') },
                                            { key: 'cookie', label: t('cookiePolicy') },
                                            { key: 'blog', label: t('blog') },
                                        ].map((item) => (
                                            <button
                                                key={item.key}
                                                onClick={() => handleShowResource(item.key)}
                                                className="w-full flex items-center justify-between p-4 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all group"
                                            >
                                                <span className="font-medium">{item.label}</span>
                                                <div className="flex items-center gap-2 text-zinc-500 group-hover:text-white transition-colors">
                                                    <ExternalLink className="h-4 w-4" />
                                                    <ChevronRight className="h-4 w-4" />
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Help Center */}
                            {activeTab === 'help' && (
                                <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <h2 className="text-2xl font-bold mb-6">{t('helpCenter')}</h2>

                                    <div className="grid grid-cols-1 gap-4">
                                        <button 
                                            onClick={() => setFaqsOpen(true)}
                                            className="flex items-center gap-4 p-6 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all text-left group"
                                        >
                                            <div className={`p-3 rounded-full bg-emerald-500/10 text-emerald-500 group-hover:bg-emerald-500 group-hover:text-white transition-all`}>
                                                <HelpCircle className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg mb-1">{t('browseFaqs')}</div>
                                                <div className="text-sm text-zinc-400">{t('browseFaqsDesc')}</div>
                                            </div>
                                        </button>

                                        <button 
                                            onClick={() => setSupportTicketOpen(true)}
                                            className="flex items-center gap-4 p-6 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all text-left group"
                                        >
                                            <div className={`p-3 rounded-full bg-blue-500/10 text-blue-500 group-hover:bg-blue-500 group-hover:text-white transition-all`}>
                                                <MessageCircle className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg mb-1">{t('contactSupport')}</div>
                                                <div className="text-sm text-zinc-400">{t('contactSupportDesc')}</div>
                                            </div>
                                        </button>

                                        <button 
                                            onClick={() => setReportProblemOpen(true)}
                                            className="flex items-center gap-4 p-6 bg-zinc-950 border border-zinc-800 rounded-xl hover:bg-zinc-900 transition-all text-left group"
                                        >
                                            <div className={`p-3 rounded-full bg-red-500/10 text-red-500 group-hover:bg-red-500 group-hover:text-white transition-all`}>
                                                <Bug className="h-6 w-6" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-lg mb-1">{t('reportProblem')}</div>
                                                <div className="text-sm text-zinc-400">{t('reportProblemDesc')}</div>
                                            </div>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Blocked Users */}
                            {activeTab === 'blocked' && (
                                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                    <div>
                                        <h2 className="text-2xl font-bold mb-2">Blocked Users</h2>
                                        <p className="text-zinc-400 text-sm">
                                            Here is the list of users you have blocked. Blocked users cannot follow you, see your profile details, or send you direct messages.
                                        </p>
                                    </div>

                                    {isBlockedLoading ? (
                                        <div className="flex justify-center py-12">
                                            <Loader2 className="h-6 w-6 text-emerald-500 animate-spin" />
                                        </div>
                                    ) : blockedUsers.length > 0 ? (
                                        <div className="space-y-3">
                                            {blockedUsers.map((blockedUser) => (
                                                <div 
                                                    key={blockedUser.id}
                                                    className="flex items-center justify-between p-3.5 bg-zinc-950/40 border border-zinc-800 rounded-xl hover:border-zinc-700/60 transition-all"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="h-10 w-10 rounded-full overflow-hidden bg-zinc-800 border border-zinc-700/50 flex-shrink-0">
                                                            <img 
                                                                src={getImageUrl(blockedUser.avatar, blockedUser.username)}
                                                                alt={blockedUser.username}
                                                                className="w-full h-full object-cover"
                                                            />
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-white text-sm">
                                                                {blockedUser.real_name || blockedUser.username}
                                                            </div>
                                                            <div className="text-xs text-zinc-500">
                                                                @{blockedUser.username}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <button
                                                        onClick={() => handleUnblock(blockedUser)}
                                                        className="px-3 py-1.5 text-xs font-bold text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 bg-zinc-900 rounded-lg transition-all cursor-pointer"
                                                    >
                                                        Unblock
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-850/50 rounded-2xl">
                                            You haven't blocked any users yet.
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                </div>
            </main>

            {/* Change Password Modal */}
            {changePasswordOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => setChangePasswordOpen(false)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Lock className={activeColor.text} />
                            {t('changePassword')}
                        </h3>
                        <form onSubmit={handleChangePassword} className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('currentPassword')}</label>
                                <input 
                                    type="password" 
                                    required
                                    value={currentPassword}
                                    onChange={(e) => setCurrentPassword(e.target.value)}
                                    className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none ${activeColor.borderFocus}`}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('newPassword')}</label>
                                <input 
                                    type="password" 
                                    required
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none ${activeColor.borderFocus}`}
                                />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{t('confirmNewPassword')}</label>
                                <input 
                                    type="password" 
                                    required
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none ${activeColor.borderFocus}`}
                                />
                            </div>
                            <div className="pt-2 flex justify-end gap-3">
                                <button 
                                    type="button"
                                    onClick={() => setChangePasswordOpen(false)}
                                    className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button 
                                    type="submit"
                                    disabled={isSubmittingPassword}
                                    className={`px-4 py-2 ${activeColor.bg} ${activeColor.hover} disabled:opacity-50 text-white rounded-lg text-sm font-medium flex items-center gap-2`}
                                >
                                    {isSubmittingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                                    <span>{t('updatePassword')}</span>
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Account Confirmation Modal */}
            {deleteAccountOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-zinc-900 border border-red-500/20 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => setDeleteAccountOpen(false)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <h3 className="text-xl font-bold mb-2 flex items-center gap-2 text-red-500">
                            <AlertTriangle />
                            {t('deleteAccountConfirmTitle')}
                        </h3>
                        <p className="text-zinc-400 text-sm mb-6 leading-relaxed">
                            {t('deleteAccountConfirmDesc')}
                        </p>
                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setDeleteAccountOpen(false)}
                                className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors"
                            >
                                {t('keepAccount')}
                            </button>
                            <button 
                                onClick={handleDeleteAccount}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-medium transition-colors"
                            >
                                {t('yesDeleteAccount')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Connected Account Configuration Modal */}
            {connectionModalOpen && connectingPlatform && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => setConnectionModalOpen(false)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <Monitor className={activeColor.text} />
                            {t('connectTitle')} {connectingPlatform.name}
                        </h3>
                        <div className="space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-bold text-zinc-400 uppercase tracking-wider">{connectingPlatform.name} {t('gamerIdLabel')}</label>
                                <input 
                                    type="text" 
                                    value={connectedUsernameInput}
                                    onChange={(e) => setConnectedUsernameInput(e.target.value)}
                                    placeholder={t('connectModalPlaceholder')}
                                    className={`w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white focus:outline-none ${activeColor.borderFocus}`}
                                />
                            </div>
                            <p className="text-xs text-zinc-500">
                                {t('connectModalHelp')}
                            </p>
                            <div className="pt-2 flex justify-end gap-3">
                                <button 
                                    onClick={() => setConnectionModalOpen(false)}
                                    className="px-4 py-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg text-sm font-medium transition-colors"
                                >
                                    {t('cancel')}
                                </button>
                                <button 
                                    onClick={handleSaveConnection}
                                    className={`px-4 py-2 ${activeColor.bg} ${activeColor.hover} text-white rounded-lg text-sm font-medium transition-colors`}
                                >
                                    {t('saveConnection')}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Additional Resource Detail Modal */}
            {resourceModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-2xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => setResourceModal(null)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2 border-b border-zinc-800 pb-3">
                            <FileText className={activeColor.text} />
                            {resourceModal.title}
                        </h3>
                        <p className="text-zinc-300 text-sm leading-relaxed whitespace-pre-line max-h-[400px] overflow-y-auto pr-2 scrollbar-thin-dark">
                            {resourceModal.content}
                        </p>
                        <div className="mt-6 flex justify-end">
                            <button 
                                onClick={() => setResourceModal(null)}
                                className={`px-4 py-2 ${activeColor.bg} ${activeColor.hover} text-white rounded-lg text-sm font-medium transition-colors`}
                            >
                                {t('done')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* FAQs Modal */}
            {faqsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-3xl bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl relative animate-in zoom-in-95 duration-200">
                        <button 
                            onClick={() => setFaqsOpen(false)}
                            className="absolute top-4 right-4 text-zinc-400 hover:text-white transition-colors"
                        >
                            <X className="h-5 w-5" />
                        </button>
                        <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
                            <HelpCircle className={activeColor.text} />
                            {t('faqsTitle')}
                        </h3>

                        {/* Search and Filters */}
                        <div className="flex flex-col sm:flex-row gap-3 mb-6">
                            <div className="flex-1 relative">
                                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                                <input 
                                    type="text" 
                                    placeholder={t('searchPlaceholder')}
                                    value={faqQuery}
                                    onChange={(e) => setFaqQuery(e.target.value)}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-zinc-700 text-white"
                                />
                            </div>
                            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                                {['All', 'Account Support', 'Library Syncing', 'Game DNA & Matching', 'Job & Devlogs'].map((cat) => (
                                    <button
                                        key={cat}
                                        onClick={() => setSelectedFaqCategory(cat)}
                                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${selectedFaqCategory === cat ? 'bg-zinc-800 text-white border border-zinc-700' : 'text-zinc-500 hover:text-zinc-300'}`}
                                    >
                                        {cat === 'All' ? t('all') : cat}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Accordion List */}
                        <div className="space-y-2 max-h-[350px] overflow-y-auto pr-2 scrollbar-thin-dark">
                            {filteredFaqs.length > 0 ? (
                                filteredFaqs.map((faq, index) => {
                                    const isExpanded = expandedFaqIndex === index;
                                    return (
                                        <div key={index} className="bg-zinc-950 border border-zinc-850 rounded-xl overflow-hidden">
                                            <button 
                                                onClick={() => setExpandedFaqIndex(isExpanded ? null : index)}
                                                className="w-full flex items-center justify-between p-4 text-left font-medium text-sm group hover:bg-zinc-900/50 transition-colors"
                                            >
                                                <span>{faq.question}</span>
                                                <ChevronRight className={`h-4 w-4 text-zinc-500 group-hover:text-zinc-300 transition-transform ${isExpanded ? 'rotate-90 text-white' : ''}`} />
                                            </button>
                                            {isExpanded && (
                                                <div className="px-4 pb-4 pt-1 text-sm text-zinc-400 leading-relaxed border-t border-zinc-900/50">
                                                    {faq.answer}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })
                            ) : (
                                <div className="text-center py-8 text-zinc-500 text-sm">
                                    No matching questions found. Try a different search query.
                                </div>
                            )}
                        </div>

                        <div className="mt-6 flex justify-end border-t border-zinc-850 pt-4">
                            <button 
                                onClick={() => setFaqsOpen(false)}
                                className={`px-4 py-2 ${activeColor.bg} ${activeColor.hover} text-white rounded-lg text-sm font-medium transition-colors`}
                            >
                                {t('closeFaqs')}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Contact Support Modal */}
            {supportTicketOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-3xl bg-zinc-950/75 border border-white/10 rounded-[28px] p-8 md:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.85)] relative animate-in zoom-in-95 duration-200 backdrop-blur-xl">
                        
                        {/* Top Light Edge */}
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent"></div>
                        
                        <button 
                            onClick={() => setSupportTicketOpen(false)}
                            className="absolute top-6 right-6 text-zinc-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 md:gap-10">
                            
                            {/* Left Side: Branding */}
                            <div className="flex flex-col justify-between space-y-8 md:space-y-0 pr-0 md:pr-4 md:border-r border-zinc-800/60">
                                <div className="space-y-4">
                                    <div className="text-xl font-bold tracking-wider font-sans text-white">
                                        ROARK <span className="text-zinc-600">|</span> <span className="font-light">Forge</span>
                                    </div>
                                    <h3 className="text-3xl font-extrabold text-white leading-tight font-sans mt-6">
                                        Let's build <br />
                                        <span className="bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">the future.</span>
                                    </h3>
                                    <p className="text-sm text-zinc-400 font-light leading-relaxed max-w-xs">
                                        Have a question, partnership inquiry, or just want to explore the Roark Forge ecosystem? We're here to help forge your vision into reality.
                                    </p>
                                </div>
                                
                                <div className="space-y-6 pt-4">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Direct Inquiry</div>
                                        <a href="mailto:contact@roarkforge.com" className="text-sm text-indigo-300 hover:text-white transition-colors hover:underline">contact@roarkforge.com</a>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Location</div>
                                        <div className="text-sm text-zinc-400 font-medium">Digital Forward</div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Form */}
                            <div>
                                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <MessageCircle className="h-5 w-5 text-indigo-300" />
                                    {t('contactSupport')}
                                </h4>
                                <form onSubmit={handleContactSupport} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-zinc-300">{t('realName')}</label>
                                            <input 
                                                type="text" 
                                                disabled
                                                value={user?.real_name || user?.username || ''}
                                                className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-400 focus:outline-none cursor-not-allowed opacity-80"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-zinc-300">Email</label>
                                            <input 
                                                type="email" 
                                                disabled
                                                value={user?.email || ''}
                                                className="w-full bg-zinc-900/50 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-zinc-400 focus:outline-none cursor-not-allowed opacity-80"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-zinc-300">{t('categoryLabel')}</label>
                                            <CustomSelect 
                                                value={supportCategory} 
                                                onChange={setSupportCategory} 
                                                options={[
                                                    { value: 'General', label: t('categoryGeneral') },
                                                    { value: 'Account', label: t('categoryAccount') },
                                                    { value: 'Billing', label: t('categoryBilling') },
                                                    { value: 'Partnership', label: t('categoryPartnership') },
                                                    { value: 'Feedback', label: t('categoryFeedback') }
                                                ]}
                                                activeColor={activeColor}
                                                placeholder={t('categoryLabel') || 'Category'}
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-zinc-300">{t('subjectLabel')}</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={supportSubject}
                                                onChange={(e) => setSupportSubject(e.target.value)}
                                                placeholder={t('subjectPlaceholder')}
                                                className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-650 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/25 transition-all"
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-zinc-300">{t('descriptionLabel')}</label>
                                        <textarea 
                                            rows={4}
                                            required
                                            value={supportDescription}
                                            onChange={(e) => setSupportDescription(e.target.value)}
                                            placeholder={t('descPlaceholder')}
                                            className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-650 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/25 transition-all resize-none"
                                        />
                                    </div>

                                    <div className="pt-2 flex justify-end gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => setSupportTicketOpen(false)}
                                            className="px-4 py-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors"
                                        >
                                            {t('cancel')}
                                        </button>
                                        <button 
                                            type="submit"
                                            disabled={isSubmittingSupport}
                                            className="px-5 py-2.5 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-100 shadow-lg shadow-white/5"
                                        >
                                            {isSubmittingSupport ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : null}
                                            <span>{t('submitRequest')}</span>
                                            <Send className="h-3.5 w-3.5 text-black" />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            {/* Report a Problem Modal */}
            {reportProblemOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="w-full max-w-3xl bg-zinc-950/75 border border-white/10 rounded-[28px] p-8 md:p-10 shadow-[0_25px_60px_rgba(0,0,0,0.85)] relative animate-in zoom-in-95 duration-200 backdrop-blur-xl">
                        
                        {/* Top Light Edge */}
                        <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/15 to-transparent"></div>
                        
                        <button 
                            onClick={() => setReportProblemOpen(false)}
                            className="absolute top-6 right-6 text-zinc-400 hover:text-white hover:bg-white/10 p-2 rounded-full transition-all"
                        >
                            <X className="h-5 w-5" />
                        </button>

                        <div className="grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-8 md:gap-10">
                            
                            {/* Left Side: Branding */}
                            <div className="flex flex-col justify-between space-y-8 md:space-y-0 pr-0 md:pr-4 md:border-r border-zinc-800/60">
                                <div className="space-y-4">
                                    <div className="text-xl font-bold tracking-wider font-sans text-white">
                                        ROARK <span className="text-zinc-600">|</span> <span className="font-light">Forge</span>
                                    </div>
                                    <h3 className="text-3xl font-extrabold text-white leading-tight font-sans mt-6">
                                        Let's build <br />
                                        <span className="bg-gradient-to-r from-white to-indigo-300 bg-clip-text text-transparent">the future.</span>
                                    </h3>
                                    <p className="text-sm text-zinc-400 font-light leading-relaxed max-w-xs">
                                        Have a question, partnership inquiry, or just want to explore the Roark Forge ecosystem? We're here to help forge your vision into reality.
                                    </p>
                                </div>
                                
                                <div className="space-y-6 pt-4">
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Direct Inquiry</div>
                                        <a href="mailto:contact@roarkforge.com" className="text-sm text-indigo-300 hover:text-white transition-colors hover:underline">contact@roarkforge.com</a>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="text-[10px] font-bold uppercase tracking-wider text-zinc-400">Location</div>
                                        <div className="text-sm text-zinc-400 font-medium">Digital Forward</div>
                                    </div>
                                </div>
                            </div>

                            {/* Right Side: Form */}
                            <div>
                                <h4 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                    <Bug className="h-5 w-5 text-indigo-300" />
                                    {t('reportProblem')}
                                </h4>
                                <form onSubmit={handleReportProblem} className="space-y-4">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-zinc-300">{t('bugTitleLabel')}</label>
                                            <input 
                                                type="text" 
                                                required
                                                value={bugTitle}
                                                onChange={(e) => setBugTitle(e.target.value)}
                                                placeholder={t('bugTitlePlaceholder')}
                                                className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-650 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/25 transition-all"
                                            />
                                        </div>
                                        <div className="space-y-1.5">
                                            <label className="text-xs font-semibold text-zinc-300">{t('severityLabel')}</label>
                                            <CustomSelect 
                                                value={bugSeverity} 
                                                onChange={setBugSeverity} 
                                                options={[
                                                    { value: 'Low', label: t('severityLow') },
                                                    { value: 'Medium', label: t('severityMedium') },
                                                    { value: 'High', label: t('severityHigh') },
                                                    { value: 'Critical', label: t('severityCritical') }
                                                ]}
                                                activeColor={activeColor}
                                                placeholder={t('severityLabel') || 'Severity'}
                                            />
                                        </div>
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-zinc-300">{t('stepsLabel')}</label>
                                        <textarea 
                                            rows={3}
                                            required
                                            value={bugSteps}
                                            onChange={(e) => setBugSteps(e.target.value)}
                                            placeholder={t('stepsPlaceholder')}
                                            className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-650 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/25 transition-all resize-none"
                                        />
                                    </div>

                                    <div className="space-y-1.5">
                                        <label className="text-xs font-semibold text-zinc-300">{t('descriptionLabel')}</label>
                                        <textarea 
                                            rows={3}
                                            required
                                            value={bugDescription}
                                            onChange={(e) => setBugDescription(e.target.value)}
                                            placeholder={t('bugDescPlaceholder')}
                                            className="w-full bg-zinc-900/40 border border-zinc-800/80 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-zinc-650 focus:outline-none focus:border-white/20 focus:ring-1 focus:ring-white/25 transition-all resize-none"
                                        />
                                    </div>

                                    <div className="pt-2 flex justify-end gap-3">
                                        <button 
                                            type="button"
                                            onClick={() => setReportProblemOpen(false)}
                                            className="px-4 py-2.5 text-zinc-400 hover:text-white hover:bg-white/5 rounded-xl text-sm font-medium transition-colors"
                                        >
                                            {t('cancel')}
                                        </button>
                                        <button 
                                            type="submit"
                                            disabled={isSubmittingBug}
                                            className="px-5 py-2.5 bg-white text-black hover:bg-zinc-200 disabled:opacity-50 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-100 shadow-lg shadow-white/5"
                                        >
                                            {isSubmittingBug ? <Loader2 className="h-4 w-4 animate-spin text-black" /> : null}
                                            <span>{t('submitBug')}</span>
                                            <Send className="h-3.5 w-3.5 text-black" />
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>

                    </div>
                </div>
            )}

            <ConfirmModal
                isOpen={isConfirmModalOpen}
                onClose={() => setIsConfirmModalOpen(false)}
                onConfirm={confirmModalConfig.onConfirm}
                title={confirmModalConfig.title}
                message={confirmModalConfig.message}
                confirmText={confirmModalConfig.confirmText}
                cancelText={t('cancel') || 'Cancel'}
                isDanger={confirmModalConfig.isDanger}
            />
        </div>
    );
}
