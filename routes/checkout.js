const express = require('express');
const router = express.Router();
const db = require('../db');

function calcAmounts(offer) {
  const base = parseFloat(offer.amount);
  const discPct = parseFloat(offer.discount_percent) || 0;
  const discounted = discPct > 0 ? base * (1 - discPct / 100) : base;
  const withVat = discounted * 1.22;
  return { base, discPct, discounted, withVat };
}

router.get('/validate/:code', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT * FROM offers WHERE UPPER(code) = UPPER($1) AND is_active = true`,
      [req.params.code.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ valid: false, message: 'Codice non valido o scaduto' });
    }

    const o = result.rows[0];
    const { base, discPct, discounted, withVat } = calcAmounts(o);

    res.json({
      valid: true,
      offer: {
        code: o.code,
        description: o.description,
        amount: base,
        discount_percent: discPct,
        discounted_amount: discounted,
        amount_with_vat: withVat,
        currency: o.currency,
        billing_cycle: o.billing_cycle,
        billing_months: o.billing_months,
        billing_interval: o.billing_interval,
        billing_interval_count: o.billing_interval_count,
        company_name: o.company_name,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ valid: false, message: 'Errore interno del server' });
  }
});

router.post('/checkout', async (req, res) => {
  try {
    const { code, email } = req.body;
    if (!code) return res.status(400).json({ error: 'Codice mancante' });
    if (!email || !email.includes('@')) return res.status(400).json({ error: 'Email non valida' });

    const result = await db.query(
      'SELECT * FROM offers WHERE UPPER(code) = UPPER($1) AND is_active = true',
      [code.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Codice non valido o scaduto' });
    }

    const offer = result.rows[0];
    const { withVat } = calcAmounts(offer);

    // Crea l'ordine come completato
    const orderResult = await db.query(
      `INSERT INTO orders (offer_id, stripe_session_id, customer_email, amount_paid, status, completed_at)
       VALUES ($1, $2, $3, $4, 'completed', NOW())
       RETURNING id`,
      [offer.id, `manual-${Date.now()}`, email.trim(), parseFloat(withVat.toFixed(2))]
    );

    // Incrementa use_count e disattiva l'offerta se raggiunge il limite
    if (orderResult.rows.length > 0) {
      await db.query(
        `UPDATE offers
         SET use_count = use_count + 1,
             is_active = CASE WHEN use_count + 1 >= max_uses THEN false ELSE is_active END
         WHERE id = $1`,
        [offer.id]
      );
    }

    const baseUrl = process.env.BASE_URL || '';
    res.json({ url: `${baseUrl}/success` });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nella conferma dell\'offerta' });
  }
});

module.exports = router;
