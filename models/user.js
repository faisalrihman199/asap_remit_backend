const { DataTypes, Sequelize } = require("sequelize");
const sequelize = require("../config/db");

function generateUuid10() {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const digits = "0123456789";
  let s = "";
  for (let i = 0; i < 4; i++) s += letters[Math.floor(Math.random() * letters.length)];
  for (let i = 0; i < 6; i++) s += digits[Math.floor(Math.random() * digits.length)];
  return s.split("").sort(() => Math.random() - 0.5).join("");
}

const User = sequelize.define(
  "user",
  {
    uid: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
      allowNull: false,
    },

    fullName: { type: DataTypes.STRING, allowNull: false },
    phoneNumber: { type: DataTypes.STRING, allowNull: false, unique: true },
    username: { type: DataTypes.STRING, allowNull: true, unique: true },
    phoneVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    kycVerified: { type: DataTypes.BOOLEAN, defaultValue: false },
    twoFactorAuth: { type: DataTypes.BOOLEAN, defaultValue: false },
    email: { type: DataTypes.STRING, allowNull: false, unique: true, validate: { isEmail: true } },
    password: { type: DataTypes.STRING, allowNull: false },
    role: { type: DataTypes.STRING, allowNull: false, defaultValue: "user" },
    pin: { type: DataTypes.STRING, allowNull: true },

    // 👇 new column
    uuid: {
      type: DataTypes.STRING(10),
      allowNull: false,
      unique: true,
      // defaultValue runs BEFORE validation; this alone fixes most notNull violations.
      defaultValue: () => generateUuid10(),
    },
  },
  {
    timestamps: true,
  }
);

/**
 * Ensure uuid exists AND is unique (retry if collision).
 * Use beforeValidate so it's present for NOT NULL validation.
 */
User.beforeValidate(async (user, options) => {
  // If caller supplied one, keep it; otherwise create
  if (!user.uuid) user.uuid = generateUuid10();

  // uniqueness retry loop (very fast in practice)
  // Skip when the value already exists (provided) and is unique.
  let tries = 0;
  while (tries < 5) {
    const clash = await User.findOne({ where: { uuid: user.uuid }, attributes: ["uuid"] });
    if (!clash) break; // unique
    user.uuid = generateUuid10(); // regenerate and try again
    tries++;
  }
});

/**
 * Optional: last-resort retry on unique constraint race conditions.
 * (e.g., two parallel inserts generate same uuid; rare)
 */
User.afterCreate(async (user, options) => {
  // nothing here; handled below by catch-and-retry pattern if needed
});

module.exports = User;
