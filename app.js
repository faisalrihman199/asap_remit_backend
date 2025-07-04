const express = require('express');
const helmet = require('helmet');
const morgan = require('morgan');
const { sequelize } = require('./models');

const app = express();

app.use(express.json());
app.use(helmet());
app.use(morgan('dev'));

// Route imports
app.use('/api', require('./routes'));


// Error Handler
const { errorHandler } = require('./middleware/errorHandler');
app.use(errorHandler);

module.exports = app;
