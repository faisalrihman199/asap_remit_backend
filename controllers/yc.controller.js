// controllers/yc.controller.js
const { pollUntil } = require('../utils/poll');
const ycExt = require('../services/yellowCardExt');

exports.createYcPayment = async (req, res) => {
  try {
    const { amount, destCurrency, beneficiary, networkId, wait = true } = req.body;

    // 1) create the payment
    const p = await ycExt.createPayment({
      amountUSD: amount,
      destCurrency,
      beneficiary,  // { name, country:'NG', bank_code:'044', account_number:'1111111111' }
      networkId,    // optional: if provided, skips discovery
      forceAccept: true
    });

    // return immediately if you don't want to wait
    if (!wait) return res.status(200).json({ ok: true, id: p.id, status: p.status });

    // 2) poll until completed/failed (sandbox resolves fast with special acct numbers)
    const done = await pollUntil({
      check: async () => ycExt.getPaymentById(p.id),
      isDone: (r) => (r.status || '').toLowerCase() === 'completed',
      isFail: (r) => (r.status || '').toLowerCase() === 'failed',
      intervalMs: 2500,
      maxWaitMs: 10 * 60 * 1000
    });

    if (!done.done) {
      return res.status(408).json({ ok: false, id: p.id, status: done.resp?.status || 'timeout' });
    }

    return res.status(200).json({ ok: true, id: p.id, status: 'completed' });
  } catch (e) {
    console.error('createYcPayment error:', e?.response?.data || e);
    return res.status(500).json({ error: e.message, yc: e?.response?.data });
  }
};

exports.getYcPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await ycExt.getPaymentById(id);
    return res.status(200).json({ id, status: r.status, raw: r.raw });
  } catch (e) {
    console.error('getYcPayment error:', e?.response?.data || e);
    return res.status(500).json({ error: e.message, yc: e?.response?.data });
  }
};
