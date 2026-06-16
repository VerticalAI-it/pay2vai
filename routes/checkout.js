const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
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
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: 'Codice mancante' });

    const result = await db.query(
      'SELECT * FROM offers WHERE UPPER(code) = UPPER($1) AND is_active = true',
      [code.trim()]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Codice non valido o scaduto' });
    }

    const offer = result.rows[0];
    const { discounted, withVat } = calcAmounts(offer);
    const amountCents = Math.round(withVat * 100);
    const isRecurring = offer.billing_cycle === 'recurring_monthly' || offer.billing_cycle === 'recurring';

    const priceData = {
      currency: offer.currency.toLowerCase(),
      product_data: { name: offer.description.split('\n')[0] },
      unit_amount: amountCents,
    };

    if (isRecurring) {
      if (offer.billing_cycle === 'recurring' && offer.billing_interval) {
        priceData.recurring = {
          interval: offer.billing_interval,
          interval_count: offer.billing_interval_count || 1,
        };
      } else {
        priceData.recurring = { interval: 'month', interval_count: 1 };
      }
    }

    const sessionParams = {
      payment_method_types: ['card'],
      line_items: [{ price_data: priceData, quantity: 1 }],
      mode: isRecurring ? 'subscription' : 'payment',
      success_url: `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.BASE_URL}/cancel`,
      metadata: {
        offer_id: offer.id.toString(),
        offer_code: offer.code,
      },
    };

    if (isRecurring && offer.billing_months) {
      const cancelDate = new Date();
      cancelDate.setMonth(cancelDate.getMonth() + parseInt(offer.billing_months));
      sessionParams.subscription_data = {
        cancel_at: Math.floor(cancelDate.getTime() / 1000),
        metadata: { billing_months: offer.billing_months.toString() },
      };
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    await db.query(
      'INSERT INTO orders (offer_id, stripe_session_id, status) VALUES ($1, $2, $3)',
      [offer.id, session.id, 'pending']
    );

    res.json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Errore nella creazione del checkout' });
  }
});

module.exports = router;
