const { v4: uuidv4 } = require('uuid');
const { pollUntil } = require('../utils/poll');
const { OutTransaction, SilaUser } = require('../models');
const silaExt = require('../services/silaExt');          // must export moveToCompanyWallet, getTransactionStatusById
const ycExt = require('../services/yellowCardExt');      // must export createPayment, getPaymentById

// POST /api/out-payouts   (user wallet -> company wallet -> YC payment)
exports.orchestratePayout = async (req, res) => {
  try {
    const userId = req.user.uid;
    const { amount, destCurrency, method, beneficiary, source_id } = req.body; // destCurrency/method kept for your model; YC flow uses beneficiary

    // 0) Sila user present?
    const silaUser = await SilaUser.findOne({ where: { user_id: userId } });
    if (!silaUser) return res.status(404).json({ error: 'Sila user not found' });

    // 1) Create tracker row
    const correlationId = uuidv4();
    const idempotencyKey = req.headers['idempotency-key'] || uuidv4();

    const tx = await OutTransaction.create({
      user_id: userId,
      source_amount: amount,
      source_currency: 'USD',
      dest_currency: destCurrency,
      beneficiary_name: beneficiary.name,
      beneficiary_country: beneficiary.country,
      beneficiary_method: method,
      beneficiary,
      idempotency_key: idempotencyKey,
      correlation_id: correlationId,
      sila_status: 'pending',
      overall_status: 'sila_settling'
    });

    // 2) Sila: user wallet -> company wallet
    const transfer = await silaExt.moveToCompanyWallet({
      amount: parseInt(amount, 10),
      userHandle: silaUser.userHandle,
      userPrivateKey: silaUser.privateKey,
      source_id
    });

    const txId = transfer?.data?.transaction_id;
    if (!txId || transfer?.data?.status !== 'SUCCESS') {
      await tx.update({ sila_status: 'failed', overall_status: 'failed' });
      return res.status(400).json({ error: 'Sila wallet->wallet failed', details: transfer?.data });
    }
    await tx.update({ sila_tx_id: txId });

    // 3) Poll Sila until settled
    const silaWait = await pollUntil({
      check: async () => silaExt.getTransactionStatusById(txId, silaUser.userHandle, silaUser.privateKey),
      isDone: (r) => ['success', 'completed'].includes((r.status || '').toLowerCase()),
      isFail: (r) => ['failed', 'reversed', 'canceled', 'cancelled'].includes((r.status || '').toLowerCase()),
      intervalMs: 2000,
      maxWaitMs: 15 * 60 * 1000
    });
    if (!silaWait.done) {
      await tx.update({ sila_status: 'failed', overall_status: 'failed' });
      return res.status(408).json({ error: 'Sila settlement timeout/failed' });
    }
    await tx.update({ sila_status: 'completed', overall_status: 'payout_processing' });

    // 4) Yellow Card: create payment (sandbox)
    // NOTE: we pass amount in USD; the YC wrapper will resolve networkId and set accountType='bank'
    const ycPayment = await ycExt.createPayment({
      amountUSD: amount,
      beneficiary: {
        name: beneficiary.name,
        country: beneficiary.country,          // e.g. 'NG'
        bank_code: beneficiary.bank_code,      // e.g. '044'
        bank_name: beneficiary.bank_name,      // optional if you want to match by name
        account_number: beneficiary.account_number // '1111111111' success, '0000000000' fail (sandbox)
      },
      forceAccept: true
    });

    const paymentId = ycPayment?.id || ycPayment?.data?.id;
    if (!paymentId) {
      await tx.update({ yc_status: 'failed', overall_status: 'failed' });
      return res.status(400).json({ error: 'Yellow Card payment creation failed', details: ycPayment });
    }

    await tx.update({
      yc_reference: paymentId,
      yc_status: (ycPayment?.status || 'processing').toLowerCase(),
      overall_status: 'payout_processing'
    });

    // 5) Poll Yellow Card until completed/failed
    const ycWait = await pollUntil({
      check: async () => ycExt.getPaymentById(paymentId),
      isDone: (r) => (r.status || '').toLowerCase() === 'completed',
      isFail: (r) => (r.status || '').toLowerCase() === 'failed',
      intervalMs: 2500,
      maxWaitMs: 10 * 60 * 1000
    });

    if (!ycWait.done) {
      await tx.update({ yc_status: 'failed', overall_status: 'failed' });
      return res.status(408).json({ error: 'Yellow Card payment timeout/failed' });
    }

    await tx.update({ yc_status: 'completed', overall_status: 'completed' });

    return res.status(200).json({
      ok: true,
      outTransactionId: tx.uid,
      correlationId,
      sila: { transaction_id: txId, settled: true },
      yellowCard: { id: paymentId, status: 'completed' }
    });
  } catch (e) {
    console.error('orchestratePayout error:', e);
    return res.status(500).json({ error: e.message });
  }
};

// GET /api/out-payouts/:id
exports.getOutPayoutStatus = async (req, res) => {
  const { id } = req.params;
  const tx = await OutTransaction.findByPk(id);
  if (!tx) return res.status(404).json({ error: 'Not found' });
  res.json({
    id: tx.uid,
    overall_status: tx.overall_status,
    sila_status: tx.sila_status,
    yc_status: tx.yc_status,
    yc_reference: tx.yc_reference
  });
};
