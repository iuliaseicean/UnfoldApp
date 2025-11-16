const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Content = sequelize.define(
  "Content",
  {
    id: {
      type: DataTypes.INTEGER,
      autoIncrement: true,
      primaryKey: true,
    },

    // în loc de ENUM, folosim STRING + validare isIn
    type: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "post",
      validate: {
        isIn: [["post", "capsule"]],
      },
    },

    caption: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    mediaUrl: {
      type: DataTypes.STRING,
      allowNull: true,
    },

    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    keysEnabled: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },

    status: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "open",
      validate: {
        isIn: [["locked", "open", "archived"]],
      },
    },
  },
  {
    tableName: "content",
    timestamps: true,
  }
);

// relații
User.hasMany(Content, { foreignKey: "authorId", onDelete: "CASCADE" });
Content.belongsTo(User, { foreignKey: "authorId" });

module.exports = Content;
