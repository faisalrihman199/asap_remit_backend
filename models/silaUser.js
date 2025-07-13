const { DataTypes } = require('sequelize');
const sequelize = require('../config/db');
const { v4: uuidv4 } = require('uuid');
const User = require('./user'); // adjust path if needed

const SilaUser = sequelize.define('sila_user', {
  uid: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: User,
      key: 'uid', // adjust to match your actual PK in User model
    },
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE',
  },
  userHandle: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  firstName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  lastName: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  phone: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  city: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  state: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  zip: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  dob: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  ssn: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  cryptoAddress: {
    type: DataTypes.STRING,
    allowNull: false,
  },
  privateKey: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  walletNickname: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  accountName: {
    type: DataTypes.STRING,
    allowNull: true,
  },
  kycStatus: {
    type: DataTypes.STRING,
    defaultValue: 'not_requested', // pending | passed | failed
  },
  bankLinkStatus: {
    type: DataTypes.STRING,
    defaultValue: 'unlinked', // linked | verified
  },
  lastSilaReferenceId: {
    type: DataTypes.STRING,
    allowNull: true,
  },
}, {
  timestamps: true,
  paranoid: true,
});

module.exports=SilaUser