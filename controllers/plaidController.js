const plaidService = require('../services/plaid.service');

exports.createLinkToken = async (req, res, next) => {
  try {
    const userId = req.body.user_id || 'test_user_' + Date.now();
    const token = await plaidService.createLinkToken(userId);
    res.json({ success: true, link_token: token });
  } catch (err) {
    next(err);
  }
};
exports.createPublicToken = async (req, res, next) => {
  try {
    const token = await plaidService.createSandboxPublicToken();
    res.json({ success: true, link_token: token });
  } catch (err) {
    next(err);
  }
};

exports.exchangePublicToken = async (req, res, next) => {
  try {
    const { public_token } = req.body;
    if (!public_token) {
      return res.status(400).json({ error: 'Missing public_token' });
    }
    const result = await plaidService.exchangePublicToken(public_token);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.getAccounts = async (req, res, next) => {
  try {
    const { access_token } = req.body;
    if (!access_token) {
      return res.status(400).json({ error: 'Missing access_token' });
    }
    const accounts = await plaidService.getAccounts(access_token);
    res.json({ success: true, accounts });
  } catch (err) {
    next(err);
  }
};

exports.createProcessorToken = async (req, res, next) => {
  try {
    const { access_token, account_id } = req.body;
    if (!access_token || !account_id) {
      return res.status(400).json({ error: 'Missing access_token or account_id' });
    }
    const token = await plaidService.createProcessorToken(access_token, account_id);
    res.json({ success: true, processor_token: token });
  } catch (err) {
    next(err);
  }
};
