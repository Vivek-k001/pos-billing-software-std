const { app, nativeImage } = require("electron");
const fs = require("fs");
const path = require("path");

app.whenReady().then(() => {
  try {
    const inputPath = path.join(__dirname, "frontend", "public", "logo1.png");
    const outputPath = path.join(__dirname, "frontend", "public", "logo1.ico");

    console.log(`Loading image from: ${inputPath}`);
    const img = nativeImage.createFromPath(inputPath);
    if (img.isEmpty()) {
      console.error("Error: Failed to load logo1.png. Please make sure the file exists at frontend/public/logo1.png and is a valid image.");
      app.quit();
      return;
    }

    console.log("Resizing image to 256x256...");
    const resized = img.resize({ width: 256, height: 256, quality: "best" });
    const pngBuffer = resized.toPNG();

    console.log("Creating ICO file structure...");
    const icoBuffer = Buffer.alloc(22 + pngBuffer.length);

    // --- ICO Header (6 bytes) ---
    icoBuffer.writeUInt16LE(0, 0);     // Reserved (must be 0)
    icoBuffer.writeUInt16LE(1, 2);     // Type (1 = Icon)
    icoBuffer.writeUInt16LE(1, 4);     // Number of images in file (1)

    // --- Directory Entry (16 bytes) ---
    icoBuffer.writeUInt8(0, 6);        // Width (0 means 256px)
    icoBuffer.writeUInt8(0, 7);        // Height (0 means 256px)
    icoBuffer.writeUInt8(0, 8);        // Color count (0 if >= 8bpp)
    icoBuffer.writeUInt8(0, 9);        // Reserved (must be 0)
    icoBuffer.writeUInt16LE(1, 10);    // Color planes (1)
    icoBuffer.writeUInt16LE(32, 12);   // Bits per pixel (32)
    icoBuffer.writeUInt32LE(pngBuffer.length, 14); // Size of image data
    icoBuffer.writeUInt32LE(22, 18);   // Offset of image data (header 6 + entry 16 = 22)

    // --- Image Data ---
    pngBuffer.copy(icoBuffer, 22);

    fs.writeFileSync(outputPath, icoBuffer);
    console.log(`\nSuccess! Created Windows icon at: ${outputPath}`);
  } catch (err) {
    console.error("Error during icon conversion:", err);
  } finally {
    app.quit();
  }
});
