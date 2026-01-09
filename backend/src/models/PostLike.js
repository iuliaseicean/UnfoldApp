// backend/src/models/PostLike.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");
const User = require("./User");
const Post = require("./Post");

const PostLike = sequelize.define(
  "PostLike",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Post,
        key: Post.primaryKeyAttribute || "id",
      },
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User,
        key: User.primaryKeyAttribute || "id",
      },
    },

    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "post_like",
    timestamps: false,
    freezeTableName: true,
    indexes: [
      { unique: true, fields: ["post_id", "user_id"], name: "UQ_post_like_post_user" },
    ],
  }
);

/**
 * Relations (define once)
 * MSSQL: NO ACTION pe user_id ca să eviți multiple cascade paths
 */
if (!PostLike.associations?.Post) {
  Post.hasMany(PostLike, {
    foreignKey: "post_id",
    as: "likes",
    constraints: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  PostLike.belongsTo(Post, {
    foreignKey: "post_id",
    as: "post",
    constraints: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
}

if (!PostLike.associations?.User) {
  User.hasMany(PostLike, {
    foreignKey: "user_id",
    as: "post_likes",
    constraints: true,
    onDelete: "NO ACTION",
    onUpdate: "CASCADE",
  });

  PostLike.belongsTo(User, {
    foreignKey: "user_id",
    as: "User",
    constraints: true,
    onDelete: "NO ACTION",
    onUpdate: "CASCADE",
  });
}

module.exports = PostLike;