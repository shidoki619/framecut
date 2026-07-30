const header = document.querySelector('.header');
const form = document.getElementById('contactForm');
const formNote = document.getElementById('formNote');

window.addEventListener('scroll', () => {
  header?.classList.toggle('scrolled', window.scrollY > 40);
});

/* Mobile nav is initialized in auth-ui.js */

const revealElements = document.querySelectorAll('.reveal');

function showReveal(el, delay = 0) {
  if (!el) return;
  if (delay) el.style.transitionDelay = `${delay}s`;
  el.classList.add('visible');
}

function isInViewport(el) {
  const r = el.getBoundingClientRect();
  return r.bottom > 0 && r.top < (window.innerHeight || document.documentElement.clientHeight);
}

// Phone / Telegram mobile: show immediately (IO often broken there).
// Desktop: keep scroll-in animations.
const isNarrow = window.matchMedia('(max-width: 900px)').matches;
const isTelegramMobile =
  /Telegram/i.test(navigator.userAgent)
  && (/Android|iPhone|iPad|Mobile/i.test(navigator.userAgent) || isNarrow);

if (isNarrow || isTelegramMobile) {
  revealElements.forEach(el => showReveal(el));
} else {
  const revealObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const siblings = entry.target.parentElement
          ? [...entry.target.parentElement.querySelectorAll('.reveal')]
          : [];
        const index = Math.max(0, siblings.indexOf(entry.target));
        showReveal(entry.target, index * 0.08);
        revealObserver.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: '0px 0px -10% 0px' }
  );

  revealElements.forEach(el => {
    if (el.closest('.hero')) return;
    revealObserver.observe(el);
  });

  // Safety only for elements already on screen that never got .visible
  setTimeout(() => {
    document.querySelectorAll('.reveal:not(.visible)').forEach(el => {
      if (isInViewport(el)) showReveal(el);
    });
  }, 2500);
}

// Hero always animates in on load (PC + mobile)
document.querySelectorAll('.hero .reveal').forEach((el, i) => {
  showReveal(el, i * 0.1);
});

function animateTimecode() {
  const timecode = document.querySelector('.timecode');
  if (!timecode) return;

  let frames = 14;
  let seconds = 2;
  let minutes = 0;

  setInterval(() => {
    frames++;
    if (frames >= 30) {
      frames = 0;
      seconds++;
    }
    if (seconds >= 60) {
      seconds = 0;
      minutes++;
    }
    const f = String(frames).padStart(2, '0');
    const s = String(seconds).padStart(2, '0');
    const m = String(minutes).padStart(2, '0');
    timecode.textContent = `00;${m};${s};${f}`;
  }, 80);
}

function animatePlayhead() {
  const timelinePlayhead = document.querySelector('.pr-timeline-playhead');
  const programLine = document.querySelector('.pr-playhead-line');
  let position = 38;

  setInterval(() => {
    position += 0.12;
    if (position > 88) position = 8;
    if (timelinePlayhead) timelinePlayhead.style.left = `${position}%`;
    if (programLine) programLine.style.left = `${position}%`;
  }, 50);
}

animateTimecode();
animatePlayhead();

function getFormType() {
  return form?.querySelector('input[name="type"]:checked')?.value || 'youtube';
}

function normalizeTelegram(value) {
  const raw = value.trim().replace(/^@+/, '');
  return raw ? `@${raw}` : '';
}

function stripTelegramForInput(value) {
  return value.trim().replace(/^@+/, '');
}

const ORDER_DRAFT_KEY = 'framecut_order_draft';

function saveOrderDraft() {
  sessionStorage.setItem(ORDER_DRAFT_KEY, JSON.stringify({
    contact: form.contact?.value || '',
    type: getFormType(),
    message: form.message?.value || '',
  }));
}

function applyOrderDraft(draft) {
  if (!draft || !form) return;
  if (form.contact && draft.contact) {
    form.contact.value = stripTelegramForInput(draft.contact);
  }
  if (draft.type) {
    const typeInput = form.querySelector(`input[name="type"][value="${draft.type}"]`);
    if (typeInput) typeInput.checked = true;
  }
  if (form.message && draft.message) form.message.value = draft.message;
}

function prefillContactForm() {
  if (!form) return;
  const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
  if (user?.telegram && form.contact) {
    form.contact.value = stripTelegramForInput(user.telegram);
  }
}

async function submitOrderFromForm() {
  const user = Auth.getCurrentUser();
  if (!user) return false;

  const telegram = normalizeTelegram(form.contact.value);
  if (!telegram) {
    formNote.textContent = 'Укажите Telegram username';
    formNote.classList.remove('success');
    return true;
  }

  try {
    await Auth.addOrder({
      type: getFormType(),
      message: form.message.value,
      contact: telegram,
    });
    formNote.textContent = 'Заявка сохранена в личном кабинете. Ответ придёт сюда и в Telegram.';
    formNote.classList.add('success');
    form.reset();
    const defaultType = form.querySelector('input[name="type"][value="youtube"]');
    if (defaultType) defaultType.checked = true;
    if (user.telegram) form.contact.value = stripTelegramForInput(user.telegram);
  } catch (err) {
    formNote.textContent = err.message;
    formNote.classList.remove('success');
  }

  setTimeout(() => {
    formNote.textContent = '';
    formNote.classList.remove('success');
  }, 5000);
  return true;
}

form?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
  if (!user) {
    saveOrderDraft();
    window.location.href = `register.html?next=${encodeURIComponent('index.html#contact')}`;
    return;
  }

  await submitOrderFromForm();
  btn.disabled = false;
});

if (typeof Auth !== 'undefined') {
  Auth.init().then(async () => {
    prefillContactForm();

    const draftRaw = sessionStorage.getItem(ORDER_DRAFT_KEY);
    if (!draftRaw) return;

    const draft = JSON.parse(draftRaw);
    applyOrderDraft(draft);

    if (Auth.getCurrentUser() && location.hash === '#contact') {
      sessionStorage.removeItem(ORDER_DRAFT_KEY);
      const btn = form?.querySelector('button[type="submit"]');
      if (btn) btn.disabled = true;
      await submitOrderFromForm();
      if (btn) btn.disabled = false;
    }
  });
}

document.querySelectorAll('.portfolio-item').forEach(item => {
  item.addEventListener('click', () => {
    const title = item.querySelector('h3').textContent;
    alert(`Просмотр: ${title}\n\nЗдесь можно встроить видео или открыть ссылку на YouTube/Vimeo.`);
  });
});

const portfolioMoreToggle = document.getElementById('portfolioMoreToggle');
const portfolioMorePanel = document.getElementById('portfolioMorePanel');

portfolioMoreToggle?.addEventListener('click', () => {
  const isOpen = portfolioMoreToggle.getAttribute('aria-expanded') === 'true';
  const nextOpen = !isOpen;

  portfolioMoreToggle.setAttribute('aria-expanded', String(nextOpen));
  portfolioMorePanel?.classList.toggle('is-open', nextOpen);

  const label = portfolioMoreToggle.querySelector('.youtube-more-toggle-text');
  if (label) {
    label.textContent = nextOpen ? 'Скрыть дополнительные работы' : 'Показать ещё работы';
  }
});