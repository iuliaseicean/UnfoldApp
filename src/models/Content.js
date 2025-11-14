const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Content = sequelize.define("Content", {
  type: { type: DataTypes.ENUM("post", "capsule"), defaultValue: "post" },
  caption: { type: DataTypes.STRING },
  mediaUrl: { type: DataTypes.STRING }, // simplificăm media la un url
  scheduledAt: { type: DataTypes.DATE, allowNull: true },
  keysEnabled: { type: DataTypes.BOOLEAN, defaultValue: false },
  status: {
    type: DataTypes.ENUM("locked", "open", "archived"),
    defaultValue: "open",
  },
}, {
  tableName: "content",
  timestamps: true,
});

// relații
User.hasMany(Content, { foreignKey: "authorId", onDelete: "CASCADE" });
Content.belongsTo(User, { foreignKey: "authorId" });

module.exports = Content;
