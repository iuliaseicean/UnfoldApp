// backend/src/models/PostComment.js
const { DataTypes } = require("sequelize");
const { sequelize } = require("../config/db");

const User = require("./User");
const Post = require("./Post");

const PostComment = sequelize.define(
  "PostComment",
  {
    id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },

    post_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: Post, // sau "post" dacă ai naming diferit în DB
        key: Post.primaryKeyAttribute || "id",
      },
    },

    user_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: User, // sau "user"
        key: User.primaryKeyAttribute || "id",
      },
    },

    // MSSQL: TEXT merge, dar dacă vrei limită poți folosi STRING(2000)
    content_text: { type: DataTypes.TEXT, allowNull: false },

    created_at: { type: DataTypes.DATE, allowNull: false, defaultValue: DataTypes.NOW },
  },
  {
    tableName: "post_comment",
    timestamps: false,
    freezeTableName: true,
  }
);

/**
 * Relations (define once)
 * Important: constraints + onDelete/onUpdate se pun pe asocieri,
 * nu în câmpul raw.
 */
if (!PostComment.associations?.Post) {
  Post.hasMany(PostComment, {
    foreignKey: "post_id",
    as: "comments",
    constraints: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });

  PostComment.belongsTo(Post, {
    foreignKey: "post_id",
    as: "post",
    constraints: true,
    onDelete: "CASCADE",
    onUpdate: "CASCADE",
  });
}

if (!PostComment.associations?.User) {
  User.hasMany(PostComment, {
    foreignKey: "user_id",
    as: "post_comments",
    constraints: true,
    // MSSQL safe: nu șterge comentariile când ștergi user-ul (sau blochează ștergerea)
    onDelete: "NO ACTION",
    onUpdate: "CASCADE",
  });

  PostComment.belongsTo(User, {
    foreignKey: "user_id",
    as: "User", // IMPORTANT: păstrează "User" ca să vină în include exact cum folosești în frontend
    constraints: true,
    onDelete: "NO ACTION",
    onUpdate: "CASCADE",
  });
}

module.exports = PostComment;