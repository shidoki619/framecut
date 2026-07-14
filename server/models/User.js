const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    telegram: { type: String, default: '' },
    avatar: { type: String, default: null },
    role: { type: String, enum: ['user', 'admin'], default: 'user' },
  },
  { timestamps: true }
);

userSchema.methods.toPublic = function toPublic() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    telegram: this.telegram,
    avatar: this.avatar,
    role: this.role,
    createdAt: this.createdAt,
  };
};

module.exports = mongoose.model('User', userSchema);