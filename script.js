const header = document.querySelector('.header');
const burger = document.querySelector('.burger');
const mobileMenu = document.querySelector('.mobile-menu');
const form = document.getElementById('contactForm');
const formNote = document.getElementById('formNote');

window.addEventListener('scroll', () => {
  header.classList.toggle('scrolled', window.scrollY > 40);
});

burger?.addEventListener('click', () => {
  mobileMenu.classList.toggle('open');
  burger.classList.toggle('active');
});

mobileMenu?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => {
    mobileMenu.classList.remove('open');
    burger.classList.remove('active');
  });
});

const revealElements = document.querySelectorAll('.reveal');
const revealObserver = new IntersectionObserver(
  entries => {
    entries.forEach((entry, i) => {
      if (entry.isIntersecting) {
        const siblings = [...entry.target.parentElement.querySelectorAll('.reveal')];
        const index = siblings.indexOf(entry.target);
        entry.target.style.transitionDelay = `${index * 0.08}s`;
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.15, rootMargin: '0px 0px -40px 0px' }
);

revealElements.forEach(el => revealObserver.observe(el));

document.querySelectorAll('.reveal').forEach(el => {
  if (el.closest('.hero')) {
    el.classList.add('visible');
    el.style.opacity = '';
    el.style.transform = '';
  }
});

const heroReveals = document.querySelectorAll('.hero .reveal');
heroReveals.forEach((el, i) => {
  el.style.transitionDelay = `${i * 0.1}s`;
  requestAnimationFrame(() => el.classList.add('visible'));
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

function updateContactFormAuth() {
  const gate = document.getElementById('contactLoginGate');
  if (!form) return;

  const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
  if (user) {
    gate?.setAttribute('hidden', '');
    form.hidden = false;
    if (form.contact && user.telegram) {
      form.contact.value = stripTelegramForInput(user.telegram);
    }
  } else {
    gate?.removeAttribute('hidden');
    form.hidden = true;
  }
}

form?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;
  if (!user) {
    window.location.href = 'login.html?next=index.html%23contact';
    return;
  }

  const telegram = normalizeTelegram(form.contact.value);
  if (!telegram) {
    formNote.textContent = 'Укажите Telegram username';
    formNote.classList.remove('success');
    btn.disabled = false;
    return;
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

  btn.disabled = false;
  setTimeout(() => {
    formNote.textContent = '';
    formNote.classList.remove('success');
  }, 5000);
});

if (typeof Auth !== 'undefined') {
  Auth.init().then(() => {
    updateContactFormAuth();
  });
}

document.querySelectorAll('.portfolio-item').forEach(item => {
  item.addEventListener('click', () => {
    const title = item.querySelector('h3').textContent;
    alert(`Просмотр: ${title}\n\nЗдесь можно встроить видео или открыть ссылку на YouTube/Vimeo.`);
  });
});