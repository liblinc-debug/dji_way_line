const createCanvas = (width, height) => {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
};

const drawRotor = (context, x, y, radiusX, radiusY) => {
  context.beginPath();
  context.ellipse(x, y, radiusX, radiusY, 0, 0, Math.PI * 2);
  context.fillStyle = '#062535';
  context.fill();
  context.lineWidth = 5;
  context.strokeStyle = '#00dfff';
  context.stroke();
};

const drawNoseArrow = (context, centerX) => {
  context.beginPath();
  context.moveTo(centerX, 5);
  context.lineTo(centerX + 12, 27);
  context.lineTo(centerX + 5, 27);
  context.lineTo(centerX + 5, 43);
  context.lineTo(centerX - 5, 43);
  context.lineTo(centerX - 5, 27);
  context.lineTo(centerX - 12, 27);
  context.closePath();
  context.fillStyle = '#ffad1f';
  context.fill();
  context.lineWidth = 3;
  context.strokeStyle = '#ffffff';
  context.stroke();
};

const drawTopDownDrone = () => {
  const canvas = createCanvas(128, 128);
  const context = canvas.getContext('2d');
  context.lineCap = 'round';
  context.lineJoin = 'round';

  context.strokeStyle = '#e7fbff';
  context.lineWidth = 9;
  [[48, 49, 28, 29], [80, 49, 100, 29], [48, 79, 28, 99], [80, 79, 100, 99]].forEach(([x1, y1, x2, y2]) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  });

  drawRotor(context, 25, 26, 15, 15);
  drawRotor(context, 103, 26, 15, 15);
  drawRotor(context, 25, 102, 15, 15);
  drawRotor(context, 103, 102, 15, 15);
  drawNoseArrow(context, 64);

  context.beginPath();
  context.moveTo(45, 45);
  context.quadraticCurveTo(64, 33, 83, 45);
  context.lineTo(89, 66);
  context.quadraticCurveTo(84, 90, 64, 95);
  context.quadraticCurveTo(44, 90, 39, 66);
  context.closePath();
  context.fillStyle = '#123e50';
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = '#ffffff';
  context.stroke();

  context.beginPath();
  context.moveTo(52, 58);
  context.lineTo(64, 46);
  context.lineTo(76, 58);
  context.lineTo(72, 80);
  context.lineTo(64, 87);
  context.lineTo(56, 80);
  context.closePath();
  context.fillStyle = '#00dfff';
  context.fill();
  context.beginPath();
  context.arc(64, 66, 6, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  return canvas;
};

const drawPerspectiveDrone = () => {
  const canvas = createCanvas(160, 128);
  const context = canvas.getContext('2d');
  context.lineCap = 'round';
  context.lineJoin = 'round';

  context.strokeStyle = '#e7fbff';
  context.lineWidth = 9;
  [[67, 49, 36, 32], [93, 49, 124, 32], [61, 77, 25, 94], [99, 77, 135, 94]].forEach(([x1, y1, x2, y2]) => {
    context.beginPath();
    context.moveTo(x1, y1);
    context.lineTo(x2, y2);
    context.stroke();
  });

  drawRotor(context, 31, 29, 20, 10);
  drawRotor(context, 129, 29, 20, 10);
  drawRotor(context, 20, 98, 19, 11);
  drawRotor(context, 140, 98, 19, 11);
  drawNoseArrow(context, 80);

  context.beginPath();
  context.moveTo(58, 44);
  context.quadraticCurveTo(80, 31, 102, 44);
  context.lineTo(112, 77);
  context.lineTo(99, 101);
  context.lineTo(80, 111);
  context.lineTo(61, 101);
  context.lineTo(48, 77);
  context.closePath();
  context.fillStyle = '#123e50';
  context.fill();
  context.lineWidth = 4;
  context.strokeStyle = '#ffffff';
  context.stroke();

  context.beginPath();
  context.moveTo(66, 55);
  context.lineTo(80, 43);
  context.lineTo(94, 55);
  context.lineTo(89, 86);
  context.lineTo(80, 96);
  context.lineTo(71, 86);
  context.closePath();
  context.fillStyle = '#00dfff';
  context.fill();
  context.beginPath();
  context.arc(80, 68, 7, 0, Math.PI * 2);
  context.fillStyle = '#ffffff';
  context.fill();
  return canvas;
};

export const createDronePreviewIcons = () => ({
  twoD: drawTopDownDrone(),
  threeD: drawPerspectiveDrone()
});
