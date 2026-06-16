(() => {
  const input       = document.getElementById('code-input');
  const validateBtn = document.getElementById('validate-btn');
  const errorMsg    = document.getElementById('error-msg');
  const errorText   = document.getElementById('error-text');
  const loadingMsg  = document.getElementById('loading-msg');
  const offerBox    = document.getElementById('offer-box');
  const payBtn      = document.getElementById('pay-btn');
  const payBtnText  = document.getElementById('pay-btn-text');
  const paySpinner  = document.getElementById('pay-spinner');
  const emailInput  = document.getElementById('email-input');
  const emailError  = document.getElementById('email-error');

  let currentCode = null;
  let debounceTimer = null;

  const fmt = (amount, currency = 'EUR') =>
    new Intl.NumberFormat('it-IT', { style: 'currency', currency, minimumFractionDigits: 2 }).format(amount);

  function showError(msg) {
    errorText.textContent = msg;
    errorMsg.classList.remove('hidden');
    loadingMsg.classList.add('hidden');
    offerBox.classList.add('hidden');
    currentCode = null;
  }

  function hideError() { errorMsg.classList.add('hidden'); }

  function showLoading() {
    hideError();
    loadingMsg.classList.remove('hidden');
    offerBox.classList.add('hidden');
  }

  function hideLoading() { loadingMsg.classList.add('hidden'); }

  function showOffer(offer) {
    hideError();
    hideLoading();
    currentCode = offer.code;

    // Greeting
    const greeting = document.getElementById('offer-greeting');
    greeting.textContent = offer.company_name
      ? `Offerta per ${offer.company_name}`
      : 'La tua offerta esclusiva';

    // Description — render each paragraph
    const descEl = document.getElementById('offer-description');
    descEl.innerHTML = '';
    const paras = (offer.description || '').split(/\n+/).filter(Boolean);
    paras.forEach((p) => {
      const el = document.createElement('p');
      el.textContent = p;
      descEl.appendChild(el);
    });

    // Pricing
    const isRecurring = offer.billing_cycle === 'recurring_monthly' || offer.billing_cycle === 'recurring';
    let cycleLabel = isRecurring ? '/mese' : ' una tantum';
    let cycleLabelVat = isRecurring ? '/mese' : '';

    if (offer.billing_cycle === 'recurring' && offer.billing_interval) {
      const count = offer.billing_interval_count || 1;
      const singular = { day: 'giorno', week: 'settimana', month: 'mese', year: 'anno' };
      const plural   = { day: 'giorni',  week: 'settimane', month: 'mesi',  year: 'anni'  };
      const name = count === 1 ? singular[offer.billing_interval] : plural[offer.billing_interval];
      cycleLabel = count === 1 ? `/${name}` : `ogni ${count} ${name}`;
      cycleLabelVat = cycleLabel;
    }

    if (offer.discount_percent > 0) {
      const origEl = document.getElementById('offer-price-original');
      origEl.textContent = fmt(offer.amount, offer.currency);
      origEl.classList.remove('hidden');
      document.getElementById('offer-discount-badge').textContent = `−${offer.discount_percent}%`;
      document.getElementById('offer-discount-badge').classList.remove('hidden');
    }

    document.getElementById('offer-price').textContent   = fmt(offer.discounted_amount, offer.currency);
    document.getElementById('offer-cycle').textContent   = cycleLabel;
    document.getElementById('offer-price-vat').textContent = fmt(offer.amount_with_vat, offer.currency);
    document.getElementById('offer-cycle-vat').textContent = cycleLabelVat;
    document.getElementById('offer-code').textContent    = offer.code;

    // Badge
    let badgeText = isRecurring ? 'Abbonamento mensile' : 'Pagamento unico';
    if (offer.billing_cycle === 'recurring' && offer.billing_interval) {
      const count = offer.billing_interval_count || 1;
      const singular = { day: 'giornaliero', week: 'settimanale', month: 'mensile', year: 'annuale' };
      badgeText = count === 1
        ? `Abbonamento ${singular[offer.billing_interval]}`
        : `Ogni ${count} ${({ day: 'giorni', week: 'settimane', month: 'mesi', year: 'anni' })[offer.billing_interval]}`;
    } else if (isRecurring && offer.billing_months) {
      badgeText = `${offer.billing_months} mesi`;
    }
    document.getElementById('offer-badge').textContent = badgeText;

    // Invoice info
    const invoiceEl   = document.getElementById('offer-invoice');
    const invoiceBody = document.getElementById('offer-invoice-body');
    const invoiceLines = [
      offer.company_name,
      offer.company_address,
      offer.company_zip,
      offer.company_pec   ? `PEC: ${offer.company_pec}`   : null,
      offer.company_phone ? `Tel: ${offer.company_phone}` : null,
      offer.company_sdi   ? `SDI: ${offer.company_sdi}`   : null,
    ].filter(Boolean);

    if (invoiceLines.length) {
      invoiceBody.innerHTML = invoiceLines
        .map((l) => `<p class="text-gray-600">${l}</p>`)
        .join('');
      invoiceEl.classList.remove('hidden');
    } else {
      invoiceEl.classList.add('hidden');
    }

    offerBox.classList.remove('hidden');
  }

  async function validateCode(code) {
    if (!code) { hideError(); hideLoading(); offerBox.classList.add('hidden'); currentCode = null; return; }

    showLoading();
    validateBtn.disabled = true;
    try {
      const res  = await fetch(`/api/validate/${encodeURIComponent(code)}`);
      const data = await res.json();
      if (res.ok && data.valid) {
        showOffer(data.offer);
      } else {
        showError(data.message || 'Codice non valido o scaduto');
      }
    } catch {
      showError('Errore di connessione. Riprova.');
    } finally {
      validateBtn.disabled = false;
    }
  }

  // ---- Input events ----

  validateBtn.addEventListener('click', () => {
    validateCode(input.value.trim().toUpperCase());
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') validateCode(input.value.trim().toUpperCase());
  });

  input.addEventListener('input', () => {
    clearTimeout(debounceTimer);
    const code = input.value.trim().toUpperCase();
    if (!code) { hideError(); hideLoading(); offerBox.classList.add('hidden'); currentCode = null; return; }
    debounceTimer = setTimeout(() => validateCode(code), 600);
  });

  // ---- Checkout ----

  payBtn.addEventListener('click', async () => {
    if (!currentCode) return;

    const email = emailInput ? emailInput.value.trim() : '';
    if (!email || !email.includes('@')) {
      if (emailError) emailError.classList.remove('hidden');
      emailInput && emailInput.focus();
      return;
    }
    if (emailError) emailError.classList.add('hidden');

    payBtnText.textContent = 'Conferma in corso…';
    paySpinner.classList.remove('hidden');
    payBtn.disabled = true;

    try {
      const res  = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: currentCode, email }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
      } else {
        showError(data.error || 'Errore nella conferma. Riprova.');
        payBtnText.textContent = 'Conferma e attiva l\'offerta';
        paySpinner.classList.add('hidden');
        payBtn.disabled = false;
      }
    } catch {
      showError('Errore di connessione. Riprova.');
      payBtnText.textContent = 'Conferma e attiva l\'offerta';
      paySpinner.classList.add('hidden');
      payBtn.disabled = false;
    }
  });

  // ---- URL param auto-load ----

  const urlCode = new URLSearchParams(window.location.search).get('code');
  if (urlCode) {
    // Hide input section, update subtitle, auto-load
    document.getElementById('code-section').classList.add('hidden');
    document.getElementById('page-subtitle').textContent =
      'Stiamo caricando la tua offerta personalizzata…';
    validateCode(urlCode.trim().toUpperCase());
  }

})();
