const router = require("express").Router();
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const auth = require("../middlewares/auth");

// ✅ salvăm în backend/uploads (nu în backend/src/uploads)
const uploadDir = path.join(__dirname, "..", "..", "uploads");
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || "");
    const safeExt = ext || ".jpg";
    cb(null, `${Date.now()}-${Math.round(Math.random() * 1e9)}${safeExt}`);
  },
});

const fileFilter = (_req, file, cb) => {
  if (file?.mimetype?.startsWith("image/")) return cb(null, true);
  cb(new Error("Only image uploads are allowed"));
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 8 * 1024 * 1024 }, // 8MB
});

// ✅ IMPORTANT: pentru telefon (Expo Go), NU folosi host=localhost
// Folosim APP_URL dacă există, ex: http://192.168.100.3:4000
function buildPublicUrl(req, filename) {
  const appUrl = String(process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (appUrl) return `${appUrl}/uploads/${filename}`;

  // fallback (ngrok / proxy)
  const host = req.get("host");
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  return `${proto}://${host}/uploads/${filename}`;
}

async function handleUpload(req, res, next) {
  try {
    if (!req.file) {
      return res
        .status(400)
        .json({ message: "No file uploaded (field name must be 'file')" });
    }

    const url = buildPublicUrl(req, req.file.filename);
    return res.json({ url });
  } catch (e) {
    return next(e);
  }
}

// ✅ suportă ambele: /upload și /upload/image
router.post("/", auth, upload.single("file"), handleUpload);
router.post("/image", auth, upload.single("file"), handleUpload);

module.exports = router;
