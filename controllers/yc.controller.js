// controllers/yc.controller.js
const { v4: uuidv4 } = require('uuid');
const { pollUntil } = require('../utils/poll');
const ycExt = require('../services/yellowCardExt');

exports.createYcPayment = async (req, res) => {
  try {
    const {
      amount,
      localAmount,
      destCurrency,
      beneficiary = {},
      country = beneficiary.country || 'NG',
      channelType = 'bank',
      channelId,
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
    };

    const out = await ycExt.createPaymentSmart({
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

    // If we succeeded via payouts, we can’t poll /payments/:id.
    if (!wait) return res.status(200).json({ ok: true, via: out.via, data: out.data });

    if (out.via === 'payments') {
      const id = out.data?.id;
      if (!id) return res.status(200).json({ ok: true, via: 'payments', data: out.data });

      const done = await pollUntil({
        check: async () => ycExt.getPaymentById(id),
        isDone: (r) => (r.status || '').toLowerCase() === 'completed',
        isFail: (r) => (r.status || '').toLowerCase() === 'failed',
        intervalMs: 2500,
        maxWaitMs: 10 * 60 * 1000
      });

      if (!done.done) {
        return res.status(408).json({ ok: false, via: 'payments', id, status: done.resp?.status || 'timeout' });
      }
      return res.status(200).json({ ok: true, via: 'payments', id, status: 'completed' });
    }

    // via payouts — return as-is (if you want polling here, add /v1/payouts/:reference check)
    return res.status(200).json({ ok: true, via: 'payouts', data: out.data });
  } catch (e) {
    const yc = e?.response?.data;
    console.error('createYcPayment error:', yc || e);
    return res.status(400).json({ error: e.message, yc });
  }
};
