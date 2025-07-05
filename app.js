const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const cors = require('cors'); // <-- added

const { sequelize } = require('./models');

const app = express();

// === Middleware ===
app.use(cors()); // <-- added here
app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// === Routes ===
app.use('/api', require('./routes'));

// === Error Handler ===
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
