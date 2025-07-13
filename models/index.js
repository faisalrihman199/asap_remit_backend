const User = require('./user');
const SilaUser = require('./silaUser');

// Define relations
User.hasOne(SilaUser, {
  foreignKey: 'user_id',
  as: 'silaDetails',
  onDelete: 'CASCADE',
  onUpdate: 'CASCADE',
});

SilaUser.belongsTo(User, {
  foreignKey: 'user_id',
  as: 'user',
});

module.exports = {
  User,
  SilaUser,
};
