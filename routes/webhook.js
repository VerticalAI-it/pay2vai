const express = require('express');
const router = express.Router();

// Stripe non attivo — stub per compatibilità futura
router.post('/', (req, res) => {
  res.json({ received: true });
});

module.exports = router;
