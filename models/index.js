const User = require('./user');
const SilaUser = require('./silaUser');
const OutTransaction = require('./outTransaction');

// User ↔ SilaUser (1:1)
User.hasOne(SilaUser, { foreignKey: 'user_id', as: 'silaDetails', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
SilaUser.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

// User ↔ OutTransaction (1:M)
User.hasMany(OutTransaction, { foreignKey: 'user_id', as: 'outTransactions', onDelete: 'CASCADE', onUpdate: 'CASCADE' });
OutTransaction.belongsTo(User, { foreignKey: 'user_id', as: 'user' });

module.exports = { User, SilaUser, OutTransaction };
