const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Post = sequelize.define(
  "Post",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    user_id: { type: DataTypes.INTEGER, allowNull: false },

    content_text: { type: DataTypes.TEXT, allowNull: true },
    media_url: { type: DataTypes.STRING, allowNull: true },

    visibility: {
      type: DataTypes.STRING(20),
      allowNull: false,
      defaultValue: "public",
    },
  },
  {
    tableName: "posts",
    timestamps: true,
    underscored: true, // asta îți creează created_at / updated_at
  }
);

// asocieri
User.hasMany(Post, { foreignKey: "user_id", onDelete: "CASCADE" });
Post.belongsTo(User, { foreignKey: "user_id" });

module.exports = Post;
