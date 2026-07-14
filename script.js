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

form?.addEventListener('submit', async e => {
  e.preventDefault();
  const btn = form.querySelector('button[type="submit"]');
  btn.disabled = true;

  const user = typeof Auth !== 'undefined' ? Auth.getCurrentUser() : null;

  try {
    if (user) {
      await Auth.addOrder({
        type: form.type.value,
        message: form.message.value,
        contact: form.contact.value,
      });
      formNote.textContent = 'Заявка сохранена в личном кабинете. Мы свяжемся с вами скоро.';
    } else {
      await Auth.submitGuestOrder({
        name: form.name.value,
        type: form.type.value,
        message: form.message.value,
        contact: form.contact.value,
      });
      formNote.textContent = 'Спасибо! Заявка отправлена — мы свяжемся с вами скоро.';
    }

    formNote.classList.add('success');
    form.reset();

    if (user) {
      form.name.value = user.name;
      if (user.telegram) form.contact.value = user.telegram;
    }
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
    const user = Auth.getCurrentUser();
    if (user && form) {
      if (form.name) form.name.value = user.name;
      if (form.contact && user.telegram) form.contact.value = user.telegram;
    }
  });
}

document.querySelectorAll('.portfolio-item').forEach(item => {
  item.addEventListener('click', () => {
    const title = item.querySelector('h3').textContent;
    alert(`Просмотр: ${title}\n\nЗдесь можно встроить видео или открыть ссылку на YouTube/Vimeo.`);
  });
});