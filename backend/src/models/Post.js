// backend/src/models/Post.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");

const Post = sequelize.define(
  "Post",
  {
    id: { type: DataTypes.INTEGER, autoIncrement: true, primaryKey: true },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: User.primaryKeyAttribute || "id",
      },
    },

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
    underscored: true, // created_at / updated_at
    freezeTableName: true,
  }
);

/**
 * Relations (define once)
 */
if (!Post.associations?.User) {
  User.hasMany(Post, {
    foreignKey: "user_id",
    as: "posts",
    constraints: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  Post.belongsTo(User, {
    foreignKey: "user_id",
    as: "User", // IMPORTANT: în feed tu primești p.User
    constraints: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
}

module.exports = Post;