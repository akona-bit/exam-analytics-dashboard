const Jimp = require('jimp');

Jimp.read('public/avatar.png')
  .then(image => {
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function (x, y, idx) {
      const r = this.bitmap.data[idx];
      const g = this.bitmap.data[idx + 1];
      const b = this.bitmap.data[idx + 2];
      
      // If the pixel is very dark (close to black)
      if (r < 30 && g < 30 && b < 30) {
        this.bitmap.data[idx + 3] = 0; // Set alpha to 0
      }
    });
    
    return image.writeAsync('public/avatar.png');
  })
  .then(() => {
    console.log('Background removed successfully!');
  })
  .catch(err => {
    console.error('Error:', err);
  });
