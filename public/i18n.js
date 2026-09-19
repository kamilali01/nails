// Tiny client-side i18n: Azerbaijani (default) and English.
//
// Static markup is translated through data attributes:
//   data-i18n="key"              -> textContent
//   data-i18n-html="key"         -> innerHTML (trusted strings only)
//   data-i18n-placeholder="key"  -> placeholder
//   data-i18n-aria="key"         -> aria-label
//   data-i18n-alt="key"          -> alt
//   data-i18n-content="key"      -> content (meta tags)
// Dynamic strings in scripts use t('key', { vars }).
(function () {
  const STORAGE_KEY = 'an_lang';
  const SUPPORTED = ['az', 'en'];

  const dict = {
    az: {
      'meta.title': 'Aurora Nails Studio – Onlayn Rezervasiya',
      'meta.desc': 'Aurora Nails Studio – manikür, pedikür və nail art üçün onlayn rezervasiya.',

      'nav.services': 'Xidmətlər',
      'nav.gallery': 'Qalereya',
      'nav.booking': 'Rezervasiya',
      'nav.contact': 'Əlaqə',
      'nav.cta': 'Rezervasiya et',
      'nav.menuOpen': 'Menyunu aç',

      'hero.eyebrow': 'Premium Manikür & Pedikür Studiyası',
      'hero.title': 'Əlləriniz üçün <span class="accent-text">sənət səviyyəsində</span> qayğı',
      'hero.sub': 'Rəngarəng dizaynlar, peşəkar qulluq və rahat atmosfer — sevdiyiniz saatı seçin, gerisini bizə buraxın.',
      'hero.book': 'Rezervasiya et',
      'hero.viewServices': 'Xidmətlərə bax',
      'hero.scroll': 'Aşağı sürüşdürün',

      'services.eyebrow': 'Xidmətlər',
      'services.title': 'Sizin üçün seçdiklərimiz',
      'services.sub': 'Hər əlin öz hekayəsi var — sizinkini birlikdə yaradaq.',
      'svc.classic.title': 'Klassik manikür',
      'svc.classic.desc': 'Səliqəli forma və incə qulluq — hər gün üçün zərif görünüş.',
      'svc.gel.title': 'Gel (şellak) manikür',
      'svc.gel.desc': 'Uzun müddət parlaq qalan, zədəyə davamlı örtük.',
      'svc.pedicure.title': 'Pedikür',
      'svc.pedicure.desc': 'Ayaqlarınıza tam rahatlıq və təravət bəxş edən qulluq.',
      'svc.extension.title': 'Dırnaq uzatma',
      'svc.extension.desc': 'İstədiyiniz uzunluq və forma — akril və ya gel ilə.',
      'svc.nailart.title': 'Nail art (dizayn)',
      'svc.nailart.desc': 'Hər dırnaq bir sənət əsəri — istədiyiniz üslubu seçin.',
      'svc.nailart.unit': '/ dırnaq',
      'svc.addon.title': 'Əlavə xidmət',
      'svc.addon.name': 'Örtüyün silinməsi',

      'banner.eyebrow': 'Yaradıcılığınıza sərhəd yoxdur',
      'banner.title': 'Öz üslubunuzu yaradın',
      'banner.cta': 'Qalereyaya bax',

      'gallery.eyebrow': 'Qalereya',
      'gallery.title': 'İşlərimizdən nümunələr',
      'gallery.sub': 'Ustalarımızın son işlərindən bir neçə görüntü.',
      'gallery.enlarge': 'Böyüt',
      'gallery.alt1': 'Bənövşəyi ombre dizayn',
      'gallery.alt2': 'Qara və tısbağa naxışlı dizayn',
      'gallery.alt3': 'Ağ rəngli ürək dizaynı',
      'gallery.alt4': 'Qırmızı yazılı dizayn',

      'booking.eyebrow': 'Rezervasiya',
      'booking.title': 'Sizə uyğun saatı seçin',
      'booking.sub': 'Gün seçin, boş saatlardan birinə klikləyin və məlumatlarınızı daxil edin.',
      'booking.dateLabel': 'Gün seçin:',
      'legend.free': 'Boş',
      'legend.mine': 'Sizin rezervasiyanız',
      'legend.booked': 'Rezerv olunub',
      'slot.free': 'Boş',
      'slot.mine': 'Sizin',
      'slot.booked': 'Rezerv',

      'modal.title.new': 'Adınızı və nömrənizi daxil edin',
      'modal.title.edit': 'Rezervasiyanı redaktə edin',
      'modal.name.ph': 'Adınız...',
      'modal.phone.ph': 'Telefon nömrəniz...',
      'modal.confirm': 'Təsdiqlə',
      'modal.cancel': 'Ləğv et',

      'manage.hour': 'Saat',
      'manage.sub': 'Bu rezervasiya sizə aiddir. Nə etmək istəyirsiniz?',
      'manage.edit': 'Redaktə et',
      'manage.cancel': 'Rezervasiyanı ləğv et',
      'manage.close': 'Bağla',

      'confirm.title': 'Təsdiq',
      'confirm.back': 'Geri',
      'confirm.ok': 'Təsdiq',
      'confirm.cancelBooking': '{hour} üçün rezervasiyanı ləğv etmək istəyirsiniz?',

      'common.backToTop': 'Yuxarı qayıt',
      'common.close': 'Bağla',

      'footer.tagline': 'Premium manikür, pedikür və nail art studiyası.',
      'footer.contact': 'Əlaqə',
      'footer.noAddress': 'Ünvan əlavə edilməyib',
      'footer.noPhone': 'Telefon əlavə edilməyib',
      'footer.hoursTitle': 'İş saatları',
      'footer.hours': 'Hər gün: 10:00 – 22:00',
      'footer.social': 'Sosial media',
      'footer.whatsappAria': 'WhatsApp yazın',

      'update.text': 'Yeni dəyişikliklər var.',
      'update.refresh': 'Yenilə',

      'toast.booked': '{hour} üçün qeydiyyat tamamlandı!',
      'toast.updated': '{hour} üçün məlumatlar yeniləndi!',
      'toast.cancelled': '{hour} üçün rezervasiya ləğv edildi!',
      'toast.slotTaken': 'Bu saat artıq rezerv olunub',
      'toast.error': 'Xəta baş verdi',

      'alert.enterName': 'Adınızı daxil edin!',
      'alert.enterPhone': 'Telefon nömrənizi daxil edin!',
      'alert.badPhone': 'Düzgün telefon nömrəsi daxil edin (məs: +994501234567 və ya 0501234567)',
      'alert.noToken': 'Xəta: Token alınmadı',
      'alert.error': 'Xəta baş verdi',
      'alert.updateFailed': 'Dəyişmək mümkün olmadı:',
      'err.network': 'Şəbəkə xətası. İnternet bağlantınızı yoxlayın.',

      // Admin dashboard
      'dash.meta.title': 'Admin Panel – Aurora Nails Studio',
      'dash.title': 'Admin Panel',
      'dash.loginSub': 'Rezervasiyaları idarə etmək üçün admin kodunu daxil edin.',
      'dash.code.ph': 'Admin kodu',
      'dash.showPass': 'Şifrəni göstər',
      'dash.login': 'Daxil ol',
      'dash.logout': 'Çıxış',
      'dash.err.enterCode': 'Kod daxil edin',
      'dash.err.wrongCode': 'Yanlış admin kodu',
      'dash.err.server': 'Serverə qoşulmaq mümkün olmadı',
      'dash.err.session': 'Sessiya bitib, yenidən daxil olun',
      'dash.stat.booked': 'Rezerv olunub',
      'dash.stat.free': 'Boş saat',
      'dash.stat.total': 'Cəmi saat',
      'dash.free': 'Boş',
      'dash.add': 'Əlavə et',
      'dash.edit': 'Düzəliş',
      'dash.delete': 'Sil',
      'dash.dayOffName': 'Bugün işləmirik',
      'dash.dayOff': 'Bugün işləmirik',
      'dash.cleanup': 'Köhnə qeydləri təmizlə',
      'dash.modal.addTitle': 'Yeni rezervasiya əlavə edin',
      'dash.modal.editTitle': 'Rezervasiyanı redaktə edin',
      'dash.modal.name.ph': 'Müştərinin adı...',
      'dash.modal.phone.ph': 'Telefon nömrəsi...',
      'dash.alert.nameAndPhone': 'Ad və telefon nömrəsini daxil edin',
      'dash.confirm.cancelBooking': '{hour} üçün rezervasiyanı ləğv etmək istəyirsiniz?',
      'dash.confirm.dayOff': '{date} tarixi üçün bütün saatlar "Bugün işləmirik" kimi işarələnəcək. Əminsiniz?',
      'dash.err.dayOff': 'Günü bağlamaq mümkün olmadı',
      'dash.confirm.cleanup': '7 gündən köhnə bütün rezervasiyalar silinəcək. Davam edilsin?',
      'dash.err.cleanup': 'Təmizləmə uğursuz oldu',
      'dash.cleanupDone': '{n} köhnə qeyd silindi'
    },

    en: {
      'meta.title': 'Aurora Nails Studio – Online Booking',
      'meta.desc': 'Aurora Nails Studio – online booking for manicure, pedicure and nail art.',

      'nav.services': 'Services',
      'nav.gallery': 'Gallery',
      'nav.booking': 'Booking',
      'nav.contact': 'Contact',
      'nav.cta': 'Book now',
      'nav.menuOpen': 'Open menu',

      'hero.eyebrow': 'Premium Manicure & Pedicure Studio',
      'hero.title': '<span class="accent-text">Artistry-level</span> care for your hands',
      'hero.sub': 'Colorful designs, professional care and a relaxing atmosphere — pick the time you love and leave the rest to us.',
      'hero.book': 'Book now',
      'hero.viewServices': 'View services',
      'hero.scroll': 'Scroll down',

      'services.eyebrow': 'Services',
      'services.title': 'Made just for you',
      'services.sub': 'Every hand has its own story — let’s create yours together.',
      'svc.classic.title': 'Classic manicure',
      'svc.classic.desc': 'Neat shaping and gentle care — an elegant look for every day.',
      'svc.gel.title': 'Gel (shellac) manicure',
      'svc.gel.desc': 'A glossy, chip-resistant finish that lasts for weeks.',
      'svc.pedicure.title': 'Pedicure',
      'svc.pedicure.desc': 'Complete comfort and freshness for your feet.',
      'svc.extension.title': 'Nail extensions',
      'svc.extension.desc': 'Any length and shape you like — with acrylic or gel.',
      'svc.nailart.title': 'Nail art (design)',
      'svc.nailart.desc': 'Every nail a small work of art — pick the style you love.',
      'svc.nailart.unit': '/ nail',
      'svc.addon.title': 'Add-on service',
      'svc.addon.name': 'Polish removal',

      'banner.eyebrow': 'Your creativity has no limits',
      'banner.title': 'Create your own style',
      'banner.cta': 'View gallery',

      'gallery.eyebrow': 'Gallery',
      'gallery.title': 'Samples of our work',
      'gallery.sub': 'A few shots from our artists’ latest work.',
      'gallery.enlarge': 'Enlarge',
      'gallery.alt1': 'Purple ombré design',
      'gallery.alt2': 'Black and tortoiseshell design',
      'gallery.alt3': 'White heart design',
      'gallery.alt4': 'Red lettering design',

      'booking.eyebrow': 'Booking',
      'booking.title': 'Pick the time that suits you',
      'booking.sub': 'Choose a day, tap a free time slot and enter your details.',
      'booking.dateLabel': 'Choose a day:',
      'legend.free': 'Free',
      'legend.mine': 'Your booking',
      'legend.booked': 'Booked',
      'slot.free': 'Free',
      'slot.mine': 'Yours',
      'slot.booked': 'Booked',

      'modal.title.new': 'Enter your name and phone number',
      'modal.title.edit': 'Edit your booking',
      'modal.name.ph': 'Your name...',
      'modal.phone.ph': 'Your phone number...',
      'modal.confirm': 'Confirm',
      'modal.cancel': 'Cancel',

      'manage.hour': 'Time',
      'manage.sub': 'This booking is yours. What would you like to do?',
      'manage.edit': 'Edit',
      'manage.cancel': 'Cancel booking',
      'manage.close': 'Close',

      'confirm.title': 'Confirm',
      'confirm.back': 'Back',
      'confirm.ok': 'Confirm',
      'confirm.cancelBooking': 'Do you want to cancel your {hour} booking?',

      'common.backToTop': 'Back to top',
      'common.close': 'Close',

      'footer.tagline': 'Premium manicure, pedicure and nail art studio.',
      'footer.contact': 'Contact',
      'footer.noAddress': 'Address not added yet',
      'footer.noPhone': 'Phone not added yet',
      'footer.hoursTitle': 'Opening hours',
      'footer.hours': 'Every day: 10:00 – 22:00',
      'footer.social': 'Social media',
      'footer.whatsappAria': 'Message us on WhatsApp',

      'update.text': 'New changes available.',
      'update.refresh': 'Refresh',

      'toast.booked': 'Your {hour} booking is confirmed!',
      'toast.updated': 'Details for {hour} updated!',
      'toast.cancelled': 'Your {hour} booking was cancelled!',
      'toast.slotTaken': 'This time slot is already booked',
      'toast.error': 'Something went wrong',

      'alert.enterName': 'Please enter your name!',
      'alert.enterPhone': 'Please enter your phone number!',
      'alert.badPhone': 'Enter a valid phone number (e.g. +994501234567 or 0501234567)',
      'alert.noToken': 'Error: no token received',
      'alert.error': 'Something went wrong',
      'alert.updateFailed': 'Could not update:',
      'err.network': 'Network error. Please check your internet connection.',

      // Admin dashboard
      'dash.meta.title': 'Admin Panel – Aurora Nails Studio',
      'dash.title': 'Admin Panel',
      'dash.loginSub': 'Enter the admin code to manage reservations.',
      'dash.code.ph': 'Admin code',
      'dash.showPass': 'Show password',
      'dash.login': 'Sign in',
      'dash.logout': 'Sign out',
      'dash.err.enterCode': 'Enter the code',
      'dash.err.wrongCode': 'Wrong admin code',
      'dash.err.server': 'Could not reach the server',
      'dash.err.session': 'Session expired, please sign in again',
      'dash.stat.booked': 'Booked',
      'dash.stat.free': 'Free slots',
      'dash.stat.total': 'Total slots',
      'dash.free': 'Free',
      'dash.add': 'Add',
      'dash.edit': 'Edit',
      'dash.delete': 'Delete',
      'dash.dayOffName': 'Closed today',
      'dash.dayOff': 'Closed today',
      'dash.cleanup': 'Clear old records',
      'dash.modal.addTitle': 'Add a new booking',
      'dash.modal.editTitle': 'Edit booking',
      'dash.modal.name.ph': 'Customer name...',
      'dash.modal.phone.ph': 'Phone number...',
      'dash.alert.nameAndPhone': 'Enter both a name and a phone number',
      'dash.confirm.cancelBooking': 'Cancel the booking for {hour}?',
      'dash.confirm.dayOff': 'All slots on {date} will be marked "Closed today". Are you sure?',
      'dash.err.dayOff': 'Could not close the day',
      'dash.confirm.cleanup': 'All bookings older than 7 days will be deleted. Continue?',
      'dash.err.cleanup': 'Cleanup failed',
      'dash.cleanupDone': '{n} old records deleted'
    }
  };

  // Name the server stores when a whole day is closed (see /reservations/day-off).
  const DAY_OFF_NAME = 'Bugün işləmirik';

  function detectLang() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (SUPPORTED.includes(saved)) return saved;
    } catch (_) {}
    return 'az';
  }

  let lang = detectLang();

  function getLang() {
    return lang;
  }

  function t(key, vars) {
    let str = (dict[lang] && dict[lang][key]);
    if (str === undefined) str = dict.az[key];
    if (str === undefined) return key;
    if (vars) {
      str = str.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? vars[name] : ''));
    }
    return str;
  }

  // The day-off marker is stored in the DB in Azerbaijani; show it in the active language.
  function displayName(name) {
    return name === DAY_OFF_NAME ? t('dash.dayOffName') : name;
  }

  function applyTranslations() {
    document.documentElement.lang = lang;

    document.querySelectorAll('[data-i18n]').forEach(el => {
      el.textContent = t(el.dataset.i18n);
    });
    document.querySelectorAll('[data-i18n-html]').forEach(el => {
      el.innerHTML = t(el.dataset.i18nHtml);
    });
    document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
      el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
    });
    document.querySelectorAll('[data-i18n-aria]').forEach(el => {
      el.setAttribute('aria-label', t(el.dataset.i18nAria));
    });
    document.querySelectorAll('[data-i18n-alt]').forEach(el => {
      el.setAttribute('alt', t(el.dataset.i18nAlt));
    });
    document.querySelectorAll('[data-i18n-content]').forEach(el => {
      el.setAttribute('content', t(el.dataset.i18nContent));
    });

    document.querySelectorAll('.lang-btn').forEach(btn => {
      const active = btn.dataset.lang === lang;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
  }

  function setLang(next) {
    if (!SUPPORTED.includes(next) || next === lang) return;
    lang = next;
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch (_) {}
    applyTranslations();
    document.dispatchEvent(new CustomEvent('langchange', { detail: { lang } }));
  }

  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.lang-btn');
    if (btn) setLang(btn.dataset.lang);
  });

  window.t = t;
  window.getLang = getLang;
  window.setLang = setLang;
  window.displayName = displayName;
  window.applyTranslations = applyTranslations;

  // This script is loaded at the end of <body>, so the DOM above is already
  // parsed — translating now avoids a flash of the default language.
  applyTranslations();
})();
