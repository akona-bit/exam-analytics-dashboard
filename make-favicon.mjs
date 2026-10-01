import { Jimp } from 'jimp';

async function makeFavicon() {
  try {
    const image = await Jimp.read('public/avatar.png');
    // Resize down to 64x64 for favicon
    image.resize({ w: 64, h: 64 });
    await image.write('public/avatar.png');
    console.log("Saved 64x64 favicon.");
  } catch (err) {
    console.error(err);
  }
}
makeFavicon();
