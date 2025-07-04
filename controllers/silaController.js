const silaService = require('../services/sila.service');

exports.linkSilaAccount = async (req, res, next) => {
  try {
    const result = await silaService.linkAccount(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.getWallets = async (req, res, next) => {
  try {
    const result = await silaService.getWallets(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

exports.sendMoney = async (req, res, next) => {
  try {
    const result = await silaService.sendMoney(req.body);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};
