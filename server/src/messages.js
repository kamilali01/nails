// User-facing API messages in Azerbaijani (default) and English.
// The client sends its active language in the `x-lang` header.
const messages = {
  az: {
    'rateLimit.api': 'Çox tez-tez sorğu göndərirsiniz. Zəhmət olmasa bir az sonra yenidən cəhd edin.',
    'rateLimit.booking': 'Çox tez-tez rezervasiya sorğusu göndərirsiniz. Zəhmət olmasa bir neçə dəqiqə sonra yenidən cəhd edin.',
    'generic.error': 'Xəta baş verdi. Zəhmət olmasa yenidən cəhd edin.',
    'auth.unauthorized': 'İcazə yoxdur',
    'load.failed': 'Məlumatları yükləmək mümkün olmadı. Zəhmət olmasa yenidən cəhd edin.',
    'book.missingFields': 'Bütün məlumatları doldurun (tarix, saat, ad, telefon)',
    'book.badDate': 'Yanlış tarix formatı',
    'book.badHour': 'Yanlış saat formatı',
    'book.badPhone': 'Düzgün telefon nömrəsi daxil edin (məs: +994501234567 və ya 0501234567)',
    'book.past': 'Keçmiş tarixə rezervasiya etmək mümkün deyil',
    'book.tooFar': '30 gündən çox qabaqcadan rezervasiya etmək mümkün deyil',
    'book.createFailed': 'Rezervasiya yaradılmadı. Zəhmət olmasa yenidən cəhd edin.',
    'book.updateFailed': 'Rezervasiya yenilənmədi. Zəhmət olmasa yenidən cəhd edin.',
    'book.takenByOther': 'Bu saat artıq başqası tərəfindən rezerv olunub',
    'book.slotTaken': 'Bu saat artıq rezerv olunub. Zəhmət olmasa başqa saat seçin.',
    'book.oneAtATime': 'Siz bu gün artıq {hour} üçün rezervasiya etmisiniz. Hər gün yalnız 1 rezervasiya etmək mümkündür.',
    'delete.missingParams': 'Tarix və saat tələb olunur',
    'delete.failed': 'Rezervasiya silinmədi. Zəhmət olmasa yenidən cəhd edin.',
    'delete.notYours': 'Bu rezervasiyanı silmək üçün icazəniz yoxdur',
    'update.missingFields': 'Bütün məlumatları doldurun',
    'update.badPhone': 'Düzgün telefon nömrəsi daxil edin',
    'update.notFound': 'Rezervasiya tapılmadı',
    'update.notYours': 'Bu rezervasiyanı dəyişmək üçün icazəniz yoxdur',
    'dayOff.badDate': 'Düzgün tarix göndərilməyib',
    'dayOff.hasBookings': 'Bu gün üçün artıq rezervasiyalar var. Yalnız tam boş günləri bağlamaq mümkündür.',
    'dayOff.failed': 'Günü bağlamaq mümkün olmadı. Zəhmət olmasa yenidən cəhd edin.'
  },

  en: {
    'rateLimit.api': 'Too many requests. Please try again shortly.',
    'rateLimit.booking': 'Too many booking attempts. Please try again in a few minutes.',
    'generic.error': 'Something went wrong. Please try again.',
    'auth.unauthorized': 'Not authorized',
    'load.failed': 'Could not load data. Please try again.',
    'book.missingFields': 'Please fill in all fields (date, time, name, phone)',
    'book.badDate': 'Invalid date format',
    'book.badHour': 'Invalid time format',
    'book.badPhone': 'Enter a valid phone number (e.g. +994501234567 or 0501234567)',
    'book.past': 'Bookings cannot be made for past dates',
    'book.tooFar': 'Bookings cannot be made more than 30 days ahead',
    'book.createFailed': 'The booking could not be created. Please try again.',
    'book.updateFailed': 'The booking could not be updated. Please try again.',
    'book.takenByOther': 'This time slot has already been booked by someone else',
    'book.slotTaken': 'This time slot is already booked. Please choose another.',
    'book.oneAtATime': 'You already have a booking at {hour} on this day. Only one booking per day is allowed.',
    'delete.missingParams': 'Date and time are required',
    'delete.failed': 'The booking could not be deleted. Please try again.',
    'delete.notYours': 'You are not allowed to delete this booking',
    'update.missingFields': 'Please fill in all fields',
    'update.badPhone': 'Enter a valid phone number',
    'update.notFound': 'Booking not found',
    'update.notYours': 'You are not allowed to change this booking',
    'dayOff.badDate': 'A valid date was not provided',
    'dayOff.hasBookings': 'This day already has bookings. Only completely empty days can be closed.',
    'dayOff.failed': 'Could not close the day. Please try again.'
  }
};

export function getLang(req) {
  return req.headers['x-lang'] === 'en' ? 'en' : 'az';
}

export function msg(req, key, vars) {
  let text = messages[getLang(req)][key] ?? messages.az[key] ?? key;
  if (vars) {
    text = text.replace(/\{(\w+)\}/g, (_, name) => (vars[name] !== undefined ? vars[name] : ''));
  }
  return text;
}
