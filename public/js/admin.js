(() => {
  let adminToken = sessionStorage.getItem('p2v_admin_token') || '';

  const loginOverlay = document.getElementById('login-overlay');
  const app          = document.getElementById('app');
  const loginError   = document.getElementById('login-error');

  // ---- Auth ----

  function applyAuth() {
    if (adminToken) { loginOverlay.classList.add('hidden'); app.classList.remove('hidden'); }
  }

  document.getElementById('login-btn').addEventListener('click', async () => {
    const token = document.getElementById('token-input').value.trim();
    if (!token) return;
    const res = await fetch('/api/admin/offers', { headers: { 'x-admin-token': token } });
    if (res.status === 401) { loginError.classList.remove('hidden'); return; }
    adminToken = token;
    sessionStorage.setItem('p2v_admin_token', token);
    loginError.classList.add('hidden');
    applyAuth();
    initForm();
    loadOffers();
  });

  document.getElementById('token-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('login-btn').click();
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    sessionStorage.removeItem('p2v_admin_token');
    adminToken = '';
    loginOverlay.classList.remove('hidden');
    app.classList.add('hidden');
  });

  // ---- Tabs ----

  window.switchTab = (tab) => {
    ['offers', 'orders'].forEach((t) => {
      document.getElementById(`tab-${t}`).classList.toggle('hidden', t !== tab);
      document.querySelector(`[data-tab="${t}"]`).className =
        t === tab ? 'tab-active pb-3 px-1 text-sm transition' : 'tab-inactive pb-3 px-1 text-sm transition';
    });
    if (tab === 'orders') loadOrders();
  };

  // ---- Helpers ----

  function authHeaders() {
    return { 'Content-Type': 'application/json', 'x-admin-token': adminToken };
  }

  function fmt(amount, currency = 'EUR') {
    return new Intl.NumberFormat('it-IT', { style: 'currency', currency }).format(amount);
  }

  function fmtDate(iso) {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }

  function badgeHtml(is_active, use_count, max_uses) {
    if (use_count >= max_uses) {
      return '<span class="badge-inactive text-xs font-semibold px-2 py-0.5 rounded-full">Esaurita</span>';
    }
    return is_active
      ? '<span class="badge-active text-xs font-semibold px-2 py-0.5 rounded-full">Attiva</span>'
      : '<span class="badge-inactive text-xs font-semibold px-2 py-0.5 rounded-full">Inattiva</span>';
  }

  function orderBadge(status) {
    const map = {
      pending:        ['badge-pending',   'In attesa'],
      completed:      ['badge-completed', 'Completato'],
      payment_failed: ['badge-failed',    'Fallito'],
      cancelled:      ['badge-failed',    'Cancellato'],
    };
    const [cls, label] = map[status] || ['badge-pending', status];
    return `<span class="${cls} text-xs font-semibold px-2 py-0.5 rounded-full">${label}</span>`;
  }

  function billingText(billing_cycle, billing_months, billing_interval, billing_interval_count) {
    if (billing_cycle === 'one_time') return 'Una tantum';
    if (billing_cycle === 'recurring') {
      const count = billing_interval_count || 1;
      const labels = { day: ['giorno','giorni'], week: ['settimana','settimane'], month: ['mese','mesi'], year: ['anno','anni'] };
      const [s, p] = labels[billing_interval] || ['mese','mesi'];
      return count === 1 ? `Ogni ${s}` : `Ogni ${count} ${p}`;
    }
    if (billing_months) return `Mensile · ${billing_months} mesi`;
    return 'Mensile';
  }

  // ---- Description rows ----

  let descRowCount = 0;

  function addDescRow(value = '') {
    const container = document.getElementById('description-container');
    const idx = descRowCount++;
    const wrapper = document.createElement('div');
    wrapper.className = 'flex gap-2 items-start';
    wrapper.dataset.idx = idx;
    wrapper.innerHTML = `
      <textarea id="f-desc-${idx}" rows="2" placeholder="Descrizione paragrafo ${idx + 1}…"
        class="flex-1 border border-gray-300 rounded-xl px-4 py-2.5 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-indigo-400"
      >${value}</textarea>
      ${idx > 0 ? `<button type="button" onclick="removeDescRow(this)" title="Rimuovi paragrafo"
        class="mt-1 text-gray-300 hover:text-red-400 transition text-lg leading-none">×</button>` : ''}
    `;
    container.appendChild(wrapper);
  }

  window.removeDescRow = (btn) => {
    btn.closest('[data-idx]').remove();
  };

  document.getElementById('add-desc-btn').addEventListener('click', () => addDescRow());

  // ---- Billing type ----

  window.onBillingTypeChange = () => {
    const val = document.getElementById('f-billing-type').value;
    document.getElementById('billing-months-wrap').classList.toggle('hidden', val !== 'recurring_limited');
    document.getElementById('billing-custom-wrap').classList.toggle('hidden', val !== 'recurring_custom');
  };

  // ---- Invoice toggle ----

  window.toggleInvoice = () => {
    const fields = document.getElementById('invoice-fields');
    const btn    = document.getElementById('toggle-invoice-btn');
    const hidden = fields.classList.toggle('hidden');
    btn.textContent = hidden ? 'Mostra campi' : 'Nascondi campi';
  };

  // ---- Email toggle ----

  window.toggleEmailField = () => {
    const checked = document.getElementById('f-send-email').checked;
    document.getElementById('email-field-wrap').classList.toggle('hidden', !checked);
  };

  // ---- Price preview ----

  window.updatePricePreview = () => {
    const amount   = parseFloat(document.getElementById('f-amount').value) || 0;
    const discount = parseFloat(document.getElementById('f-discount').value) || 0;
    const currency = document.getElementById('f-currency').value || 'EUR';
    const preview  = document.getElementById('price-preview');

    if (!amount) { preview.classList.add('hidden'); return; }

    const discounted = discount > 0 ? amount * (1 - discount / 100) : amount;
    const withVat    = discounted * 1.22;

    document.getElementById('pp-original').textContent   = discount > 0 ? fmt(amount, currency) : '';
    document.getElementById('pp-discounted').textContent = fmt(discounted, currency);
    document.getElementById('pp-vat').textContent        = fmt(withVat, currency);
    preview.classList.remove('hidden');
  };

  // Update preview when currency changes too
  document.getElementById('f-currency').addEventListener('change', updatePricePreview);

  // ---- Offers ----

  window.loadOffers = async () => {
    document.getElementById('offers-loading').classList.remove('hidden');
    document.getElementById('offers-table').classList.add('hidden');
    document.getElementById('offers-empty').classList.add('hidden');

    const res  = await fetch('/api/admin/offers', { headers: authHeaders() });
    const rows = await res.json();

    document.getElementById('offers-loading').classList.add('hidden');

    if (!rows.length) { document.getElementById('offers-empty').classList.remove('hidden'); return; }

    const tbody = document.getElementById('offers-body');
    tbody.innerHTML = rows.map((o) => {
      const base = parseFloat(o.amount);
      const disc = parseFloat(o.discount_percent) || 0;
      const discounted = disc > 0 ? base * (1 - disc / 100) : base;
      const priceCell = disc > 0
        ? `<span class="line-through text-gray-300 text-xs mr-1">${fmt(base, o.currency)}</span>${fmt(discounted, o.currency)}<span class="text-xs text-gray-400 ml-1">IVA escl.</span>`
        : `${fmt(base, o.currency)}<span class="text-xs text-gray-400 ml-1">IVA escl.</span>`;
      const clientLabel = o.company_name
        ? `<span class="font-medium text-gray-700">${o.company_name}</span><br/><span class="text-gray-400 text-xs">${(o.description || '').substring(0, 40)}…</span>`
        : `<span class="text-gray-600">${(o.description || '').substring(0, 55)}</span>`;
      const useCount = parseInt(o.use_count) || 0;
      const maxUses  = parseInt(o.max_uses)  || 1;
      const exhausted = useCount >= maxUses;
      const toggleBtn = exhausted
        ? '<span class="text-xs text-gray-300">Esaurita</span>'
        : `<button onclick="toggleOffer(${o.id}, ${!o.is_active})"
            class="text-xs text-indigo-500 hover:text-indigo-700 font-medium">
            ${o.is_active ? 'Disattiva' : 'Attiva'}
          </button>`;
      return `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-3 font-mono font-semibold text-gray-800">${o.code}</td>
        <td class="px-6 py-3">${clientLabel}</td>
        <td class="px-6 py-3 font-semibold text-gray-800 whitespace-nowrap">${priceCell}</td>
        <td class="px-6 py-3 text-gray-500 whitespace-nowrap">${billingText(o.billing_cycle, o.billing_months, o.billing_interval, o.billing_interval_count)}</td>
        <td class="px-6 py-3">
          ${badgeHtml(o.is_active, useCount, maxUses)}
          <span class="block text-xs text-gray-400 mt-0.5">${useCount}/${maxUses} utilizzi</span>
        </td>
        <td class="px-6 py-3 flex gap-3">
          ${toggleBtn}
          <button onclick="deleteOffer(${o.id})"
            class="text-xs text-red-400 hover:text-red-600 font-medium">
            Elimina
          </button>
        </td>
      </tr>`;
    }).join('');

    document.getElementById('offers-table').classList.remove('hidden');
  };

  window.toggleOffer = async (id, is_active) => {
    await fetch(`/api/admin/offers/${id}`, {
      method: 'PATCH', headers: authHeaders(), body: JSON.stringify({ is_active }),
    });
    loadOffers();
  };

  window.deleteOffer = async (id) => {
    if (!confirm('Eliminare questa offerta?')) return;
    await fetch(`/api/admin/offers/${id}`, { method: 'DELETE', headers: authHeaders() });
    loadOffers();
  };

  document.getElementById('create-btn').addEventListener('click', async () => {
    const formError   = document.getElementById('form-error');
    const formSuccess = document.getElementById('form-success');
    formError.classList.add('hidden');
    formSuccess.classList.add('hidden');

    // Gather description paragraphs
    const descTexts = Array.from(
      document.querySelectorAll('#description-container textarea')
    ).map((ta) => ta.value.trim()).filter(Boolean);

    const billingType   = document.getElementById('f-billing-type').value;
    const billingMonths = billingType === 'recurring_limited'
      ? parseInt(document.getElementById('f-billing-months').value)
      : null;
    const billingInterval      = document.getElementById('f-billing-interval').value;
    const billingIntervalCount = parseInt(document.getElementById('f-billing-interval-count').value) || 1;

    let billingCycle = 'one_time';
    if (billingType === 'recurring' || billingType === 'recurring_limited') billingCycle = 'recurring_monthly';
    if (billingType === 'recurring_custom') billingCycle = 'recurring';

    const payload = {
      code:          document.getElementById('f-code').value.trim(),
      description:   descTexts.join('\n\n'),
      amount:        parseFloat(document.getElementById('f-amount').value),
      currency:      document.getElementById('f-currency').value,
      billing_cycle: billingCycle,
      billing_months: billingMonths || undefined,
      billing_interval:       billingType === 'recurring_custom' ? billingInterval : undefined,
      billing_interval_count: billingType === 'recurring_custom' ? billingIntervalCount : undefined,
      discount_percent: parseFloat(document.getElementById('f-discount').value) || undefined,
      company_name:    document.getElementById('f-company-name').value.trim() || undefined,
      company_address: document.getElementById('f-company-address').value.trim() || undefined,
      company_zip:     document.getElementById('f-company-zip').value.trim() || undefined,
      company_pec:     document.getElementById('f-company-pec').value.trim() || undefined,
      company_phone:   document.getElementById('f-company-phone').value.trim() || undefined,
      company_sdi:     document.getElementById('f-company-sdi').value.trim() || undefined,
      send_email:   document.getElementById('f-send-email').checked || undefined,
      client_email: document.getElementById('f-client-email').value.trim() || undefined,
    };

    if (!payload.code || !payload.description || isNaN(payload.amount)) {
      formError.textContent = 'Compila tutti i campi obbligatori (codice, descrizione, prezzo).';
      formError.classList.remove('hidden');
      return;
    }
    if (billingType === 'recurring_limited' && (!billingMonths || billingMonths < 1)) {
      formError.textContent = 'Inserisci un numero di mesi valido.';
      formError.classList.remove('hidden');
      return;
    }
    if (billingType === 'recurring_custom' && billingIntervalCount < 1) {
      formError.textContent = 'Inserisci un intervallo valido (es. 7 giorni).';
      formError.classList.remove('hidden');
      return;
    }
    if (payload.send_email && !payload.client_email) {
      formError.textContent = 'Inserisci l\'email del cliente per l\'invio.';
      formError.classList.remove('hidden');
      return;
    }

    const res  = await fetch('/api/admin/offers', {
      method: 'POST', headers: authHeaders(), body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      formError.textContent = data.error || 'Errore nella creazione.';
      formError.classList.remove('hidden');
      return;
    }

    const emailNote = payload.send_email ? ' · Email inviata.' : '';
    formSuccess.textContent = `Offerta "${data.code}" creata con successo!${emailNote}`;
    formSuccess.classList.remove('hidden');

    // Reset form
    document.getElementById('f-code').value = '';
    document.getElementById('f-amount').value = '';
    document.getElementById('f-discount').value = '';
    document.getElementById('description-container').innerHTML = '';
    descRowCount = 0;
    addDescRow();
    document.getElementById('f-company-name').value    = '';
    document.getElementById('f-company-address').value = '';
    document.getElementById('f-company-zip').value     = '';
    document.getElementById('f-company-pec').value     = '';
    document.getElementById('f-company-phone').value   = '';
    document.getElementById('f-company-sdi').value     = '';
    document.getElementById('f-send-email').checked    = false;
    document.getElementById('f-client-email').value    = '';
    document.getElementById('email-field-wrap').classList.add('hidden');
    document.getElementById('price-preview').classList.add('hidden');
    document.getElementById('f-billing-type').value = 'one_time';
    onBillingTypeChange();

    loadOffers();
  });

  // ---- Orders ----

  window.loadOrders = async () => {
    document.getElementById('orders-loading').classList.remove('hidden');
    document.getElementById('orders-table').classList.add('hidden');
    document.getElementById('orders-empty').classList.add('hidden');

    const res  = await fetch('/api/admin/orders', { headers: authHeaders() });
    const rows = await res.json();

    document.getElementById('orders-loading').classList.add('hidden');

    if (!rows.length) { document.getElementById('orders-empty').classList.remove('hidden'); return; }

    const tbody = document.getElementById('orders-body');
    tbody.innerHTML = rows.map((o) => `
      <tr class="hover:bg-gray-50">
        <td class="px-6 py-3 text-gray-500">${fmtDate(o.created_at)}</td>
        <td class="px-6 py-3 text-gray-700">${o.customer_email || '—'}</td>
        <td class="px-6 py-3 font-mono text-gray-700">${o.offer_code || '—'}</td>
        <td class="px-6 py-3 font-semibold text-gray-800">${o.amount_paid != null ? fmt(o.amount_paid) : '—'}</td>
        <td class="px-6 py-3 text-gray-500">${billingText(o.billing_cycle, o.billing_months, o.billing_interval, o.billing_interval_count)}</td>
        <td class="px-6 py-3">${orderBadge(o.status)}</td>
      </tr>
    `).join('');

    document.getElementById('orders-table').classList.remove('hidden');
  };

  // ---- Init ----

  function initForm() {
    if (!document.querySelector('#description-container textarea')) {
      addDescRow();
    }
  }

  applyAuth();
  if (adminToken) { initForm(); loadOffers(); }

})();
