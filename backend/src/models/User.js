// backend/src/models/User.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },

    username: {
      type: DataTypes.STRING(50),
      allowNull: false,
    },

    email: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },

    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    bio: {
      type: DataTypes.STRING(255),
      allowNull: true,
    },

    // ✅ reset password fields (există deja în DB la tine, din ce ai arătat)
    resetToken: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    resetTokenExpire: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    /**
     * ✅ IMPORTANT:
     * Dacă NU ai coloanele astea în DB, NU le pune aici ca DataTypes.STRING/BOOLEAN.
     * Dacă vrei să le folosești în frontend “mai târziu”, le poți ține ca VIRTUAL:
     * (nu apar în SELECT, deci nu crăpă)
     */
    avatar_url: {
      type: DataTypes.VIRTUAL,
      get() {
        return null;
      },
    },

    is_private: {
      type: DataTypes.VIRTUAL,
      get() {
        return false;
      },
    },
  },
  {
    tableName: "users",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["email"],
        name: "UQ_users_email",
      },
    ],
  }
);

module.exports = User;