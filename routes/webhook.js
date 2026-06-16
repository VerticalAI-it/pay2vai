const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const db = require('../db');

router.post('/', async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const orderResult = await db.query(
          `UPDATE orders SET
            status = 'completed',
            customer_email = $1,
            amount_paid = $2,
            stripe_subscription_id = $3,
            completed_at = NOW()
           WHERE stripe_session_id = $4
           RETURNING offer_id`,
          [
            session.customer_details?.email || null,
            session.amount_total ? session.amount_total / 100 : null,
            session.subscription || null,
            session.id,
          ]
        );
        if (orderResult.rows.length > 0 && orderResult.rows[0].offer_id) {
          await db.query(
            `UPDATE offers
             SET use_count = use_count + 1,
                 is_active = CASE WHEN use_count + 1 >= max_uses THEN false ELSE is_active END
             WHERE id = $1`,
            [orderResult.rows[0].offer_id]
          );
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        await db.query(
          `UPDATE orders SET status = 'cancelled' WHERE stripe_subscription_id = $1`,
          [sub.id]
        );
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        await db.query(
          `UPDATE orders SET status = 'payment_failed' WHERE stripe_subscription_id = $1`,
          [invoice.subscription]
        );
        break;
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err);
    return res.status(500).json({ error: 'Internal error' });
  }

  res.json({ received: true });
});

module.exports = router;
