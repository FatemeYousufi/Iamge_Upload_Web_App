import express from "express";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
import multer from "multer";

const app = express();

const dataPath = "./data.json";
const uploadsPath = path.join(__dirname, "public", "uploads");

// Ensure required folders and files
if (!fs.existsSync("public")) fs.mkdirSync("public");
if (!fs.existsSync(path.join("public", "css")))
  fs.mkdirSync(path.join("public", "css"));
if (!fs.existsSync(uploadsPath)) fs.mkdirSync(uploadsPath, { recursive: true });
if (!fs.existsSync(dataPath)) fs.writeFileSync(dataPath, "[]", "utf8");

// Multer config
const storage = multer.diskStorage({
  destination: uploadsPath,
  filename: (req, file, cb) =>
    cb(null, Date.now() + path.extname(file.originalname)),
});

const upload = multer({ storage }).array("images", 10);
const singleUpload = multer({ storage }).single("newImage");

// Utility functions
const readImageData = () => JSON.parse(fs.readFileSync(dataPath));
const writeImageData = (data) =>
  fs.writeFileSync(dataPath, JSON.stringify(data, null, 2));

// Middleware
app.set("view engine", "ejs");
app.use(express.static("public"));
app.use(express.urlencoded({ extended: true }));

// Routes
app.get("/", (req, res) => {
  const data = readImageData();
  res.render("index", { latest: data.slice(-1)[0] });
});

app.get("/upload", (req, res) => res.render("upload", { msg: null }));

app.post("/upload", (req, res) => {
  upload(req, res, (err) => {
    if (err) return res.render("upload", { msg: err });
    if (!req.files || req.files.length === 0)
      return res.render("upload", { msg: "No files uploaded!" });

    const data = readImageData();
    const newEntries = req.files.map((file) => ({
      filename: file.filename,
      path: `/uploads/${file.filename}`,
      uploadedAt: new Date().toISOString(),
    }));

    writeImageData([...data, ...newEntries]);
    res.redirect("/");
  });
});

app.get("/gallery", (req, res) => {
  const data = readImageData();
  res.render("gallery", { images: data });
});

app.post("/delete/:filename", (req, res) => {
  const filename = req.params.filename;
  const data = readImageData();
  const updatedData = data.filter((img) => img.filename !== filename);

  const filePath = path.join(uploadsPath, filename);
  if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

  writeImageData(updatedData);
  res.redirect("/gallery");
});

app.get("/edit/:filename", (req, res) => {
  const filename = req.params.filename;
  res.render("edit", { filename });
});

app.post("/edit/:filename", (req, res) => {
  const oldFilename = req.params.filename;

  singleUpload(req, res, (err) => {
    if (err) return res.send("Error uploading new image: " + err);
    if (!req.file) return res.send("No file selected");

    const data = readImageData();
    const index = data.findIndex((img) => img.filename === oldFilename);
    if (index === -1) return res.send("Image not found");

    // Delete old file
    const oldPath = path.join(uploadsPath, oldFilename);
    if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

    // Replace metadata
    data[index].filename = req.file.filename;
    data[index].path = `/uploads/${req.file.filename}`;
    writeImageData(data);

    res.redirect("/gallery");
  });
});

const PORT = 3000;
app.listen(PORT, () =>
  console.log(`🚀 App running at http://localhost:${PORT}`)
);
