const hours = [
  "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00", "19:00", "20:00", "21:00", "22:00"
];

// Auto-detect API base URL (local dev vs production)
const getApiBase = () => window.location.origin;

const API_BASE = getApiBase();
const API_URL = `${API_BASE}/api/reservations`;

// Polling variables
let pollingInterval = null;
const POLLING_INTERVAL_MS = 10000; // Poll every 10 seconds
let lastDataHash = null;
let hasUnseenChanges = false;

// Other state variables
let selectedHour = null;
let selectedDate = null;
let currentDisplayedDate = null;
let lastBookedName = '';
let lastBookedPhone = '';
let isEditing = false;
let generating = false;

// Cookie helper functions
const CookieUtils = {
  set(name, value, days = 365) {
    const date = new Date();
    date.setTime(date.getTime() + (days * 24 * 60 * 60 * 1000));
    const expires = `expires=${date.toUTCString()}`;
    document.cookie = `${name}=${encodeURIComponent(value)};${expires};path=/;SameSite=Lax`;
  },

  get(name) {
    const nameEQ = name + "=";
    const ca = document.cookie.split(';');
    for (let i = 0; i < ca.length; i++) {
      let c = ca[i];
      while (c.charAt(0) === ' ') c = c.substring(1, c.length);
      if (c.indexOf(nameEQ) === 0) {
        return decodeURIComponent(c.substring(nameEQ.length, c.length));
      }
    }
    return null;
  },

  delete(name) {
    document.cookie = `${name}=;expires=Thu, 01 Jan 1970 00:00:00 UTC;path=/;`;
  }
};

// Phone validation for Azerbaijan
function validatePhone(phone) {
  const cleanPhone = phone.replace(/[\s-]/g, '');
  return /^(\+994|0)[0-9]{9}$/.test(cleanPhone);
}

// Hash function to detect data changes
function hashData(data) {
  const bookings = data.bookings || data;
  const currentDate = document.getElementById('date').value;
  const dayBookings = bookings[currentDate] || {};
  const keys = Object.keys(dayBookings).sort();
  const str = keys.map(k => `${k}:${dayBookings[k]}`).join('|');
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return hash.toString();
}

// Show update notification
function showUpdateNotification() {
  const msg = document.getElementById('message');
  if (!msg) return;

  msg.innerHTML = 'Yeni dəyişikliklər var. <a href="#" style="color:#e8b4bc;text-decoration:underline;">Yenilə</a>';
  msg.style.display = 'block';
  msg.style.cursor = 'pointer';

  const refreshLink = msg.querySelector('a');
  if (refreshLink) {
    refreshLink.onclick = (e) => {
      e.preventDefault();
      hasUnseenChanges = false;
      msg.textContent = '';
      msg.style.display = 'none';
      generateSlots();
    };
  }
}

// Start polling for updates
function startPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
  }

  pollingInterval = setInterval(async () => {
    const currentDate = document.getElementById('date').value;
    if (currentDate && !generating) {
      try {
        const data = await fetchBookings();
        const newHash = hashData(data);

        if (newHash !== lastDataHash && lastDataHash !== null) {
          lastDataHash = newHash;
          hasUnseenChanges = true;
          showUpdateNotification();
        } else if (lastDataHash === null) {
          lastDataHash = newHash;
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }
  }, POLLING_INTERVAL_MS);
}

function stopPolling() {
  if (pollingInterval) {
    clearInterval(pollingInterval);
    pollingInterval = null;
  }
}

// User data persistence (cookies)
function loadUserFromStorage() {
  try {
    const n = CookieUtils.get('an_name');
    const p = CookieUtils.get('an_phone');
    if (n) lastBookedName = n;
    if (p) lastBookedPhone = p;
  } catch (_) {}
}

function saveUserToStorage(name, phone) {
  try {
    CookieUtils.set('an_name', name || '');
    CookieUtils.set('an_phone', phone || '');
  } catch (_) {}
}

// Show toast notification
function showToast(message, type = 'success') {
  const existingToast = document.getElementById('toast');
  if (existingToast) {
    existingToast.remove();
  }

  const toast = document.createElement('div');
  toast.id = 'toast';
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <i>${type === 'success' ? '✓' : type === 'error' ? '⚠' : 'ℹ'}</i>
    <span>${message}</span>
  `;

  document.body.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Custom confirmation dialog
async function showConfirm(message) {
  return new Promise((resolve) => {
    const modal = document.getElementById('confirmModal');
    const messageEl = document.getElementById('confirmMessage');
    const confirmBtn = document.getElementById('confirmOk');
    const cancelBtn = document.getElementById('confirmCancel');

    messageEl.textContent = message;
    modal.style.display = 'flex';

    void modal.offsetWidth;
    modal.classList.add('show');

    const handleConfirm = () => {
      cleanup();
      resolve(true);
    };

    const handleCancel = () => {
      cleanup();
      resolve(false);
    };

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') handleCancel();
      if (e.key === 'Enter') handleConfirm();
    };

    const cleanup = () => {
      modal.classList.remove('show');
      setTimeout(() => {
        modal.style.display = 'none';
      }, 300);
      confirmBtn.removeEventListener('click', handleConfirm);
      cancelBtn.removeEventListener('click', handleCancel);
      document.removeEventListener('keydown', handleKeyDown);
    };

    confirmBtn.addEventListener('click', handleConfirm);
    cancelBtn.addEventListener('click', handleCancel);
    document.addEventListener('keydown', handleKeyDown);
  });
}

// Token management (cookies)
function getTokens() {
  try {
    const stored = CookieUtils.get('an_tokens');
    return stored ? JSON.parse(stored) : {};
  } catch (_) {
    return {};
  }
}

function saveToken(date, hour, token) {
  try {
    const tokens = getTokens();
    tokens[`${date}|${hour}`] = token;
    CookieUtils.set('an_tokens', JSON.stringify(tokens));
  } catch (_) {}
}

function getToken(date, hour) {
  const tokens = getTokens();
  return tokens[`${date}|${hour}`] || null;
}

function deleteToken(date, hour) {
  try {
    const tokens = getTokens();
    delete tokens[`${date}|${hour}`];
    CookieUtils.set('an_tokens', JSON.stringify(tokens));
  } catch (_) {}
}

function getAllTokens() {
  try {
    const stored = CookieUtils.get('an_tokens');
    if (!stored) return [];
    const tokens = JSON.parse(stored);
    return Object.values(tokens).filter(t => t && t.length > 0);
  } catch (err) {
    console.error('Error reading tokens from cookies:', err);
    return [];
  }
}

// Fetch bookings
async function fetchBookings(additionalToken = null) {
  try {
    const headers = {};

    const date = currentDisplayedDate || document.getElementById('date').value;
    if (!date) return {};

    let tokens = getAllTokens();

    if (additionalToken) {
      tokens = tokens.filter(t => t !== additionalToken && t && t.length > 0);
      tokens.push(additionalToken);
    }

    tokens = [...new Set(tokens)].filter(t => t && t.length > 0);

    if (tokens.length > 0) {
      headers['x-user-tokens'] = tokens.join(',');
      headers['x-request-owned'] = 'true';
    }

    const url = new URL(API_URL);
    url.searchParams.append('date', date);
    const response = await fetch(url.toString(), { headers });
    return await response.json();
  } catch (err) {
    console.error(err);
    return {};
  }
}

// Save booking
async function saveBooking(date, hour, name, phone) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const existingToken = getToken(date, hour);
    if (existingToken) {
      headers['x-user-token'] = existingToken;
    }

    const allTokens = getAllTokens();
    if (allTokens.length > 0) {
      headers['x-user-tokens'] = allTokens.join(',');
    }

    const response = await fetch(API_URL, {
      method: 'POST',
      body: JSON.stringify({ date, hour, name, phone }),
      headers
    });

    const result = await response.json();

    if (!response.ok) {
      return result;
    }

    if (result.status === 'success' && result.token) {
      saveToken(date, hour, result.token);
    }

    return result;
  } catch (err) {
    console.error('Network error:', err);
    return { status: 'error', message: 'Şəbəkə xətası. İnternet bağlantınızı yoxlayın.' };
  }
}

// Update booking
async function updateBooking(date, hour, payload) {
  try {
    const headers = { 'Content-Type': 'application/json' };
    const token = getToken(date, hour);
    if (token) {
      headers['x-user-token'] = token;
    }
    const response = await fetch(API_URL, {
      method: 'PUT',
      body: JSON.stringify({ date, hour, ...payload }),
      headers
    });
    return await response.json();
  } catch (err) {
    console.error(err);
    return { status: 'error', message: err };
  }
}

async function cancelReservation(date, hour) {
  const isConfirmed = await showConfirm(`${hour} üçün rezervasiyanı ləğv etmək istəyirsiniz?`);
  if (!isConfirmed) return;

  try {
    const params = new URLSearchParams({ date, hour });
    const headers = { 'x-user-token': getToken(date, hour) };

    const result = await fetch(`${API_URL}?${params.toString()}`, {
      method: 'DELETE',
      headers
    });

    if (result.ok) {
      deleteToken(date, hour);
      await generateSlots();
      showToast(`${hour} üçün rezervasiya ləğv edildi!`);
    } else {
      const error = await result.json().catch(() => ({}));
      showToast(error.message || 'Xəta baş verdi', 'error');
    }
  } catch (error) {
    console.error('Delete error:', error);
    showToast('Xəta baş verdi', 'error');
  }
}

// Date change debounce
document.getElementById('date').addEventListener('change', () => {
  clearTimeout(generateSlots.timeout);
  generateSlots.timeout = setTimeout(() => {
    generateSlots();
  }, 300);
});

window.addEventListener('DOMContentLoaded', () => {
  loadUserFromStorage();

  const dateInput = document.getElementById('date');
  if (dateInput.value) generateSlots();

  startPolling();

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopPolling();
    } else {
      startPolling();
    }
  });

  initNav();
  initReveal();
  initLightbox();
  initManageModal();
  initBackToTop();
});

window.addEventListener('beforeunload', () => {
  stopPolling();
});

function openNameModal(hour, date) {
  selectedHour = hour;
  selectedDate = date;
  const title = document.getElementById('modalTitle');
  title.textContent = isEditing ? 'Rezervasiyanı redaktə edin' : 'Adınızı və nömrənizi daxil edin';
  document.getElementById('modalNameInput').value = lastBookedName;
  const phoneInput = document.getElementById('modalPhoneInput');
  if (phoneInput) phoneInput.value = lastBookedPhone;
  const modal = document.getElementById('nameModal');
  modal.style.display = 'flex';
  void modal.offsetWidth;
  modal.classList.add('show');
  setTimeout(() => document.getElementById('modalNameInput').focus(), 100);
}

function closeNameModal() {
  const modal = document.getElementById('nameModal');
  modal.classList.remove('show');
  setTimeout(() => {
    modal.style.display = 'none';
  }, 220);
  selectedHour = null;
  selectedDate = null;
  isEditing = false;
}

document.getElementById('modalCancel').onclick = closeNameModal;

document.getElementById('modalConfirm').onclick = async function() {
  const name = document.getElementById('modalNameInput').value.trim();
  const phoneEl = document.getElementById('modalPhoneInput');
  const phone = phoneEl ? phoneEl.value.trim() : '';

  if (!name) {
    alert('Adınızı daxil edin!');
    return;
  }
  if (!phone) {
    alert('Telefon nömrənizi daxil edin!');
    return;
  }
  if (!validatePhone(phone)) {
    alert('Düzgün telefon nömrəsi daxil edin (məs: +994501234567 və ya 0501234567)');
    return;
  }

  if (!isEditing) {
    const bookedHour = selectedHour;
    lastBookedName = name;
    lastBookedPhone = phone;
    saveUserToStorage(name, phone);

    const result = await saveBooking(selectedDate, selectedHour, name, phone);

    if (result.status === 'success') {
      const reservationToken = result.token;

      if (!reservationToken) {
        alert('Xəta: Token alınmadı');
        return;
      }

      saveToken(selectedDate, selectedHour, reservationToken);
      closeNameModal();

      hasUnseenChanges = false;
      const msg = document.getElementById('message');
      if (msg && msg.innerHTML.includes('Yeni dəyişikliklər')) {
        msg.innerHTML = '';
        msg.style.display = 'none';
      }

      await generateSlots(reservationToken);
      showToast(`${bookedHour} üçün qeydiyyat tamamlandı!`);
    } else {
      const errorMessage = result.message || 'Xəta baş verdi';
      alert(errorMessage);
      closeNameModal();
      generateSlots();
    }
  } else {
    const payload = { newName: name, newPhone: phone };
    const result = await updateBooking(selectedDate, selectedHour, payload);
    if (result.status === 'success') {
      lastBookedName = name;
      lastBookedPhone = phone;
      saveUserToStorage(name, phone);
      closeNameModal();
      await generateSlots();
      showToast(`${selectedHour} üçün məlumatlar yeniləndi!`);
    } else alert('Dəyişmək mümkün olmadı: ' + (result.message || 'Xəta'));
  }
};

document.getElementById('modalNameInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter') document.getElementById('modalConfirm').click();
});

// ---------- Manage modal (edit/cancel own booking) ----------

function initManageModal() {
  const modal = document.getElementById('manageModal');
  const editBtn = document.getElementById('manageEditBtn');
  const cancelBtn = document.getElementById('manageCancelBtn');
  const closeBtn = document.getElementById('manageClose');
  if (!modal) return;

  const close = () => {
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; }, 220);
  };

  editBtn.addEventListener('click', () => {
    close();
    isEditing = true;
    openNameModal(selectedHour, selectedDate);
  });

  cancelBtn.addEventListener('click', async () => {
    const hour = selectedHour;
    const date = selectedDate;
    close();
    await cancelReservation(date, hour);
  });

  closeBtn.addEventListener('click', close);
}

function openManageModal(hour, date) {
  selectedHour = hour;
  selectedDate = date;
  document.getElementById('manageHour').textContent = hour;
  const modal = document.getElementById('manageModal');
  modal.style.display = 'flex';
  void modal.offsetWidth;
  modal.classList.add('show');
}

// ---------- Nav (mobile menu + smooth close on click) ----------

function initNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!toggle || !links) return;

  toggle.addEventListener('click', () => {
    const isOpen = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', String(isOpen));
  });

  links.querySelectorAll('a').forEach(link => {
    link.addEventListener('click', () => {
      links.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
}

// ---------- Scroll reveal ----------

function initReveal() {
  const items = document.querySelectorAll('.reveal');
  if (!items.length) return;

  if (!('IntersectionObserver' in window)) {
    items.forEach(el => el.classList.add('in-view'));
    return;
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('in-view');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });

  items.forEach(el => observer.observe(el));
}

// ---------- Back to top ----------

function initBackToTop() {
  const btn = document.getElementById('backToTop');
  if (!btn) return;

  const toggle = () => {
    if (window.scrollY > 480) {
      btn.classList.add('show');
    } else {
      btn.classList.remove('show');
    }
  };

  window.addEventListener('scroll', toggle, { passive: true });
  toggle();

  btn.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

// ---------- Gallery lightbox ----------

function initLightbox() {
  const modal = document.getElementById('lightboxModal');
  const img = document.getElementById('lightboxImg');
  const closeBtn = document.getElementById('lightboxClose');
  if (!modal || !img) return;

  const open = (src, alt) => {
    img.src = src;
    img.alt = alt || '';
    modal.style.display = 'flex';
    void modal.offsetWidth;
    modal.classList.add('show');
  };

  const close = () => {
    modal.classList.remove('show');
    setTimeout(() => { modal.style.display = 'none'; img.src = ''; }, 220);
  };

  document.querySelectorAll('.gallery-item').forEach(item => {
    item.addEventListener('click', () => {
      const full = item.getAttribute('data-full');
      const alt = item.querySelector('img')?.alt || '';
      open(full, alt);
    });
  });

  closeBtn.addEventListener('click', close);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('show')) close();
  });
}

// Generate slots
async function generateSlots(additionalToken = null) {
  if (generating) {
    await new Promise(resolve => setTimeout(resolve, 100));
    let retries = 0;
    while (generating && retries < 10) {
      await new Promise(resolve => setTimeout(resolve, 50));
      retries++;
    }
    if (additionalToken) {
      return generateSlots(additionalToken);
    }
    return;
  }

  generating = true;

  const date = document.getElementById('date').value;
  currentDisplayedDate = date;
  if (!date) {
    generating = false;
    return;
  }

  const slotContainer = document.getElementById('slots');
  slotContainer.innerHTML = '';

  const data = await fetchBookings(additionalToken);
  const bookings = data.bookings || data;
  const owned = data.owned || {};
  const dayBookings = bookings[date] || {};
  const dayOwned = owned[date] || {};

  hours.forEach(hour => {
    const isBooked = !!dayBookings[hour];
    const isMine = isBooked && dayOwned[hour] === true;

    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'slot-chip ' + (isMine ? 'is-mine' : isBooked ? 'is-booked' : 'is-free');

    const stateLabel = isMine ? 'Sizin' : isBooked ? 'Rezerv' : 'Boş';
    chip.innerHTML = `<span class="slot-hour">${hour}</span><span class="slot-state">${stateLabel}</span>`;

    if (!isBooked) {
      chip.addEventListener('click', () => { isEditing = false; openNameModal(hour, date); });
    } else if (isMine) {
      chip.addEventListener('click', () => openManageModal(hour, date));
    } else {
      chip.addEventListener('click', () => showToast('Bu saat artıq rezerv olunub', 'info'));
    }

    slotContainer.appendChild(chip);
  });

  const currentData = { bookings: { [date]: dayBookings } };
  lastDataHash = hashData(currentData);
  hasUnseenChanges = false;

  const msg = document.getElementById('message');
  if (msg && msg.innerHTML.includes('Yeni dəyişikliklər')) {
    msg.innerHTML = '';
    msg.style.display = 'none';
  }

  generating = false;
}
