const { DataTypes } = require('sequelize');
const sequelize = require("../config/db");
const { v4: uuidv4 } = require('uuid');

const User = sequelize.define("user", {
  uid: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
    allowNull: false
  },
  fullName: {
    type: DataTypes.STRING,
    allowNull: false
  },
  phoneNumber: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true
  },
  username: {
    type: DataTypes.STRING,
    allowNull: true,
    unique: true
  },
  phoneVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  kycVerified: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  twoFactorAuth: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  email: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    validate: {
            isEmail: true, 
        },
  },
  password: {
        type: DataTypes.STRING,
        allowNull: false,
    },
  role: {
    type: DataTypes.STRING,
    allowNull: false,
    defaultValue: 'user'
  },
  pin: {
    type: DataTypes.STRING,
    allowNull: true
  }
}
  , 
  {
    timestamp:true,
    paranoid: true,
  }
)
  
module.exports = User