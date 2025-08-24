// controllers/yc.controller.js
const { v4: uuidv4 } = require('uuid');
const { pollUntil } = require('../utils/poll');
const ycExt = require('../services/yellowCardExt');

exports.createYcPayment = async (req, res) => {
  try {
    const {
      amount,                 // USD amount (or use localAmount)
      localAmount,
      destCurrency,           // e.g. 'NGN'
      beneficiary = {},       // bank: { name, country:'NG', account_number:'1111111111', bank_code:'044', bank_name? }
      country = beneficiary.country || 'NG',
      channelType = 'bank',   // 'bank' | 'momo'
      channelId,              // optional
      reason = 'other',
      sequenceId,
      wait = true,
      sender
    } = req.body;

    const finalSender = (sender && sender.name && sender.country) ? sender : {
      name: 'Sandbox Tester',
      country: 'US',
      phone: '+12025550123',
      email: 'sandbox@example.com',
      address: '1 Market St, SF, CA',
      dob: '01/01/1990',
      idType: 'license',
      idNumber: 'A1234567'
      // If you switch to sender.country='NG', YC may require NIN/BVN in sandbox.
    };

    if (!beneficiary.name) return res.status(400).json({ error: 'beneficiary.name is required' });
    if (channelType === 'bank' && !beneficiary.account_number) {
      return res.status(400).json({ error: 'beneficiary.account_number is required for bank payouts' });
    }
    if (amount == null && localAmount == null) {
      return res.status(400).json({ error: 'Provide amount (USD) or localAmount' });
    }

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
      sequenceId: sequenceId || uuidv4(),
      forceAccept: true
    });

    if (!wait) return res.status(200).json({ ok: true, id: payment.id, status: payment.status, data: payment });

    const done = await pollUntil({
      check: async () => ycExt.getPaymentById(payment.id),
      isDone: (r) => (r.status || '').toLowerCase() === 'completed',
      isFail: (r) => (r.status || '').toLowerCase() === 'failed',
      intervalMs: 2500,
      maxWaitMs: 10 * 60 * 1000
    });

    if (!done.done) {
      return res.status(408).json({ ok: false, id: payment.id, status: done.resp?.status || 'timeout' });
    }

    return res.status(200).json({ ok: true, id: payment.id, status: 'completed' });
  } catch (e) {
    const yc = e?.response?.data;
    console.error('createYcPayment error:', yc || e);
    return res.status(400).json({ error: e.message, yc });
  }
};

exports.getYcPayment = async (req, res) => {
  try {
    const { id } = req.params;
    const r = await ycExt.getPaymentById(id);
    return res.status(200).json({ id, status: r.status, raw: r.raw });
  } catch (e) {
    const yc = e?.response?.data;
    console.error('getYcPayment error:', yc || e);
    return res.status(500).json({ error: e.message, yc });
  }
};
