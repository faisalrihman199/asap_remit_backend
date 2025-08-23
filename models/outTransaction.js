const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const User = require('./user');

const OutTransaction = sequelize.define('out_transaction', {
  uid: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: {
    type: DataTypes.UUID, allowNull: false,
    references: { model: User, key: 'uid' },
    onUpdate: 'CASCADE', onDelete: 'CASCADE',
  },

  // money + corridor
  source_amount:   { type: DataTypes.DECIMAL(18,2), allowNull: false },
  source_currency: { type: DataTypes.STRING, allowNull: false, defaultValue: 'USD' },
  dest_currency:   { type: DataTypes.STRING, allowNull: false },

  // recipient snapshot
  beneficiary_name:    { type: DataTypes.STRING, allowNull: false },
  beneficiary_country: { type: DataTypes.STRING, allowNull: false },
  beneficiary_method:  { type: DataTypes.STRING, allowNull: false }, // 'bank_transfer' | 'mobile_money'
  beneficiary:         { type: DataTypes.JSON,  allowNull: false },

  // refs + provider ids
  idempotency_key: { type: DataTypes.STRING, unique: true },
  correlation_id:  { type: DataTypes.STRING, unique: true },
  sila_tx_id:      { type: DataTypes.STRING },
  yc_reference:    { type: DataTypes.STRING },

  // statuses
  sila_status:    { type: DataTypes.STRING, allowNull: false, defaultValue: 'not_started' },
  yc_status:      { type: DataTypes.STRING, allowNull: false, defaultValue: 'not_started' },
  overall_status: { type: DataTypes.STRING, allowNull: false, defaultValue: 'created' },
}, {
  timestamps: true,
  indexes: [
    { fields: ['user_id', 'createdAt'] },
    { fields: ['overall_status'] },
  ],
});

module.exports = OutTransaction;
