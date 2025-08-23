// routes/yc.routes.js
const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/yc.controller');

router.post('/payments', ctrl.createYcPayment);
router.get('/payments/:id', ctrl.getYcPayment);

module.exports = router;
