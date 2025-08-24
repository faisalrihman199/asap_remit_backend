// controllers/yc.controller.js
const { v4: uuidv4 } = require('uuid');
const { pollUntil } = require('../utils/poll');
const ycExt = require('../services/yellowCardExt');

// POST /yc/payments
exports.createYcPayment = async (req, res) => {
  try {
    const {
      // amounts
      amount,                 // USD amount (or send localAmount instead)
      localAmount,
      destCurrency,           // e.g. 'NGN'

      // destination beneficiary
      beneficiary = {},       // { name, country:'NG', account_number:'1111111111', bank_code:'044' }

      // meta / options
      country = beneficiary.country || 'NG',
      channelType = 'bank',   // 'bank' | 'momo'
      channelId,              // optional; auto-resolved if missing
      networkId,              // optional; rarely needed if bank_code provided
      reason = 'other',
      sequenceId,             // optional; auto if missing
      wait = true,

      // sender KYC (if not provided, we supply safe sandbox defaults)
      sender
    } = req.body;

    const finalSender = sender && sender.name && sender.country ? sender : {
      // minimal sandbox sender (USA license works fine in sandbox)
      name: 'Sandbox Tester',
      country: 'US',
      phone: '+12025550123',
      email: 'sandbox@example.com',
      address: '1 Market St, SF, CA',
      dob: '01/01/1990',
      idType: 'license',
      idNumber: 'A1234567'
      // NOTE: if you set country: 'NG', YC may require NIN + BVN as additional IDs.
    };

    // Quick validations so YC doesn't 400 on obvious misses
    if (!beneficiary.name) {
      return res.status(400).json({ error: 'beneficiary.name is required' });
    }
    if (channelType === 'bank' && !beneficiary.account_number) {
      return res.status(400).json({ error: 'beneficiary.account_number is required for bank payouts' });
    }
    if (!amount && !localAmount) {
      return res.status(400).json({ error: 'Provide amount (USD) or localAmount' });
    }

    // Create YC payment (auto-resolves channelId; networkId only if needed)
    const payment = await ycExt.createPaymentSmart({
      amountUSD: amount,
      localAmount,
      destCurrency,
      country,
      channelType,
      reason,
      sender: finalSender,
      beneficiary,
      channelId,
      networkId,
      sequenceId: sequenceId || uuidv4(),
      forceAccept: true
    });

    // Return immediately if you don't want to poll
    if (!wait) return res.status(200).json({ ok: true, id: payment.id, status: payment.status, data: payment });

    // Poll until completed or failed
    const done = await pollUntil({
      check: async () => ycExt.getPaymentById(payment.id),
      isDone: (r) => (r.status || '').toLowerCase() === 'completed',
      isFail: (r) => (r.status || '').toLowerCase() === 'failed',
      intervalMs: 2500,
      maxWaitMs: 10 * 60 * 1000
    });

    if (!done.done) {
      return res.status(408).json({
        ok: false,
        id: payment.id,
        status: done.resp?.status || 'timeout'
      });
    }

    return res.status(200).json({ ok: true, id: payment.id, status: 'completed' });
  } catch (e) {
    // surface YC's JSON when present
    const yc = e?.response?.data || undefined;
    console.error('createYcPayment error:', yc || e);
    return res.status(400).json({ error: e.message, yc });
  }
};

// GET /yc/payments/:id
exports.getYcPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await ycExt.getPaymentById(id);
    return res.status(200).json({ id, status: r.status, raw: r.raw });
  } catch (e) {
    const yc = e?.response?.data || undefined;
    console.error('getYcPayment error:', yc || e);
    return res.status(500).json({ error: e.message, yc });
  }
};
